import { DatasetMetadata, GovernmentDataProvider, KnowledgeRecordInput } from '../types';
import { getLiveWeather } from '../../tools/weatherProvider';
import { getGovernmentData } from '../../tools/governmentDataProvider';
import { config } from '../../config/env';

/**
 * IMD (India Meteorological Department) Weather & Rainfall Feed Provider
 */
export class IMDProvider implements GovernmentDataProvider {
  id = 'imd_daily_weather';
  name = 'IMD Daily Meteorological & District Weather Feed';
  source = 'IMD (India Meteorological Department)';
  publisher = 'India Meteorological Department (Ministry of Earth Sciences)';
  description = 'Real-time temperature, precipitation probability, humidity, and weather alerts for Indian urban centers and districts.';
  category = 'weather' as const;
  isMock = false;

  async searchDatasets(queryText: string): Promise<DatasetMetadata[]> {
    const q = queryText.toLowerCase();
    if (
      q.includes('weather') ||
      q.includes('rain') ||
      q.includes('temp') ||
      q.includes('forecast') ||
      q.includes('imd') ||
      q.includes('punjab') ||
      q.includes('delhi') ||
      q.includes('district')
    ) {
      return [await this.getDatasetMetadata(this.id)];
    }
    return [];
  }

  async getDatasetMetadata(datasetId: string): Promise<DatasetMetadata> {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      publisher: this.publisher,
      description: this.description,
      category: this.category,
      apiAvailable: true,
      schema: ['location', 'temperatureC', 'condition', 'humidity', 'precipitationProb', 'advisoryAlert'],
      geography: 'India',
      geographicCoverage: 'National / District Level',
      temporalCoverage: 'Real-time / Hourly',
      updateFrequency: 'Continuously (Hourly Feed)',
      lastUpdated: new Date().toISOString(),
      sourceUrl: 'https://mausam.imd.gov.in',
      recordCount: 10,
      isMock: false,
    };
  }

  async fetchDataset(datasetId: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    return this.fetchLatestData(datasetId, options);
  }

  async fetchLatestData(_datasetId?: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    const locations = options?.locations || ['Delhi', 'Jalandhar', 'Shimla', 'Mumbai', 'Amritsar', 'Ludhiana', 'Patiala', 'Bathinda'];
    const records: KnowledgeRecordInput[] = [];
    const now = new Date();

    for (const loc of locations) {
      const w = await getLiveWeather(loc);
      records.push({
        source: this.source,
        sourceType: 'api_feed',
        datasetId: this.id,
        title: `IMD Meteorological Observation - ${w.location}`,
        content: `IMD Weather Observation for ${w.location}: ${w.condition}, Temperature ${w.temperatureC}°C, Humidity ${w.humidity}%, Rain Probability ${w.precipitationProb}%. ${w.advisoryAlert || ''}`,
        structuredData: {
          location: w.location,
          temperatureC: w.temperatureC,
          condition: w.condition,
          humidity: w.humidity,
          precipitationProb: w.precipitationProb,
          advisoryAlert: w.advisoryAlert || null,
        },
        metadata: {
          issuingAuthority: 'India Meteorological Department',
          publisher: this.publisher,
          region: w.location,
          sourceUrl: 'https://mausam.imd.gov.in',
        },
        timestamp: now,
        observedAt: now,
        retrievedAt: now,
        validFrom: now,
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours validity
        isMock: false,
      });
    }

    return records;
  }
}

/**
 * Authentic data.gov.in (Open Government Data Portal India) Provider
 */
export class DataGovProvider implements GovernmentDataProvider {
  id = 'datagov_open_catalog';
  name = 'data.gov.in Official Open Data Catalog';
  source = 'data.gov.in (Open Government Data Portal India)';
  publisher = 'National Informatics Centre / Ministry of Electronics & IT';
  description = 'Official open government dataset catalog covering rainfall, water resources, agriculture, and public statistics.';
  category = 'rainfall' as const;
  isMock = false;

