export interface KnowledgeRecordInput {
  source: string;
  sourceType: 'api_feed' | 'dataset' | 'document' | 'web';
  datasetId: string;
  title: string;
  content: string;
  structuredData?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp?: Date;
  observedAt?: Date;
  retrievedAt?: Date;
  validFrom?: Date;
  validUntil?: Date;
  isMock?: boolean;
}

export interface KnowledgeRecord extends KnowledgeRecordInput {
  id: string;
  version: number;
  contentHash: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetMetadata {
  id: string;
  name: string;
  source: string;
  publisher?: string;
  description: string;
  category: 'weather' | 'disaster' | 'rainfall' | 'agriculture' | 'water' | 'general';
  apiAvailable: boolean;
  schema?: string[];
  geography?: string;
  geographicCoverage?: string;
  temporalCoverage?: string;
  updateFrequency?: string;
  lastUpdated?: string;
  sourceUrl?: string;
  lastSyncedAt?: Date;
  recordCount: number;
  isMock?: boolean;
}

export interface GovernmentDataProvider {
  id: string;
  name: string;
  source: string;
  publisher?: string;
  description: string;
  category: 'weather' | 'disaster' | 'rainfall' | 'agriculture' | 'water' | 'general';
  isMock?: boolean;
  searchDatasets(query: string): Promise<DatasetMetadata[]>;
  getDatasetMetadata(datasetId: string): Promise<DatasetMetadata | null>;
  fetchDataset(datasetId: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]>;
  fetchLatestData(datasetId?: string, options?: Record<string, any>): Promise<KnowledgeRecordInput[]>;
}

export type DatasetProvider = GovernmentDataProvider;


