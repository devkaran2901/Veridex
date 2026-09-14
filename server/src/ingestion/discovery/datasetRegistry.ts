import { DatasetMetadata, DatasetProvider, KnowledgeRecordInput } from '../types';
import { getLiveWeather } from '../../tools/weatherProvider';
import { getGovernmentData } from '../../tools/governmentDataProvider';
import { config } from '../../config/env';

/**
 * IMD (India Meteorological Department) Weather & Rainfall Feed Provider
 */
export class IMDProvider implements DatasetProvider {
  id = 'imd_daily_weather';
  name = 'IMD Daily Meteorological & District Weather Feed';
  source = 'IMD (India Meteorological Department)';
  description = 'Real-time temperature, precipitation probability, humidity, and weather alerts for Indian urban centers and districts.';
  category = 'weather' as const;

  async fetchLatestData(): Promise<KnowledgeRecordInput[]> {
    const locations = ['Delhi', 'Jalandhar', 'Shimla', 'Mumbai', 'Amritsar', 'Ludhiana'];
    const records: KnowledgeRecordInput[] = [];

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
          region: w.location,
          sourceUrl: 'https://mausam.imd.gov.in',
        },
        timestamp: new Date(),
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours validity
      });
    }

    return records;
  }
}

/**
 * Authentic data.gov.in (Open Government Data Portal India) Provider
 */
export class DataGovProvider implements DatasetProvider {
  id = 'datagov_open_catalog';
  name = 'data.gov.in Official Open Data Catalog';
  source = 'data.gov.in (Open Government Data Portal India)';
  description = 'Official open government dataset catalog covering rainfall, water resources, agriculture, and public statistics.';
  category = 'rainfall' as const;

  // Known catalog resource IDs on data.gov.in OGD platform
  private knownResources = [
    {
      id: 'punjab_rainfall_stat',
      name: 'District-wise Monthly Rainfall Statistics for Punjab',
      resourceId: '9ef92705-7c8e-4b1d-b439-d79050d26a7e',
      description: 'Official monthly rainfall departure and baseline precipitation metrics published by Ministry of Jal Shakti / IMD.',
      geography: 'Punjab',
      category: 'rainfall' as const,
      schema: ['district', 'rainfall_mm', 'normal_mm', 'departure_percent', 'status'],
    },
    {
      id: 'all_india_crop_production',
      name: 'All India Crop Production Statistics',
      resourceId: '3b01478b-b8db-4274-b5d1-72a396247721',
      description: 'District level crop production and yield statistics.',
      geography: 'India',
      category: 'agriculture' as const,
      schema: ['state', 'district', 'crop', 'year', 'season', 'area_hectares', 'production_tonnes'],
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
              description: r.desc || r.title || 'Official Government Open Dataset',
              category: 'general' as const,
              apiAvailable: true,
              schema: r.field ? r.field.map((f: any) => f.name) : [],
              sourceUrl: r.url || 'https://data.gov.in',
              recordCount: parseInt(r.total_records || '10', 10),
              isMock: false,
            }));
          }
        }
      } catch (err: any) {
        console.warn('⚠️ data.gov.in online catalog search unavailable:', err.message);
      }
    }

    // Fallback to static catalog metadata definitions (without fake numbers)
    return this.knownResources
      .filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.geography.toLowerCase().includes(q) ||
        r.category.includes(q) ||
        q.includes('rain') ||
        q.includes('punjab') ||
        q.includes('government') ||
        q.includes('dataset')
      )
      .map((r) => ({
        id: r.id,
        name: r.name,
        source: this.source,
        description: r.description,
        category: r.category,
        apiAvailable: Boolean(apiKey),
        schema: r.schema,
        geography: r.geography,
        sourceUrl: `https://data.gov.in/resource/${r.resourceId}`,
        recordCount: 0,
        isMock: false,
      }));
  }

  async fetchDataset(datasetId: string): Promise<KnowledgeRecordInput[]> {
    const apiKey = config.datagovApiKey;

    if (!apiKey) {
      console.warn(`⚠️ DATAGOV_API_KEY is not configured in .env. Skipping live API fetch for dataset ${datasetId}.`);
      return [
        {
          source: this.source,
          sourceType: 'dataset',
          datasetId: datasetId,
          title: `data.gov.in API Access Status - ${datasetId}`,
          content: `data.gov.in Dataset [${datasetId}] is registered in the government open catalog, but DATAGOV_API_KEY is not configured. Set DATAGOV_API_KEY in .env to enable automated live record fetching.`,
          structuredData: {
            datasetId,
            status: 'API_KEY_REQUIRED',
            apiKeyConfigured: false,
          },
          metadata: {
            issuingAuthority: 'Open Government Data Portal India',
            sourceUrl: 'https://data.gov.in',
          },
          timestamp: new Date(),
          validFrom: new Date(),
        },
      ];
    }

    // Connect to real data.gov.in endpoint with DATAGOV_API_KEY
    try {
      const resource = this.knownResources.find((r) => r.id === datasetId);
      const resourceId = resource?.resourceId || datasetId;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const fetchUrl = `https://api.data.gov.in/resource/${resourceId}?api-key=${encodeURIComponent(apiKey)}&format=json&limit=10`;
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
        title: `data.gov.in Record #${idx + 1} - ${item.district || item.state || datasetId}`,
        content: `Official Government Record: ${JSON.stringify(item)}`,
        structuredData: item,
        metadata: {
          issuingAuthority: json.org?.[0] || 'Government of India',
          sourceUrl: `https://data.gov.in/resource/${resourceId}`,
          title: json.title,
        },
        timestamp: new Date(),
        validFrom: new Date(),
      }));

    } catch (err: any) {
      console.error(`❌ Error fetching data.gov.in dataset ${datasetId}:`, err.message);
      return [
        {
          source: this.source,
          sourceType: 'dataset',
          datasetId: datasetId,
          title: `data.gov.in API Error - ${datasetId}`,
          content: `Unable to fetch live records for dataset ${datasetId} from data.gov.in: ${err.message}`,
          structuredData: {
            datasetId,
            error: err.message,
            status: 'FETCH_FAILED',
          },
          metadata: {
            sourceUrl: 'https://data.gov.in',
          },
          timestamp: new Date(),
          validFrom: new Date(),
        },
      ];
    }
  }

  async fetchLatestData(): Promise<KnowledgeRecordInput[]> {
    return this.fetchDataset('punjab_rainfall_stat');
  }
}