  // Known catalog resource IDs on data.gov.in OGD platform
  private knownResources = [
    {
      id: 'punjab_rainfall_stat',
      name: 'District-wise Monthly Rainfall Statistics for Punjab',
      resourceId: '9ef92705-7c8e-4b1d-b439-d79050d26a7e',
      publisher: 'Ministry of Jal Shakti / IMD',
      description: 'Official monthly rainfall departure and baseline precipitation metrics published by Ministry of Jal Shakti / IMD.',
      geography: 'Punjab',
      category: 'rainfall' as const,
      schema: ['district', 'rainfall_mm', 'normal_mm', 'departure_percent', 'status'],
      updateFrequency: 'Monthly / Daily Bulletins',
      temporalCoverage: 'Recent & Current Monsoon Season',
    },
    {
      id: 'all_india_crop_production',
      name: 'All India Crop Production Statistics',
      resourceId: '3b01478b-b8db-4274-b5d1-72a396247721',
      publisher: 'Ministry of Agriculture and Farmers Welfare',
      description: 'District level crop production and yield statistics.',
      geography: 'India',
      category: 'agriculture' as const,
      schema: ['state', 'district', 'crop', 'year', 'season', 'area_hectares', 'production_tonnes'],
      updateFrequency: 'Annual / Seasonal',
      temporalCoverage: 'Historical & Recent',
    },
    {
      id: 'datagov_resource_9a362ec2',
      name: 'Data.gov.in Government Open Resource (9a362ec2)',
      resourceId: '9a362ec2-2cfc-4e08-8c74-7926b2159a69',
      publisher: 'Open Government Data (OGD) Platform India',
      description: 'Official open government dataset resource from data.gov.in portal.',
      geography: 'India',
      category: 'general' as const,
      schema: ['id', 'state', 'district', 'metric', 'value', 'updated_at'],
      updateFrequency: 'Real-Time / Periodical',
      temporalCoverage: 'Current & Recent',
    },
  ];

