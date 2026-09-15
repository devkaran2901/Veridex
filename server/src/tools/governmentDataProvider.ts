import { query } from '../database/db';
import { config } from '../config/env';
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
  isMock?: boolean;
}

export async function getGovernmentData(
  topic: string,
  location: string = 'National'
): Promise<GovernmentAdvisory> {
  const isDemo = config.dataMode === 'demo';

  if (!isDemo) {
    // In LIVE mode, do not fabricate synthetic government advisories
    return {
      topic,
      location,
      issuingAuthority: 'Unconnected Live Feed',
      advisoryLevel: 'Info',
      summary: `No live government advisory feed connected for "${topic}" in ${location}.`,
      bulletins: [],
      issuedDate: new Date().toISOString().split('T')[0],
      source: 'Veridex System',
      isMock: false,
    };
  }

  const cacheKey = `gov_demo_${topic.toLowerCase()}_${location.toLowerCase()}`;

  // Check cache for demo data
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

  // Explicit DEMO Mode synthetic data (clearly tagged as DEMO/MOCK DATA)
  const isFlood = topic.toLowerCase().includes('flood') || topic.toLowerCase().includes('rain') || topic.toLowerCase().includes('travel');

  const advisory: GovernmentAdvisory = {
    topic,
    location,
    issuingAuthority: '[DEMO / SYNTHETIC DATA] Veridex Advisory Simulator',
    advisoryLevel: isFlood ? 'Warning' : 'Info',
    summary: isFlood
      ? `[DEMO DATA] Simulated Heavy Rain Bulletin for ${location}: Test scenario for urban transit planning.`
      : `[DEMO DATA] Simulated Safety Bulletin for ${location}. Test scenario.`,
    bulletins: isFlood
      ? ['[DEMO DATA] Test bulletin: Waterlogging simulated in low-lying zones.']
      : ['[DEMO DATA] No active advisories in test scenario.'],
    issuedDate: new Date().toISOString().split('T')[0],
    source: '[DEMO DATA] Veridex Test Provider',
    isMock: true,
  };

  // Cache demo data
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

  // Ingest demo record only in DEMO mode with isMock = true
  try {
    await ingestLiveRecord({
      source: '[DEMO DATA] Veridex Simulator',
      sourceType: 'api_feed',
      datasetId: 'demo_advisory_2026',
      title: `[DEMO DATA] Advisory - ${advisory.topic} (${advisory.location})`,
      content: `[DEMO DATA] ${advisory.summary} Bulletins: ${advisory.bulletins.join(' ')}`,
      structuredData: {
        topic: advisory.topic,
        location: advisory.location,
        advisoryLevel: advisory.advisoryLevel,
        isMock: true,
      },
      metadata: {
        issuingAuthority: advisory.issuingAuthority,
        isMock: true,
      },
      validFrom: new Date(),
      isMock: true,
    });
  } catch (err) {
    // Silent catch
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
