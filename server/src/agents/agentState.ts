import { BaseMessage } from '@langchain/core/messages';
import { SearchResultChunk } from '../rag/ragService';
import { MemoryItem } from '../memory/memoryService';
import { DatasetMetadata } from '../ingestion/types';

export interface Citation {
  source: string;
  type: 'Live Knowledge' | 'Live API' | 'Document' | 'Memory' | 'Database';
  datasetId?: string;
  observedAt?: string;
  page?: number;
  details?: string;
  isMock?: boolean;
}

export interface ToolExecutionRecord {
  toolName: string;
  input: any;
  output: any;
  latencyMs: number;
  status: 'success' | 'error';
}

export interface RetrievalPlan {
  needsLiveKnowledge: boolean;
  needsStaticRag: boolean;
  needsMemory: boolean;
  needsStructuredQuery: boolean;
  needsDatasetDiscovery: boolean;
  timeScope: 'current' | 'recent' | 'historical' | 'comparison';
  retrievalMode: 'semantic' | 'structured' | 'hybrid' | 'comparison';
  location?: string;
  topic?: string;
  structuredQueryParams?: {
    metric?: string;
    district?: string;
    aggregate?: 'MAX' | 'MIN' | 'AVG';
  };
  rationale: string;
}

export interface AgentState {
  userId: string;
  conversationId: string;
  originalQuery: string;
  messages: BaseMessage[];
  retrievalPlan?: RetrievalPlan;
  selectedTools: string[];
  toolCallsLog: ToolExecutionRecord[];
  discoveredDatasets: DatasetMetadata[];
  retrievedDocuments: SearchResultChunk[];
  retrievedMemories: MemoryItem[];
  liveData: Record<string, any>;
  evidence: string[];
  citations: Citation[];
  finalAnswer: string;
  iterations: number;
  needsMoreInfo: boolean;
  error?: string;
}