  async searchDatasets(queryText: string): Promise<DatasetMetadata[]> {
    const apiKey = config.datagovApiKey;
    const q = queryText.toLowerCase();

    // If API key is available, attempt real catalog search from data.gov.in catalog API
    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const searchUrl = `https://api.data.gov.in/catalog/search?api-key=${encodeURIComponent(apiKey)}&format=json&title=${encodeURIComponent(queryText)}&limit=5`;
        const res = await fetch(searchUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data: any = await res.json();
          if (data.records && Array.isArray(data.records)) {
            return data.records.map((r: any, idx: number) => ({
              id: r.id || `datagov_${idx}`,
              name: r.title || 'data.gov.in Dataset',
              source: this.source,
              publisher: r.org?.[0] || this.publisher,
              description: r.desc || r.title || 'Official Government Open Dataset',
              category: 'general' as const,
              apiAvailable: true,
              schema: r.field ? r.field.map((f: any) => f.name) : [],
              geography: r.sector || 'India',
              geographicCoverage: 'National / State Level',
              temporalCoverage: r.created_date || 'Recent',
              updateFrequency: 'Periodic API Update',
              lastUpdated: r.updated_date || new Date().toISOString(),
              sourceUrl: r.url || 'https://data.gov.in',
              recordCount: parseInt(r.total_records || '10', 10),
              isMock: false,
            }));
          }
        }
      } catch (err: any) {
        console.warn('⚠️ data.gov.in online catalog search API unavailable:', err.message);
      }
    }

    // Fallback to static catalog metadata registry (without inventing numbers in live mode)
    return this.knownResources
      .filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.geography.toLowerCase().includes(q) ||
        r.category.includes(q) ||
        q.includes('rain') ||
        q.includes('punjab') ||
        q.includes('government') ||
        q.includes('dataset') ||
        q.includes('crop')
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        source: this.source,
        publisher: r.publisher,
        description: r.description,
        category: r.category,
        apiAvailable: Boolean(apiKey),
        schema: r.schema,
        geography: r.geography,
        geographicCoverage: `${r.geography} Region`,
        temporalCoverage: r.temporalCoverage,
        updateFrequency: r.updateFrequency,
        lastUpdated: new Date().toISOString(),
        sourceUrl: `https://data.gov.in/resource/${r.resourceId}`,
        recordCount: 0,
        isMock: false,
      }));
  }

  async getDatasetMetadata(datasetId: string): Promise<DatasetMetadata | null> {
    const datasets = await this.searchDatasets(datasetId);
    return datasets.find((d) => d.id === datasetId) || null;
  }

  async fetchDataset(datasetId: string, _options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    const apiKey = config.datagovApiKey;
    const now = new Date();

    if (!apiKey) {
      console.warn(`⚠️ DATAGOV_API_KEY is not configured in .env. Skipping live API fetch for dataset ${datasetId}.`);
      return []; // Rule 7: Do not insert fake error text into knowledge_records
    }

    // Connect to real data.gov.in endpoint with DATAGOV_API_KEY
    try {
      const resource = this.knownResources.find((r) => r.id === datasetId);
      const resourceId = resource?.resourceId || datasetId;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const fetchUrl = `https://api.data.gov.in/resource/${resourceId}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=15`;
      const response = await fetch(fetchUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json: any = await response.json();
      const rawRecords = json.records || [];

      return rawRecords.map((item: any, idx: number) => ({
        source: this.source,
        sourceType: 'dataset',
        datasetId: datasetId,
        title: `data.gov.in Official Record #${idx + 1} - ${item.district || item.state || datasetId}`,
        content: `Official Government Record from data.gov.in (${resource?.name || datasetId}): ${JSON.stringify(item)}`,
        structuredData: item,
        metadata: {
          issuingAuthority: json.org?.[0] || 'Government of India',
          publisher: json.org?.[0] || this.publisher,
          sourceUrl: `https://data.gov.in/resource/${resourceId}`,
          title: json.title,
        },
        timestamp: now,
        observedAt: now,
        retrievedAt: now,
        validFrom: now,
        isMock: false,
      }));

    } catch (err: any) {
      console.error(`❌ Error fetching data.gov.in dataset ${datasetId}:`, err.message);
      return [
        {
          source: this.source,
          sourceType: 'dataset',
          datasetId: datasetId,
          title: `data.gov.in API Status - ${datasetId}`,
          content: `Unable to fetch live records for dataset ${datasetId} from data.gov.in: ${err.message}`,
          structuredData: {
            datasetId,
            error: err.message,
            status: 'FETCH_FAILED',
          },
          metadata: {
            sourceUrl: 'https://data.gov.in',
          },
          timestamp: now,
          observedAt: now,
          retrievedAt: now,
          validFrom: now,
          isMock: false,
        },
      ];
    }
  }

  async fetchLatestData(datasetId?: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    return this.fetchDataset(datasetId || 'punjab_rainfall_stat', options);
  }
}

/**
 * NDMA National Disaster Management Authority Guidelines & Bulletins Provider
 */
export class NDMAProvider implements GovernmentDataProvider {
  id = 'ndma_flood_advisory_2026';
  name = 'NDMA Preparedness & Advisory Bulletins';
  source = 'NDMA (National Disaster Management Authority)';
  publisher = 'National Disaster Management Authority (Ministry of Home Affairs)';
  description = 'Official disaster preparedness guidelines, urban flooding advisories, and emergency response directives.';
  category = 'disaster' as const;
  isMock = false;

  async searchDatasets(queryText: string): Promise<DatasetMetadata[]> {
    const q = queryText.toLowerCase();
    if (
      q.includes('flood') ||
      q.includes('disaster') ||
      q.includes('ndma') ||
      q.includes('advisory') ||
      q.includes('guidance') ||
      q.includes('recommend') ||
      q.includes('emergency')
    ) {
      return [await this.getDatasetMetadata(this.id)];
    }
    return [];
  }

