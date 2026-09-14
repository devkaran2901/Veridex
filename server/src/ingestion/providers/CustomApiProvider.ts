import { GovernmentDataProvider, KnowledgeRecordInput, DatasetMetadata } from '../types';
import { safeFetch } from '../../services/ssrfProtection';
import { decryptCredential } from '../../services/cryptoService';
import { detectJsonStructure, formatRecordToSearchableText } from '../schemaDetector';

export interface CustomDataSourceConfig {
  id: string;
  user_id?: string;
  name: string;
  url: string;
  auth_type: 'none' | 'api_key' | 'bearer';
  auth_config?: {
    location?: 'header' | 'query';
    headerName?: string;
    paramName?: string;
  };
  encrypted_credentials?: string;
  refresh_interval: number;
  status: string;
  schema?: any[];
  record_count?: number;
}

export class CustomApiProvider implements GovernmentDataProvider {
  id: string;
  name: string;
  source: string;
  publisher: string;
  description: string;
  category: 'weather' | 'disaster' | 'rainfall' | 'agriculture' | 'water' | 'general' = 'general';
  isMock = false;
  config: CustomDataSourceConfig;

  constructor(dataSource: CustomDataSourceConfig) {
    this.config = dataSource;
    this.id = `custom_${dataSource.id}`;
    this.name = dataSource.name;
    this.source = `${dataSource.name} (Connected REST API)`;
    this.publisher = `User Connected API (${new URL(dataSource.url).hostname})`;
    this.description = `Custom user connected REST/JSON API source: ${dataSource.url}`;
  }

  async searchDatasets(queryText: string): Promise<DatasetMetadata[]> {
    const q = queryText.toLowerCase();
    const matches =
      this.name.toLowerCase().includes(q) ||
      this.description.toLowerCase().includes(q) ||
      this.source.toLowerCase().includes(q) ||
      q.includes('custom') ||
      q.includes('api') ||
      q.includes('user');

    if (matches) {
      return [await this.getDatasetMetadata(this.id)];
    }
    return [];
  }

  async getDatasetMetadata(_datasetId: string): Promise<DatasetMetadata> {
    return {
      id: this.id,
      name: this.name,
      source: this.source,
      publisher: this.publisher,
      description: this.description,
      category: this.category,
      apiAvailable: true,
      schema: (this.config.schema || []).map((s: any) => s.name || s),
      geography: 'Custom Scope',
      geographicCoverage: 'User Defined API Coverage',
      temporalCoverage: 'Real-Time / Configured Sync',
      updateFrequency: `Every ${this.config.refresh_interval} minutes`,
      lastUpdated: new Date().toISOString(),
      sourceUrl: this.config.url,
      recordCount: this.config.record_count || 0,
      isMock: false,
    };
  }

  async fetchDataset(_datasetId: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    return this.fetchLatestData(_datasetId, options);
  }

  async fetchLatestData(_datasetId?: string, _options?: Record<string, any>): Promise<KnowledgeRecordInput[]> {
    const now = new Date();
    let targetUrl = this.config.url;
    const headers: Record<string, string> = {};

    const decryptedKey = decryptCredential(this.config.encrypted_credentials || '');

    if (this.config.auth_type === 'bearer' && decryptedKey) {
      headers['Authorization'] = `Bearer ${decryptedKey}`;
    } else if (this.config.auth_type === 'api_key' && decryptedKey) {
      const loc = this.config.auth_config?.location || 'header';
      if (loc === 'header') {
        const headerName = this.config.auth_config?.headerName || 'X-API-Key';
        headers[headerName] = decryptedKey;
      } else {
        const paramName = this.config.auth_config?.paramName || 'api_key';
        const urlObj = new URL(targetUrl);
        urlObj.searchParams.set(paramName, decryptedKey);
        targetUrl = urlObj.toString();
      }
    }

    const response = await safeFetch(targetUrl, { headers, timeoutMs: 8000 });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Connected API returned HTTP ${response.status}: ${response.statusText}`);
    }

    let json: any;
    try {
      json = response.json();
    } catch (err: any) {
      throw new Error(`Failed to parse JSON response from API: ${err.message}`);
    }

    const detection = detectJsonStructure(json);
    if (!detection.valid) {
      throw new Error(detection.error || 'Invalid API JSON payload structure.');
    }

    const previewRecords = detection.recordsPreview.length > 0 ? detection.recordsPreview : [];
    const fullRecords = (detection.dataPath === 'root' ? json : json[detection.dataPath!]) || [];

    const knowledgeRecords: KnowledgeRecordInput[] = [];

    fullRecords.forEach((item: any, idx: number) => {
      if (!item || typeof item !== 'object') return;

      const recordTitle = item.title || item.name || item.location || item.district || `${this.name} Record #${idx + 1}`;
      const searchableContent = formatRecordToSearchableText(this.name, item);

      let recordObservedAt = now;
      if (item.date || item.timestamp || item.observed_at || item.created_at) {
        const parsedDate = new Date(item.date || item.timestamp || item.observed_at || item.created_at);
        if (!isNaN(parsedDate.getTime())) {
          recordObservedAt = parsedDate;
        }
      }

      knowledgeRecords.push({
        source: this.source,
        sourceType: 'api_feed',
        datasetId: this.id,
        title: recordTitle,
        content: searchableContent,
        structuredData: item,
        metadata: {
          sourceId: this.config.id,
          userId: this.config.user_id,
          sourceName: this.name,
          sourceUrl: this.config.url,
          observedAt: recordObservedAt.toISOString(),
          retrievedAt: now.toISOString(),
        },
        timestamp: recordObservedAt,
        observedAt: recordObservedAt,
        retrievedAt: now,
        validFrom: now,
        isMock: false,
      });
    });

    return knowledgeRecords;
  }
}
