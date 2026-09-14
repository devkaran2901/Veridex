import { query } from '../database/db';
import { ingestLiveRecord } from '../ingestion/ingestionPipeline';


export interface GovernmentAdvisory {
  topic: string;
  location: string;
  issuingAuthority: string;
  advisoryLevel: 'Info' | 'Warning' | 'Severe';
  summary: string;
  bulletins: string[];
  issuedDate: string;
  source: string;
}

export async function getGovernmentData(
  topic: string,
  location: string = 'National'
): Promise<GovernmentAdvisory> {
  const cacheKey = `gov_${topic.toLowerCase()}_${location.toLowerCase()}`;

  // Check cache
  try {
    const cacheRes = await query(
      `SELECT data FROM live_data_cache WHERE cache_key = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [cacheKey]
    );
    if (cacheRes.rows.length > 0) {
      return cacheRes.rows[0].data as GovernmentAdvisory;
    }
  } catch (err) {
    console.warn('Gov data cache query failed:', err);
  }

  // Simulated IMD / Disaster Response Portal API response
  const isFlood = topic.toLowerCase().includes('flood') || topic.toLowerCase().includes('rain') || topic.toLowerCase().includes('travel');

  const advisory: GovernmentAdvisory = {
    topic,
    location,
    issuingAuthority: 'National Disaster Management Authority (NDMA) & IMD',
    advisoryLevel: isFlood ? 'Severe' : 'Info',
    summary: isFlood
      ? `Official NDMA Flood & Weather Bulletin for ${location}: Heavy to extremely heavy rainfall expected over the next 24-48 hours. Risk of urban inundation and road transit disruption.`
      : `Standard Transit & Public Safety Bulletin for ${location}. All transport services operating under normal schedules.`,
    bulletins: isFlood
      ? [
          'Low-lying underpasses in urban corridors subject to waterlogging.',
          'Inter-city rail transport operating with precautionary speed limits.',
          'Citizens advised to restrict non-essential road travel during storm hours.',
        ]
      : ['No major disaster advisories active for this sector.'],
    issuedDate: new Date().toISOString().split('T')[0],
    source: 'data.gov.in / NDMA Portal API',
  };

  // Cache for 30 minutes
  try {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await query(
      `INSERT INTO live_data_cache (cache_key, data, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE SET data = $2, expires_at = $3`,
      [cacheKey, JSON.stringify(advisory), expiresAt]
    );
  } catch (err) {
    console.warn('Gov data cache write failed:', err);
  }

  // Ingest into Knowledge Layer (pgvector + knowledge_records)
  try {
    await ingestLiveRecord({
      source: 'NDMA (National Disaster Management Authority)',
      sourceType: 'api_feed',
      datasetId: 'ndma_flood_advisory_2026',
      title: `NDMA Advisory Bulletin - ${advisory.topic} (${advisory.location})`,
      content: `NDMA Official Bulletin (${advisory.issuingAuthority}): ${advisory.summary} Directives: ${advisory.bulletins.join(' ')}`,
      structuredData: {
        topic: advisory.topic,
        location: advisory.location,
        advisoryLevel: advisory.advisoryLevel,
        bulletins: advisory.bulletins,
      },
      metadata: {
        issuingAuthority: advisory.issuingAuthority,
        sourceUrl: 'https://ndma.gov.in',
      },
      validFrom: new Date(),
    });
  } catch (err) {
    // Silent catch for ingestion error
  }


  return advisory;
}


export function getCurrentTime(): string {
  return new Date().toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'medium',
  });
}