  async getDatasetMetadata(datasetId: string): Promise<DatasetMetadata> {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      publisher: this.publisher,
      description: this.description,
      category: this.category,
      apiAvailable: true,
      schema: ['topic', 'advisoryLevel', 'issuingAuthority', 'summary', 'bulletins'],
      geography: 'India',
      geographicCoverage: 'National',
      temporalCoverage: 'Active Advisories 2026',
      updateFrequency: 'Real-Time Emergency Directives',
      lastUpdated: new Date().toISOString(),
      sourceUrl: 'https://ndma.gov.in',
      recordCount: 5,
      isMock: false,
    };
  }

  async fetchDataset(datasetId: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    return this.fetchLatestData(datasetId, options);
  }

  async fetchLatestData(_datasetId?: string, _options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    const govData = await getGovernmentData('Flood & Transit Advisory', 'Punjab & North India');
    const now = new Date();

    return [
      {
        source: this.source,
        sourceType: 'api_feed',
        datasetId: this.id,
        title: `NDMA National Advisory - ${govData.topic}`,
        content: `NDMA Official Bulletin (${govData.issuingAuthority}): ${govData.summary} Emergency Guidelines: ${govData.bulletins.join(' ')}`,
        structuredData: {
          topic: govData.topic,
          advisoryLevel: govData.advisoryLevel,
          issuingAuthority: govData.issuingAuthority,
          bulletins: govData.bulletins,
        },
        metadata: {
          issuingAuthority: govData.issuingAuthority,
          publisher: this.publisher,
          advisoryLevel: govData.advisoryLevel,
          sourceUrl: 'https://ndma.gov.in',
        },
        timestamp: now,
        observedAt: now,
        retrievedAt: now,
        validFrom: now,
        isMock: false,
      },
    ];
  }
}

/**
 * Explicit DEMO Mode Mock Provider (Strictly Labeled, Used ONLY in DEMO/Test Mode)
 */
export class MockDataGovProvider implements GovernmentDataProvider {
  id = 'demo_punjab_rainfall_mock';
  name = 'MOCK / DEMO Punjab District Rainfall Statistics (Test Data)';
  source = 'MOCK / DEMO (data.gov.in Example Data)';
  publisher = 'Veridex Demo Generator (Synthetic Data)';
  description = 'Explicitly labeled synthetic test data for offline evaluation. NOT official government data.';
  category = 'rainfall' as const;
  isMock = true;

  async searchDatasets(_queryText: string): Promise<DatasetMetadata[]> {
    if (config.dataMode !== 'demo') return [];
    return [await this.getDatasetMetadata(this.id)];
  }

  async getDatasetMetadata(datasetId: string): Promise<DatasetMetadata> {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      publisher: this.publisher,
      description: this.description,
      category: this.category,
      apiAvailable: false,
      schema: ['district', 'rainfallMm', 'normalMm', 'departurePercent', 'classification', 'isMock'],
      geography: 'Punjab',
      geographicCoverage: 'Punjab State',
      temporalCoverage: 'Synthetic Demo Window',
      updateFrequency: 'Manual Demo Trigger',
      lastUpdated: new Date().toISOString(),
      sourceUrl: 'https://data.gov.in',
      recordCount: 2,
      isMock: true,
    };
  }

  async fetchDataset(datasetId: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    return this.fetchLatestData(datasetId, options);
  }

  async fetchLatestData(_datasetId?: string, _options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    if (config.dataMode !== 'demo') return [];
    const now = new Date();

    const demoDistricts = [
      { name: 'Jalandhar', rainfallMm: 84.5, normalMm: 52.0, status: 'Excess' },
      { name: 'Amritsar', rainfallMm: 92.1, normalMm: 60.0, status: 'Excess' },
    ];

    return demoDistricts.map((d) => ({
      source: this.source,
      sourceType: 'dataset',
      datasetId: this.id,
      title: `[MOCK / DEMO] Rainfall Report - District ${d.name}`,
      content: `[MOCK / DEMO DATA - FOR TESTING ONLY] District ${d.name} recorded ${d.rainfallMm} mm cumulative precipitation compared to baseline ${d.normalMm} mm.`,
      structuredData: {
        district: d.name,
        rainfallMm: d.rainfallMm,
        normalMm: d.normalMm,
        departurePercent: parseFloat((((d.rainfallMm - d.normalMm) / d.normalMm) * 100).toFixed(1)),
        classification: d.status,
        isMock: true,
      },
      metadata: {
        issuingAuthority: 'Veridex Test Suite (Mock Data)',
        publisher: this.publisher,
        state: 'Punjab',
        isMock: true,
      },
      timestamp: now,
      observedAt: now,
      retrievedAt: now,
      validFrom: now,
      isMock: true,
    }));
  }
}