/**
 * NDMA National Disaster Management Authority Guidelines & Bulletins Provider
 */
export class NDMAProvider implements DatasetProvider {
  id = 'ndma_flood_advisory_2026';
  name = 'NDMA Preparedness & Advisory Bulletins';
  source = 'NDMA (National Disaster Management Authority)';
  description = 'Official disaster preparedness guidelines, urban flooding advisories, and emergency response directives.';
  category = 'disaster' as const;

  async fetchLatestData(): Promise<KnowledgeRecordInput[]> {
    const govData = await getGovernmentData('Flood & Transit Advisory', 'Punjab & North India');

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
          advisoryLevel: govData.advisoryLevel,
          sourceUrl: 'https://ndma.gov.in',
        },
        timestamp: new Date(),
        validFrom: new Date(),
      },
    ];
  }
}

/**
 * Explicit DEMO Mode Mock Provider (Strictly Labeled, Used ONLY in DEMO/Test Mode)
 */
export class MockDataGovProvider implements DatasetProvider {
  id = 'demo_punjab_rainfall_mock';
  name = 'MOCK / DEMO Punjab District Rainfall Statistics (Test Data)';
  source = 'MOCK / DEMO (data.gov.in Example Data)';
  description = 'Explicitly labeled synthetic test data for offline evaluation. NOT official government data.';
  category = 'rainfall' as const;
  isMock = true;

  async fetchLatestData(): Promise<KnowledgeRecordInput[]> {
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
        state: 'Punjab',
        isMock: true,
      },
      timestamp: new Date(),
      validFrom: new Date(),
    }));
  }
}

// Global Provider Registry Catalog
export const REGISTERED_PROVIDERS: DatasetProvider[] = [
  new IMDProvider(),
  new DataGovProvider(),
  new NDMAProvider(),
];

if (config.demoMode) {
  REGISTERED_PROVIDERS.push(new MockDataGovProvider());
}

/**
 * Comprehensive Dataset Discovery Function (FIX #3 & FIX #4)
 * Searches open dataset catalogs, ranks candidates, and returns schema/metadata.
 */
export async function discoverDatasets(queryText: string): Promise<DatasetMetadata[]> {
  const q = queryText.toLowerCase();
  const matched: DatasetMetadata[] = [];

  // 1. Search data.gov.in provider
  const dataGov = REGISTERED_PROVIDERS.find((p) => p instanceof DataGovProvider) as DataGovProvider | undefined;
  if (dataGov && dataGov.searchDatasets) {
    const dataGovResults = await dataGov.searchDatasets(queryText);
    matched.push(...dataGovResults);
  }

  // 2. Search other registered providers (IMD, NDMA)
  for (const provider of REGISTERED_PROVIDERS) {
    if (provider instanceof DataGovProvider) continue; // Already searched above

    const matchesQuery =
      q.includes('weather') ||
      q.includes('rain') ||
      q.includes('temp') ||
      q.includes('flood') ||
      q.includes('advisory') ||
      q.includes('disaster') ||
      q.includes('government') ||
      q.includes('dataset') ||
      provider.name.toLowerCase().includes(q) ||
      provider.description.toLowerCase().includes(q);

    if (matchesQuery) {
      matched.push({
        id: provider.id,
        name: provider.name,
        source: provider.source,
        description: provider.description,
        category: provider.category,
        apiAvailable: true,
        schema: provider.category === 'weather' 
          ? ['location', 'temperatureC', 'condition', 'humidity', 'precipitationProb'] 
          : ['topic', 'advisoryLevel', 'summary', 'bulletins'],
        geography: 'India',
        sourceUrl: provider.category === 'weather' ? 'https://mausam.imd.gov.in' : 'https://ndma.gov.in',
        recordCount: 5,
        isMock: provider.isMock || false,
      });
    }
  }

  return matched;
}

/**
 * Get Metadata for a specific dataset ID
 */
export async function getDatasetMetadata(datasetId: string): Promise<DatasetMetadata | null> {
  const datasets = await discoverDatasets(datasetId);
  return datasets.find((d) => d.id === datasetId) || null;
}

/**
 * Fetch raw dataset records for a dataset ID
 */
export async function fetchDatasetRecords(datasetId: string): Promise<KnowledgeRecordInput[]> {
  const provider = REGISTERED_PROVIDERS.find((p) => p.id === datasetId);
  if (provider) {
    return provider.fetchLatestData();
  }

  // Check if data.gov.in provider can fetch it
  const dataGov = REGISTERED_PROVIDERS.find((p) => p instanceof DataGovProvider) as DataGovProvider | undefined;
  if (dataGov && dataGov.fetchDataset) {
    return dataGov.fetchDataset(datasetId);
  }

  return [];
}
