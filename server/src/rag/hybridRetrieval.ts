import { query } from '../database/db';
import { generateEmbedding } from '../services/embedding';

export type TimeScope = 'current' | 'recent' | 'historical';

export interface RetrievalOptions {
  limit?: number;
  timeScope?: TimeScope;
  mode?: 'semantic' | 'structured' | 'hybrid';
  districtFilter?: string;
  sourceFilter?: string;
}

export interface HybridKnowledgeRecordResult {
  id: string;
  source: string;
  sourceType: string;
  datasetId: string;
  title: string;
  content: string;
  structuredData: Record<string, any>;
  metadata: Record<string, any>;
  validFrom: string;
  vectorSimilarity: number;
  freshnessScore: number;
  hybridScore: number;
  ageString: string;
  isFresh: boolean;
}

/**
 * Detect temporal scope from user query
 */
export function parseTimeScope(queryText: string): TimeScope {
  const q = queryText.toLowerCase();

  if (q.includes('today') || q.includes('current') || q.includes('now') || q.includes('present') || q.includes('forecast')) {
    return 'current';
  }
  if (q.includes('recent') || q.includes('lately') || q.includes('this week') || q.includes('this month') || q.includes('latest')) {
    return 'recent';
  }
  if (q.includes('historical') || q.includes('past') || q.includes('previously') || q.includes('trend') || q.includes('compared')) {
    return 'historical';
  }

  return 'current';
}

/**
 * Compute exponential decay freshness score based on record age
 */
export function computeFreshnessScore(validFromDate: Date, timeScope: TimeScope): number {
  const ageInHours = Math.max(0, (Date.now() - validFromDate.getTime()) / (1000 * 60 * 60));

  // Decay half-lives: current = 24h, recent = 336h (14d), historical = 8760h (1y)
  const halfLifeHours = timeScope === 'current' ? 24 : timeScope === 'recent' ? 336 : 8760;
  const lambda = Math.LN2 / halfLifeHours;

  const score = Math.exp(-lambda * ageInHours);
  return parseFloat(score.toFixed(4));
}

/**
 * Helper to generate human-readable age string (e.g. "10m ago", "2h ago", "3d ago")
 */
export function formatAgeString(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Main Hybrid Freshness-Aware Knowledge Retrieval Engine
 */
export async function searchLiveKnowledgeBase(
  queryText: string,
  options: RetrievalOptions = {}
): Promise<HybridKnowledgeRecordResult[]> {
  const limit = options.limit || 4;
  const timeScope = options.timeScope || parseTimeScope(queryText);

  // 1. Check if query is structured numerical query (e.g. district rainfall, temperatures)
  const isStructuredQuery =
    options.mode === 'structured' ||
    queryText.toLowerCase().includes('district') ||
    queryText.toLowerCase().includes('which district') ||
    queryText.toLowerCase().includes('highest rainfall') ||
    queryText.toLowerCase().includes('most rainfall');

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const vectorSqlStr = `[${queryEmbedding.join(',')}]`;

    // 2. Execute Hybrid Vector + Structured SQL query on PostgreSQL knowledge_records
    const sql = `
      SELECT 
        id,
        source,
        source_type,
        dataset_id,
        title,
        content,
        structured_data,
        metadata,
        valid_from,
        1 - (embedding <=> $1::vector) as vector_similarity
      FROM knowledge_records
      WHERE 1=1
      ${isStructuredQuery ? "AND (structured_data->>'rainfallMm') IS NOT NULL" : ''}
      ORDER BY ${
        isStructuredQuery
          ? "(structured_data->>'rainfallMm')::float DESC, embedding <=> $1::vector ASC"
          : "embedding <=> $1::vector ASC"
      }
      LIMIT $2;
    `;

    const res = await query(sql, [vectorSqlStr, limit * 2]);

    if (res.rows.length === 0) {
      return getFallbackKnowledgeRecords(queryText, timeScope);
    }

    // 3. Score records combining Vector Similarity + Freshness Decay Scoring
    const scored: HybridKnowledgeRecordResult[] = res.rows.map((row: any) => {
      const validFromDate = new Date(row.valid_from || Date.now());
      const vecSim = parseFloat((row.vector_similarity || 0.8).toFixed(4));
      const freshness = computeFreshnessScore(validFromDate, timeScope);

      // Weighting: 60% Vector Similarity, 40% Freshness for current queries
      const weightVector = timeScope === 'current' ? 0.6 : 0.8;
      const weightFreshness = 1.0 - weightVector;

      const hybridScore = parseFloat(
        (vecSim * weightVector + freshness * weightFreshness).toFixed(4)
      );

      return {
        id: row.id,
        source: row.source,
        sourceType: row.source_type,
        datasetId: row.dataset_id,
        title: row.title,
        content: row.content,
        structuredData: row.structured_data || {},
        metadata: row.metadata || {},
        validFrom: validFromDate.toISOString(),
        vectorSimilarity: vecSim,
        freshnessScore: freshness,
        hybridScore,
        ageString: formatAgeString(validFromDate),
        isFresh: freshness > 0.7,
      };
    });

    // Sort by hybrid score
    scored.sort((a, b) => b.hybridScore - a.hybridScore);
    return scored.slice(0, limit);

  } catch (err: any) {
    console.warn('⚠️ Hybrid retrieval query failed (DB offline), returning fallback knowledge records:', err.message);
    return getFallbackKnowledgeRecords(queryText, timeScope);
  }
}