/**
 * Explicit DEMO Mode Mock Custom API Provider
 */
export class MockCustomWeatherProvider implements GovernmentDataProvider {
  id = 'custom_demo_weather_api';
  name = 'Connected Punjab District Weather & Reservoir Advisory API';
  source = 'Punjab Water & Weather Advisory (Custom REST API)';
  publisher = 'Department of Irrigation & Climate Advisory (User Connected API)';
  description = 'Connected custom API feed providing district level weather warnings, dam water levels, and agricultural alerts.';
  category = 'weather' as const;
  isMock = true;

  async searchDatasets(queryText: string): Promise<DatasetMetadata[]> {
    if (config.dataMode !== 'demo') return [];
    return [await this.getDatasetMetadata(this.id)];
  }

  async getDatasetMetadata(datasetId: string): Promise<DatasetMetadata> {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      publisher: this.publisher,
      description: this.description,
      category: this.category,
      apiAvailable: true,
      schema: ['district', 'reservoirLevelMeters', 'rainfallMm', 'floodAdvisory', 'status'],
      geography: 'Punjab',
      geographicCoverage: 'State Level',
      temporalCoverage: 'Real-time',
      updateFrequency: 'Every 10 minutes',
      lastUpdated: new Date().toISOString(),
      sourceUrl: 'https://api.punjab-irrigation.gov.in/v1/weather-advisory',
      recordCount: 2,
      isMock: true,
    };
  }

  async fetchDataset(datasetId: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    return this.fetchLatestData(datasetId, options);
  }

  async fetchLatestData(_datasetId?: string, _options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    if (config.dataMode !== 'demo') return [];
    const now = new Date();
    return [
      {
        source: this.source,
        sourceType: 'api_feed',
        datasetId: this.id,
        title: '[MOCK / DEMO] Punjab Connected Custom API - Amritsar Dam & Weather Advisory',
        content: '[MOCK / DEMO CUSTOM API DATA] Amritsar District Reservoir Level: 245.8 meters (Normal Capacity: 250m). Rainfall: 92.1 mm. Advisory Status: High runoff watch active. Government warning: Evacuate low-lying canal banks if rainfall exceeds 100mm.',
        structuredData: {
          district: 'Amritsar',
          reservoirLevelMeters: 245.8,
          rainfallMm: 92.1,
          floodAdvisory: 'High runoff watch active. Maintain canal gates.',
          status: 'WARNING',
          isMock: true,
        },
        metadata: {
          sourceName: this.name,
          sourceUrl: 'https://api.punjab-irrigation.gov.in/v1/weather-advisory',
          isMock: true,
        },
        timestamp: now,
        observedAt: now,
        retrievedAt: now,
        validFrom: now,
        isMock: true,
      },
      {
        source: this.source,
        sourceType: 'api_feed',
        datasetId: this.id,
        title: '[MOCK / DEMO] Punjab Connected Custom API - Jalandhar Drainage & Weather Bulletin',
        content: '[MOCK / DEMO CUSTOM API DATA] Jalandhar District Reservoir Level: 210.2 meters. Rainfall: 84.5 mm. Advisory Status: Operational. Silt removal in progress.',
        structuredData: {
          district: 'Jalandhar',
          reservoirLevelMeters: 210.2,
          rainfallMm: 84.5,
          floodAdvisory: 'Operational. Silt removal in progress.',
          status: 'NORMAL',
          isMock: true,
        },
        metadata: {
          sourceName: this.name,
          sourceUrl: 'https://api.punjab-irrigation.gov.in/v1/weather-advisory',
          isMock: true,
        },
        timestamp: now,
        observedAt: now,
        retrievedAt: now,
        validFrom: now,
        isMock: true,
      },
    ];
  }
}

// Global Provider Registry Catalog
export const REGISTERED_PROVIDERS: GovernmentDataProvider[] = [
  new IMDProvider(),
  new DataGovProvider(),
  new NDMAProvider(),
];

if (config.dataMode === 'demo') {
  REGISTERED_PROVIDERS.push(new MockDataGovProvider());
  REGISTERED_PROVIDERS.push(new MockCustomWeatherProvider());
}

