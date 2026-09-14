import crypto from 'crypto';
import { query } from '../database/db';
import { KnowledgeRecordInput } from './types';

/**
 * Generate a deterministic SHA-256 hash string for a knowledge record
 */
export function computeContentHash(record: KnowledgeRecordInput): string {
  const canonicalString = JSON.stringify({
    source: record.source,
    datasetId: record.datasetId,
    title: record.title.trim(),
    content: record.content.trim(),
    structuredData: record.structuredData || {},
  });

  return crypto.createHash('sha256').update(canonicalString).digest('hex');
}

export interface ChangeDetectionResult {
  isDuplicate: boolean;
  isVersionUpdate: boolean;
  existingId?: string;
  existingVersion?: number;
  newVersion: number;
  contentHash: string;
}

/**
 * Detect whether incoming record is identical, an updated version, or completely new
 */
export async function detectRecordChange(
  record: KnowledgeRecordInput,
  contentHash: string
): Promise<ChangeDetectionResult> {
  try {
    const res = await query(
      `SELECT id, version, content_hash FROM knowledge_records 
       WHERE dataset_id = $1 AND title = $2 
       ORDER BY version DESC LIMIT 1`,
      [record.datasetId, record.title]
    );

    if (res.rows.length > 0) {
      const existing = res.rows[0];
      if (existing.content_hash === contentHash) {
        return {
          isDuplicate: true,
          isVersionUpdate: false,
          existingId: existing.id,
          existingVersion: existing.version,
          newVersion: existing.version,
          contentHash,
        };
      }

      // Content changed -> create new version snapshot
      return {
        isDuplicate: false,
        isVersionUpdate: true,
        existingId: existing.id,
        existingVersion: existing.version,
        newVersion: existing.version + 1,
        contentHash,
      };
    }
  } catch (err) {
    console.warn('⚠️ Change detection query failed (DB offline), treating as new:', err);
  }

  return {
    isDuplicate: false,
    isVersionUpdate: false,
    newVersion: 1,
    contentHash,
  };
}