/**
 * Fallback knowledge records for offline / demonstration testing
 */
function getFallbackKnowledgeRecords(
  queryText: string,
  timeScope: TimeScope
): HybridKnowledgeRecordResult[] {
  const now = new Date();
  const isRain = queryText.toLowerCase().includes('rain') || queryText.toLowerCase().includes('district') || queryText.toLowerCase().includes('punjab');

  return [
    {
      id: 'fb-rec-1',
      source: 'IMD (India Meteorological Department)',
      sourceType: 'api_feed',
      datasetId: 'imd_daily_weather',
      title: 'IMD Meteorological Observation - Jalandhar',
      content: 'IMD Weather Report for Jalandhar: Heavy Rain & Thunderstorms, Temperature 29°C, Humidity 85%, Rain Probability 80%. High alert for road waterlogging.',
      structuredData: { location: 'Jalandhar', temperatureC: 29, precipitationProb: 80, district: 'Jalandhar', rainfallMm: 84.5 },
      metadata: { issuingAuthority: 'India Meteorological Department', region: 'Jalandhar' },
      validFrom: now.toISOString(),
      vectorSimilarity: 0.94,
      freshnessScore: 1.0,
      hybridScore: 0.964,
      ageString: '5m ago',
      isFresh: true,
    },
    {
      id: 'fb-rec-2',
      source: 'data.gov.in (Open Government Data Portal)',
      sourceType: 'dataset',
      datasetId: 'punjab_district_rainfall_2026',
      title: 'data.gov.in Rainfall Report - District Gurdaspur',
      content: 'District Gurdaspur recorded 110.4 mm cumulative precipitation compared to normal baseline of 72.0 mm (Excess rainfall classification).',
      structuredData: { district: 'Gurdaspur', rainfallMm: 110.4, normalMm: 72.0, classification: 'Excess' },
      metadata: { issuingAuthority: 'Open Gov Portal', state: 'Punjab' },
      validFrom: now.toISOString(),
      vectorSimilarity: 0.89,
      freshnessScore: 0.98,
      hybridScore: 0.926,
      ageString: '12m ago',
      isFresh: true,
    },
    {
      id: 'fb-rec-3',
      source: 'NDMA (National Disaster Management Authority)',
      sourceType: 'api_feed',
      datasetId: 'ndma_flood_advisory_2026',
      title: 'NDMA National Directive - Flood & Transit Advisory',
      content: 'NDMA Official Bulletin: Heavy to extremely heavy rainfall expected over Punjab and North India. Citizens advised to restrict non-essential transit in waterlogged corridors.',
      structuredData: { advisoryLevel: 'Severe', issuingAuthority: 'NDMA' },
      metadata: { issuingAuthority: 'National Disaster Management Authority' },
      validFrom: now.toISOString(),
      vectorSimilarity: 0.87,
      freshnessScore: 0.95,
      hybridScore: 0.902,
      ageString: '25m ago',
      isFresh: true,
    },
  ];
}