/**
 * Comprehensive Dataset Discovery Function
 * Searches open dataset catalogs + user connected custom APIs, ranks candidates, and returns schema/metadata.
 */
export async function discoverDatasets(queryText: string, userId?: string): Promise<DatasetMetadata[]> {
  const qClean = queryText.toLowerCase().trim();
  const casualPhrases = ['hey', 'hi', 'hello', 'thanks', 'good morning', 'good afternoon', 'good evening', 'how are you', 'sup', 'bye'];
  if (qClean.length <= 3 || casualPhrases.includes(qClean)) {
    return []; // Rule #10: Casual queries must not trigger dataset discovery
  }

  const matched: DatasetMetadata[] = [];
  const seenIds = new Set<string>();

  for (const provider of REGISTERED_PROVIDERS) {
    if (provider.isMock && config.dataMode !== 'demo') continue;

    try {
      const providerResults = await provider.searchDatasets(queryText);
      for (const ds of providerResults) {
        if (!seenIds.has(ds.id)) {
          seenIds.add(ds.id);
          matched.push(ds);
        }
      }
    } catch (err: any) {
      console.warn(`⚠️ Dataset discovery error in provider ${provider.id}:`, err.message);
    }
  }

  // Discover user connected custom APIs from PostgreSQL data_sources table
  try {
    const { query } = require('../../database/db');
    const customSources = await query(
      `SELECT * FROM data_sources 
       WHERE is_active = TRUE AND status != 'DISABLED'
       AND ($1::uuid IS NULL OR user_id = $1::uuid OR user_id IS NULL)`,
      [userId || null]
    );

    const q = queryText.toLowerCase();
    for (const ds of customSources.rows) {
      const dsId = `custom_${ds.id}`;
      if (seenIds.has(dsId)) continue;

      const matches =
        ds.name.toLowerCase().includes(q) ||
        ds.url.toLowerCase().includes(q) ||
        q.includes('custom') ||
        q.includes('api') ||
        q.includes('source') ||
        q.includes('weather') ||
        q.includes('rain') ||
        q.includes('data');

      if (matches || queryText.length < 5) {
        seenIds.add(dsId);
        matched.push({
          id: dsId,
          name: ds.name,
          source: `${ds.name} (Custom API)`,
          publisher: `User API (${new URL(ds.url).hostname})`,
          description: `User connected REST API: ${ds.url}`,
          category: 'general',
          apiAvailable: true,
          schema: (ds.schema || []).map((s: any) => s.name || s),
          geography: 'Custom Scope',
          geographicCoverage: 'User API Coverage',
          temporalCoverage: 'Real-time',
          updateFrequency: `Every ${ds.refresh_interval}m`,
          lastUpdated: ds.last_fetched_at ? new Date(ds.last_fetched_at).toISOString() : new Date().toISOString(),
          sourceUrl: ds.url,
          recordCount: ds.record_count || 0,
          isMock: false,
        });
      }
    }
  } catch (err: any) {
    // Database may not be initialized in test/standalone runs
  }

  return matched;
}

/**
 * Get Metadata for a specific dataset ID
 */
export async function getDatasetMetadata(datasetId: string): Promise<DatasetMetadata | null> {
  for (const provider of REGISTERED_PROVIDERS) {
    if (provider.isMock && config.dataMode !== 'demo') continue;
    try {
      const meta = await provider.getDatasetMetadata(datasetId);
      if (meta) return meta;
    } catch (err) {
      // Continue to next provider
    }
  }
  return null;
}

/**
 * Fetch raw dataset records for a dataset ID
 */
export async function fetchDatasetRecords(datasetId: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
  for (const provider of REGISTERED_PROVIDERS) {
    if (provider.isMock && config.dataMode !== 'demo') continue;
    if (provider.id === datasetId || datasetId.includes(provider.id)) {
      return provider.fetchLatestData(datasetId, options);
    }
  }

  // Check data.gov.in provider
  const dataGov = REGISTERED_PROVIDERS.find((p) => p instanceof DataGovProvider) as DataGovProvider | undefined;
  if (dataGov) {
    return dataGov.fetchDataset(datasetId, options);
  }

  return [];
}
