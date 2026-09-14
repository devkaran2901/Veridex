import { query } from '../database/db';
import { generateEmbedding } from '../services/embedding';
import { computeContentHash, detectRecordChange } from './deduplicator';
import { REGISTERED_PROVIDERS } from './discovery/datasetRegistry';
import { KnowledgeRecordInput } from './types';
import { config } from '../config/env';

export interface IngestionReport {
  timestamp: string;
  totalFetched: number;
  insertedRecords: number;
  duplicateRecords: number;
  updatedRecords: number;
  errors: string[];
}

let schedulerTimer: NodeJS.Timeout | null = null;

/**
 * Stage 1: Record Normalization
 */
export function normalizeRecord(rec: KnowledgeRecordInput): KnowledgeRecordInput {
  const now = new Date();
  return {
    ...rec,
    title: rec.title.trim(),
    content: rec.content.trim(),
    source: rec.source.trim(),
    datasetId: rec.datasetId.trim(),
    observedAt: rec.observedAt || rec.timestamp || now,
    retrievedAt: rec.retrievedAt || now,
    validFrom: rec.validFrom || now,
    structuredData: rec.structuredData || {},
    metadata: rec.metadata || {},
    isMock: rec.isMock || false,
  };
}

/**
 * Stage 2: Record Validation
 */
export function validateRecord(rec: KnowledgeRecordInput): { valid: boolean; reason?: string } {
  if (!rec.title || rec.title.length < 3) {
    return { valid: false, reason: 'Invalid or missing record title' };
  }
  if (!rec.content || rec.content.length < 5) {
    return { valid: false, reason: 'Invalid or missing record content' };
  }
  if (!rec.source) {
    return { valid: false, reason: 'Missing record source' };
  }
  if (!rec.datasetId) {
    return { valid: false, reason: 'Missing datasetId' };
  }
  // If in live mode, reject records with isMock = true
  if (config.dataMode === 'live' && rec.isMock) {
    return { valid: false, reason: 'Mock record rejected in LIVE mode' };
  }
  return { valid: true };
}

/**
 * Stage 3-6: Ingest a single live record through Normalizer -> Validator -> Deduplicator -> Versioning -> Embedding -> Knowledge Store
 */
export async function ingestLiveRecord(rawRec: KnowledgeRecordInput): Promise<{ inserted: boolean; isUpdate?: boolean; id?: string }> {
  try {
    // 1. Normalization
    const rec = normalizeRecord(rawRec);

    // 2. Validation
    const validation = validateRecord(rec);
    if (!validation.valid) {
      console.warn(`⚠️ Record validation failed for "${rec.title}": ${validation.reason}`);
      return { inserted: false };
    }

    // 3. SHA-256 Content Hashing & Change Detection
    const contentHash = computeContentHash(rec);
    const changeStatus = await detectRecordChange(rec, contentHash);

    if (changeStatus.isDuplicate && changeStatus.existingId) {
      return { inserted: false, isUpdate: false, id: changeStatus.existingId };
    }

    // 4. Versioning update handling
    if (changeStatus.isVersionUpdate && changeStatus.existingId) {
      // Invalidate previous version
      await query(
        `UPDATE knowledge_records SET valid_until = CURRENT_TIMESTAMP WHERE id = $1`,
        [changeStatus.existingId]
      );
    }

    // 5. Generate 1536-dim vector embedding
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

    // 6. Insert into PostgreSQL knowledge_records
    const insertRes = await query(
      `INSERT INTO knowledge_records 
       (source, source_type, dataset_id, title, content, structured_data, metadata, observed_at, retrieved_at, valid_from, valid_until, version, content_hash, embedding)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::vector)
       RETURNING id`,
      [
        rec.source,
        rec.sourceType,
        rec.datasetId || 'live_feed',
        rec.title,
        rec.content,
        JSON.stringify(rec.structuredData || {}),
        JSON.stringify(rec.metadata || {}),
        rec.observedAt || new Date(),
        rec.retrievedAt || new Date(),
        rec.validFrom || new Date(),
        rec.validUntil || null,
        changeStatus.newVersion,
        contentHash,
        vectorSqlStr,
      ]
    );

    return { inserted: true, isUpdate: changeStatus.isVersionUpdate, id: insertRes.rows[0]?.id };
  } catch (err: any) {
    console.warn(`⚠️ Live record ingestion failed for ${rawRec.title}:`, err.message);
    return { inserted: false };
  }
}

/**
 * Execute Full Batch Ingestion Pipeline across registered providers
 */
export async function runIngestionPipeline(providerIdFilter?: string): Promise<IngestionReport> {
  console.log(`🔄 Executing Live Knowledge Ingestion Pipeline [Mode: ${config.dataMode.toUpperCase()}]...`);
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
    if (provider.isMock && config.dataMode !== 'demo') {
      continue; // Skip mock providers in live mode
    }

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

      // 3. Process each record
      for (const rec of records) {
        const result = await ingestLiveRecord(rec);
        if (result.inserted) {
          if (result.isUpdate) {
            report.updatedRecords++;
          } else {
            report.insertedRecords++;
          }
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

  console.log(`✅ Ingestion Complete: ${report.insertedRecords} inserted, ${report.updatedRecords} updated, ${report.duplicateRecords} duplicates skipped.`);
  return report;
}

/**
 * Seed initial live knowledge records on database startup
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

/**
 * Continuous Background Ingestion Worker Scheduler (FIX #20)
 */
export function startBackgroundIngestionScheduler(intervalMinutes: number = config.ingestionIntervalMinutes) {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
  console.log(`⏱️ Starting Continuous Live Ingestion Scheduler (Interval: ${intervalMinutes}m)...`);

  schedulerTimer = setInterval(async () => {
    console.log('⏰ Triggering scheduled background live data sync...');
    try {
      await runIngestionPipeline();
    } catch (err: any) {
      console.error('❌ Scheduled background ingestion failed:', err.message);
    }
  }, intervalMs);

  return schedulerTimer;
}

export function stopBackgroundIngestionScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log('⏹️ Background Ingestion Scheduler stopped.');
  }
}
