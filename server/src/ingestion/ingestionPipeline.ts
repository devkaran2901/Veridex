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
 * Execute Ingestion Pipeline: Fetch -> Parse -> Validate -> Dedupe -> Embed -> Store
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
        `INSERT INTO knowledge_datasets (id, name, source, description, last_synced_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET last_synced_at = CURRENT_TIMESTAMP`,
        [provider.id, provider.name, provider.source, provider.description]
      );

      // 2. Fetcher
      const records = await provider.fetchLatestData();
      report.totalFetched += records.length;

      // 3. Process each record
      for (const rec of records) {
        const contentHash = computeContentHash(rec);
        const changeStatus = await detectRecordChange(rec, contentHash);

        if (changeStatus.isDuplicate) {
          report.duplicateRecords++;
          continue;
        }

        // 4. Generate Vector Embedding
        const embedding = await generateEmbedding(rec.content);
        const vectorSqlStr = `[${embedding.join(',')}]`;

        // 5. Store Knowledge Record in PostgreSQL
        await query(
          `INSERT INTO knowledge_records 
           (source, source_type, dataset_id, title, content, structured_data, metadata, valid_from, valid_until, version, content_hash, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::vector)`,
          [
            rec.source,
            rec.sourceType,
            rec.datasetId,
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

        if (changeStatus.existingVersion && changeStatus.existingVersion > 1) {
          report.updatedRecords++;
        } else {
          report.insertedRecords++;
        }
      }

      // Update dataset record count
      const countRes = await query(
        `SELECT COUNT(*) FROM knowledge_records WHERE dataset_id = $1`,
        [provider.id]
      );
      await query(
        `UPDATE knowledge_datasets SET record_count = $1 WHERE id = $2`,
        [parseInt(countRes.rows[0].count, 10), provider.id]
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
    const count = parseInt(res.rows[0].count, 10);
    if (count === 0) {
      console.log('🌱 No knowledge records found. Initializing seed live data ingestion...');
      await runIngestionPipeline();
    }
  } catch (err) {
    console.warn('⚠️ Could not check knowledge_records table count:', err);
  }
}
