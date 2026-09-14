import { query } from '../database/db';
import { generateEmbedding } from '../services/embedding';
import { computeContentHash, detectRecordChange } from './deduplicator';
import { REGISTERED_PROVIDERS } from './discovery/datasetRegistry';
import { KnowledgeRecordInput } from './types';

export interface IngestionReport {
  timestamp: string;
  totalFetched: number;
  insertedRecords: number;
  duplicateRecords: number;
  updatedRecords: number;
  errors: string[];
}

/**
 * Ingest a single live record into the Knowledge Layer (PostgreSQL knowledge_records + pgvector)
 * Flow: Fetcher/Tool -> Normalizer -> Validator -> SHA-256 Deduplication -> Embedding -> Store
 */
export async function ingestLiveRecord(rec: KnowledgeRecordInput): Promise<{ inserted: boolean; id?: string }> {
  try {
    const contentHash = computeContentHash(rec);
    const changeStatus = await detectRecordChange(rec, contentHash);

    if (changeStatus.isDuplicate && changeStatus.existingId) {
      return { inserted: false, id: changeStatus.existingId };
    }

    // Generate 1536-dim vector embedding
    const embedding = await generateEmbedding(rec.content);
    const vectorSqlStr = `[${embedding.join(',')}]`;

    // Ensure dataset entry exists in knowledge_datasets table
    if (rec.datasetId) {
      await query(
        `INSERT INTO knowledge_datasets (id, name, source, description, last_synced_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET last_synced_at = CURRENT_TIMESTAMP`,
        [rec.datasetId, rec.title, rec.source, rec.content.slice(0, 100)]
      );
    }

    // Insert record into PostgreSQL knowledge_records
    const insertRes = await query(
      `INSERT INTO knowledge_records 
       (source, source_type, dataset_id, title, content, structured_data, metadata, valid_from, valid_until, version, content_hash, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector)
       RETURNING id`,
      [
        rec.source,
        rec.sourceType,
        rec.datasetId || 'live_feed',
        rec.title,
        rec.content,
        JSON.stringify(rec.structuredData || {}),
        JSON.stringify(rec.metadata || {}),
        rec.validFrom || new Date(),
        rec.validUntil || null,
        changeStatus.existingVersion || 1,
        contentHash,
        vectorSqlStr,
      ]
    );

    return { inserted: true, id: insertRes.rows[0]?.id };
  } catch (err: any) {
    console.warn(`⚠️ Live record ingestion failed for ${rec.title}:`, err.message);
    return { inserted: false };
  }
}

/**
 * Execute Full Batch Ingestion Pipeline: Fetch -> Parse -> Validate -> Dedupe -> Embed -> Store
 */
export async function runIngestionPipeline(providerIdFilter?: string): Promise<IngestionReport> {
  console.log('🔄 Executing Live Knowledge Ingestion Pipeline...');
  const report: IngestionReport = {
    timestamp: new Date().toISOString(),
    totalFetched: 0,
    insertedRecords: 0,
    duplicateRecords: 0,
    updatedRecords: 0,
    errors: [],
  };

  const providersToRun = providerIdFilter
    ? REGISTERED_PROVIDERS.filter((p) => p.id === providerIdFilter)
    : REGISTERED_PROVIDERS;

  for (const provider of providersToRun) {
    try {
      // 1. Register / Update Dataset Metadata in knowledge_datasets
      await query(
        `INSERT INTO knowledge_datasets (id, name, source, description, category, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET last_synced_at = CURRENT_TIMESTAMP`,
        [provider.id, provider.name, provider.source, provider.description, provider.category || 'general']
      );

      // 2. Fetcher
      const records = await provider.fetchLatestData();
      report.totalFetched += records.length;

      // 3. Process each record through SHA-256 deduplication & vector embedding
      for (const rec of records) {
        const result = await ingestLiveRecord(rec);
        if (result.inserted) {
          report.insertedRecords++;
        } else {
          report.duplicateRecords++;
        }
      }

      // Update dataset record count
      const countRes = await query(
        `SELECT COUNT(*) FROM knowledge_records WHERE dataset_id = $1`,
        [provider.id]
      );
      await query(
        `UPDATE knowledge_datasets SET record_count = $1 WHERE id = $2`,
        [parseInt(countRes.rows[0]?.count || '0', 10), provider.id]
      );

    } catch (err: any) {
      console.warn(`⚠️ Ingestion failed for provider ${provider.id}:`, err.message);
      report.errors.push(`${provider.id}: ${err.message}`);
    }
  }

  console.log(`✅ Ingestion Complete: ${report.insertedRecords} inserted, ${report.duplicateRecords} duplicates skipped, ${report.updatedRecords} updated.`);
  return report;
}

/**
 * Seed initial live knowledge records on database startup if empty
 */
export async function seedInitialKnowledgeIfNeeded() {
  try {
    const res = await query('SELECT COUNT(*) FROM knowledge_records');
    const count = parseInt(res.rows[0]?.count || '0', 10);
    if (count === 0) {
      console.log('🌱 No knowledge records found. Initializing seed live data ingestion...');
      await runIngestionPipeline();
    }
  } catch (err) {
    console.warn('⚠️ Could not check knowledge_records table count:', err);
  }
}
