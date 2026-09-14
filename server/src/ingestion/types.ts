export interface KnowledgeRecordInput {
  source: string;
  sourceType: 'api_feed' | 'dataset' | 'document' | 'web';
  datasetId: string;
  title: string;
  content: string;
  structuredData?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp?: Date;
  validFrom?: Date;
  validUntil?: Date;
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
  description: string;
  category: 'weather' | 'disaster' | 'rainfall' | 'agriculture' | 'general';
  lastSyncedAt?: Date;
  recordCount: number;
}

export interface DatasetProvider {
  id: string;
  name: string;
  source: string;
  description: string;
  fetchLatestData(): Promise<KnowledgeRecordInput[]>;
}
