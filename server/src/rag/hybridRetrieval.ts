import { query } from '../database/db';
import { generateEmbedding } from '../services/embedding';
import { config } from '../config/env';
import { getLiveWeather } from '../tools/weatherProvider';

export type TimeScope = 'current' | 'recent' | 'historical' | 'comparison';

export interface RetrievalOptions {
  limit?: number;
  timeScope?: TimeScope;
  mode?: 'semantic' | 'structured' | 'hybrid' | 'comparison';
  datasetIds?: string[];
  sourceIds?: string[];
  location?: string;
  districtFilter?: string;
  sourceFilter?: string;
  userId?: string;
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
  observedAt: string;
  retrievedAt: string;
  vectorSimilarity: number;
  freshnessScore: number;
  reliabilityScore: number;
  hybridScore: number;
  ageString: string;
  isFresh: boolean;
  isMock: boolean;
}

/**
 * Detect temporal scope from user query (FIX #9)
 */
export function parseTimeScope(queryText: string): TimeScope {
  const q = queryText.toLowerCase();

  if (
    q.includes('changed') ||
    q.includes('since yesterday') ||
    q.includes('since this morning') ||
    q.includes('compared with') ||
    q.includes('compared to') ||
    q.includes('difference') ||
    q.includes('evolved')
  ) {
    return 'comparison';
  }
  if (
    q.includes('today') ||
    q.includes('current') ||
    q.includes('now') ||
    q.includes('present') ||
    q.includes('forecast') ||
    q.includes('this morning') ||
    q.includes('currently')
  ) {
    return 'current';
  }
  if (
    q.includes('recent') ||
    q.includes('recently') ||
    q.includes('lately') ||
    q.includes('this week') ||
    q.includes('this month') ||
    q.includes('latest')
  ) {
    return 'recent';
  }
  if (
    q.includes('historical') ||
    q.includes('past') ||
    q.includes('previously') ||
    q.includes('last year') ||
    q.includes('2025') ||
    q.includes('2024')
  ) {
    return 'historical';
  }

  return 'current';
}

/**
 * Compute exponential decay freshness score based on record age
 */
