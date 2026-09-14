import { BaseMessage } from '@langchain/core/messages';
import { SearchResultChunk } from '../rag/ragService';
import { MemoryItem } from '../memory/memoryService';

export interface Citation {
  source: string;
  type: 'Live API' | 'Document' | 'Memory' | 'Database';
  page?: number;
  details?: string;
}

export interface ToolExecutionRecord {
  toolName: string;
  input: any;
  output: any;
  latencyMs: number;
  status: 'success' | 'error';
}

export interface AgentState {
  userId: string;
  conversationId: string;
  originalQuery: string;
  messages: BaseMessage[];
  selectedTools: string[];
  toolCallsLog: ToolExecutionRecord[];
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