export function computeFreshnessScore(validFromDate: Date, timeScope: TimeScope): number {
  const ageInHours = Math.max(0, (Date.now() - validFromDate.getTime()) / (1000 * 60 * 60));

  // Decay half-lives: current = 24h, recent = 336h (14d), historical/comparison = 8760h (1y)
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
 * Compute Source Reliability score (FIX #15)
 */
export function computeReliabilityScore(source: string, metadata: Record<string, any>): number {
  const s = source.toLowerCase();
  const isMock = metadata.isMock || s.includes('mock') || s.includes('demo');

  if (isMock) return 0.4;
  if (s.includes('imd') || s.includes('ndma') || s.includes('data.gov.in') || s.includes('government') || s.includes('custom') || s.includes('connected')) {
    return 1.0;
  }
  return 0.8;
}

/**
 * Helper to dynamically extract location from user query (e.g. "weather in jhajjar" -> "jhajjar")
 */
export function extractLocationFromQuery(queryText: string): string | undefined {
  if (!queryText || typeof queryText !== 'string') return undefined;

  const q = queryText.trim();

  // Pattern 1: explicit preposition "in / for / at <location>"
  const prepMatch = q.match(/\b(?:in|for|at)\s+([a-zA-Z\s,]+)$/i);
  if (prepMatch && prepMatch[1].trim().length >= 2) {
    const loc = prepMatch[1].replace(/[?!.,]/g, '').trim();
    const timeStopWords = ['today', 'now', 'currently', 'recent', 'latest', 'this morning', 'this evening', 'tonight'];
    const cleaned = loc.split(' ').filter(w => !timeStopWords.includes(w.toLowerCase())).join(' ').trim();
    if (cleaned.length >= 2) return cleaned;
  }

  // Pattern 2: strip out weather and general query stop words with word boundaries
  const stopWordsRegex = /\b(weather|temperature|temp|rain|raining|rainfall|forecast|climate|precipitation|today|now|current|recent|this|morning|evening|tonight|in|for|at|of|the|is|it|what|whats|how|show|get|me|tell|please|currently|check|give)\b/gi;

  const clean = q
    .replace(stopWordsRegex, '')
    .replace(/[?!.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length >= 2) {
    const primary = clean.split(',')[0].trim();
    return primary.length >= 2 ? primary : clean;
  }

  return undefined;
}

/**
 * Main Hybrid Freshness-Aware Knowledge Retrieval Engine (FIX #12, #13, #14)
 */
export async function searchLiveKnowledgeBase(
  queryText: string,
  options: RetrievalOptions = {}
): Promise<HybridKnowledgeRecordResult[]> {
  const limit = options.limit || 4;
  const timeScope = options.timeScope || parseTimeScope(queryText);
  const q = queryText.toLowerCase();

  // Extract location dynamically if present in query or options
  const targetLocation = options.location || extractLocationFromQuery(queryText);

  // If query is asking about live weather, trigger real-time weather tool fetch & ingestion first
  if (q.includes('weather') || q.includes('rain') || q.includes('temperature') || q.includes('climate')) {
    try {
      const fetchLoc = targetLocation || 'Buhana, Rajasthan';
      await getLiveWeather(fetchLoc);
    } catch (err) {
      // Catch weather fetch errors silently
    }
  }

  const isStructuredQuery =
    options.mode === 'structured' ||
    q.includes('district') ||
    q.includes('which district') ||
    q.includes('highest rainfall') ||
    q.includes('most rainfall') ||
    q.includes('temperature') ||
    q.includes('statistics');

  const isComparisonQuery = timeScope === 'comparison' || options.mode === 'comparison';

  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const vectorSqlStr = `[${queryEmbedding.join(',')}]`;

    const queryParams: any[] = [vectorSqlStr, limit * 4];
    let whereClauses = 'WHERE 1=1';

    if (targetLocation) {
      queryParams.push(`%${targetLocation}%`);
      const locIdx = queryParams.length;
      whereClauses += ` AND (title ILIKE $${locIdx} OR content ILIKE $${locIdx} OR structured_data->>'location' ILIKE $${locIdx} OR metadata->>'region' ILIKE $${locIdx})`;
    }

    if (options.datasetIds && options.datasetIds.length > 0) {
      queryParams.push(options.datasetIds);
      whereClauses += ` AND dataset_id = ANY($${queryParams.length})`;
    }

    if (options.sourceIds && options.sourceIds.length > 0) {
      queryParams.push(options.sourceIds);
      whereClauses += ` AND source_id = ANY($${queryParams.length})`;
    }

    if (options.userId) {
      queryParams.push(options.userId);
      whereClauses += ` AND (user_id = $${queryParams.length} OR user_id IS NULL)`;
    }

    // 1. Comparison Mode: Fetch current version records + historical/previous version records
    if (isComparisonQuery) {
      const sqlComparison = `
        SELECT 
          id, source, source_type, dataset_id, title, content, structured_data, metadata, 
          valid_from, observed_at, retrieved_at, version,
          1 - (embedding <=> $1::vector) as vector_similarity
        FROM knowledge_records
        ${whereClauses}
        ORDER BY version DESC, valid_from DESC
        LIMIT $2;
      `;
      const compRes = await query(sqlComparison, queryParams);

      if (compRes.rows.length === 0) {
        return config.dataMode === 'demo' ? getFallbackKnowledgeRecords(queryText, timeScope) : [];
      }

      return compRes.rows.map((row: any) => {
        const validFromDate = new Date(row.valid_from || row.observed_at || Date.now());
        const vecSim = parseFloat((row.vector_similarity || 0.8).toFixed(4));
        const freshness = computeFreshnessScore(validFromDate, timeScope);
        const reliability = computeReliabilityScore(row.source, row.metadata || {});
        const hybridScore = parseFloat((vecSim * 0.5 + freshness * 0.3 + reliability * 0.2).toFixed(4));

        return {
          id: row.id,
          source: row.source,
          sourceType: row.source_type,
          datasetId: row.dataset_id,
          title: `[VERSION ${row.version || 1}] ${row.title}`,
          content: row.content,
          structuredData: row.structured_data || {},
          metadata: row.metadata || {},
          validFrom: validFromDate.toISOString(),
          observedAt: new Date(row.observed_at || validFromDate).toISOString(),
          retrievedAt: new Date(row.retrieved_at || Date.now()).toISOString(),
          vectorSimilarity: vecSim,
          freshnessScore: freshness,
          reliabilityScore: reliability,
          hybridScore,
          ageString: formatAgeString(validFromDate),
          isFresh: freshness > 0.7,
          isMock: Boolean(row.metadata?.isMock),
        };
      }).slice(0, limit);
    }

    // 2. Structured SQL or Semantic Hybrid Retrieval
    const structuredClause = isStructuredQuery
      ? "AND (structured_data IS NOT NULL AND structured_data != '{}'::jsonb)"
      : '';

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
        observed_at,
        retrieved_at,
        1 - (embedding <=> $1::vector) as vector_similarity
      FROM knowledge_records
      ${whereClauses}
      ${structuredClause}
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $2;
    `;

    const res = await query(sql, queryParams);

    if (res.rows.length === 0) {
      return config.dataMode === 'demo' ? getFallbackKnowledgeRecords(queryText, timeScope) : [];
    }

    // 3. Score records combining Vector Similarity + Freshness Decay + Source Reliability
    const locLower = targetLocation ? targetLocation.toLowerCase() : null;

    const scored: HybridKnowledgeRecordResult[] = res.rows
      .map((row: any) => {
        const validFromDate = new Date(row.valid_from || row.observed_at || Date.now());
        const vecSim = parseFloat((row.vector_similarity || 0.8).toFixed(4));
        const freshness = computeFreshnessScore(validFromDate, timeScope);
        const reliability = computeReliabilityScore(row.source, row.metadata || {});

        // Score formula: 50% Vector Sim, 30% Freshness, 20% Reliability
        const weightVector = timeScope === 'current' ? 0.5 : 0.7;
        const weightFreshness = timeScope === 'current' ? 0.3 : 0.1;
        const weightReliability = 0.2;

        const hybridScore = parseFloat(
          (vecSim * weightVector + freshness * weightFreshness + reliability * weightReliability).toFixed(4)
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
          observedAt: new Date(row.observed_at || validFromDate).toISOString(),
          retrievedAt: new Date(row.retrieved_at || Date.now()).toISOString(),
          vectorSimilarity: vecSim,
          freshnessScore: freshness,
          reliabilityScore: reliability,
          hybridScore,
          ageString: formatAgeString(validFromDate),
          isFresh: freshness > 0.7,
          isMock: Boolean(row.metadata?.isMock),
        };
      })
      .filter((r) => {
        // Enforce score threshold cutoff
        if (r.hybridScore < 0.45) return false;

        // Rule #18: If a target location was specified, record MUST match that location
        if (locLower) {
          const recText = `${r.title} ${r.content} ${JSON.stringify(r.structuredData)} ${JSON.stringify(r.metadata)}`.toLowerCase();
          if (!recText.includes(locLower)) {
            return false;
          }
        }
        return true;
      });

    // Sort by hybrid score
    scored.sort((a, b) => b.hybridScore - a.hybridScore);
    return scored.slice(0, limit);

  } catch (err: any) {
    console.warn('⚠️ Hybrid retrieval query failed:', err.message);
    if (config.dataMode === 'demo') {
      return getFallbackKnowledgeRecords(queryText, timeScope);
    }
    return [];
  }
}

/**
 * Check whether a user query is relevant to Live Government/Open Data domain
 */
export function isDomainRelevantQuery(queryText: string): boolean {
  const q = queryText.toLowerCase().trim();

  // Out-of-domain patterns (trivia, acronym definitions like GTA, movies, general knowledge)
  const outOfDomainPatterns = [
    /\bwhat does \w+ mean\b/i,
    /\bmeaning of \w+\b/i,
    /\bstand for\b/i,
    /\bgrand theft auto\b/i,
    /\bgta\b/i,
    /\bwho is\b/i,
    /\bcapital of\b/i,
    /\bmovie\b/i,
    /\bgame\b/i,
    /\bplaystation\b/i,
    /\bxbox\b/i,
    /\bsong\b/i,
    /\bcelebrity\b/i,
    /\bactor\b/i,
  ];

  const govAcronyms = ['imd', 'ndma', 'aqi', 'pm2.5', 'pm10', 'isro', 'cpcb', 'niti', 'rag', 'veridex', 'api'];
  const hasGovAcronym = govAcronyms.some((ac) => q.includes(ac));

  if (!hasGovAcronym) {
    for (const pattern of outOfDomainPatterns) {
      if (pattern.test(q)) {
        return false;
      }
    }
  }

  const domainKeywords = [
    'weather', 'rain', 'rainfall', 'monsoon', 'temp', 'temperature', 'climate', 'flood',
    'advisory', 'forecast', 'district', 'punjab', 'delhi', 'mumbai', 'india', 'imd', 'ndma',
    'government', 'data', 'catalog', 'traffic', 'road', 'air quality', 'aqi', 'pollution',
    'water', 'reservoir', 'agriculture', 'crop', 'custom', 'api', 'stats', 'statistic',
    'document', 'pdf', 'guidance', 'report', 'policy', 'preference', 'travel', 'budget',
    'census', 'transport', 'hazard', 'disaster', 'precip', 'precipitation', 'humidity',
    'wind', 'warning', 'directive', 'ingested', 'dataset', 'source', 'veridex', 'my preference'
  ];

  return domainKeywords.some((kw) => q.includes(kw));
}

/**
 * Explicit DEMO Mode Fallback knowledge records (Used ONLY when DATA_MODE=demo and query is in-domain)
 */
function getFallbackKnowledgeRecords(
  queryText: string,
  timeScope: TimeScope
): HybridKnowledgeRecordResult[] {
  if (!isDomainRelevantQuery(queryText)) {
    return [];
  }

  const now = new Date();

  return [
    {
      id: 'fb-rec-1',
      source: 'MOCK / DEMO (IMD Meteorological Bulletin)',
      sourceType: 'api_feed',
      datasetId: 'imd_daily_weather',
      title: '[MOCK / DEMO] IMD Weather Advisory - North India Corridor',
      content: '[DEMO FALLBACK RECORD] IMD Meteorological Advisory: Pre-monsoon showers and thunderstorm activity predicted across North India.',
      structuredData: { location: 'North India', temperatureC: 28, condition: 'Thunderstorms', isMock: true },
      metadata: { issuingAuthority: 'IMD (Demo Fallback)', isMock: true },
      validFrom: now.toISOString(),
      observedAt: now.toISOString(),
      retrievedAt: now.toISOString(),
      vectorSimilarity: 0.85,
      freshnessScore: 0.9,
      reliabilityScore: 0.4,
      hybridScore: 0.87,
      ageString: '5m ago',
      isFresh: true,
      isMock: true,
    },
    {
      id: 'fb-rec-2',
      source: 'MOCK / DEMO (NDMA Disaster Directive)',
      sourceType: 'api_feed',
      datasetId: 'ndma_flood_advisory_2026',
      title: '[MOCK / DEMO] NDMA Flood & Weather Advisory',
      content: '[DEMO FALLBACK RECORD] NDMA Emergency Preparedness Directive: Urban flooding advisories active for major transit corridors during severe weather.',
      structuredData: { advisoryLevel: 'Warning', issuingAuthority: 'NDMA (Demo Fallback)', isMock: true },
      metadata: { issuingAuthority: 'National Disaster Management Authority', isMock: true },
      validFrom: now.toISOString(),
      observedAt: now.toISOString(),
      retrievedAt: now.toISOString(),
      vectorSimilarity: 0.82,
      freshnessScore: 0.9,
      reliabilityScore: 0.4,
      hybridScore: 0.85,
      ageString: '10m ago',
      isFresh: true,
      isMock: true,
    },
  ];
}
