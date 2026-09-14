import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getLiveWeather } from './weatherProvider';
import { getGovernmentData, getCurrentTime } from './governmentDataProvider';
import { searchKnowledgeBase } from '../rag/ragService';
import { searchLiveKnowledgeBase } from '../rag/hybridRetrieval';
import { discoverDatasets } from '../ingestion/discovery/datasetRegistry';
import { runIngestionPipeline } from '../ingestion/ingestionPipeline';
import { searchMemory, saveMemory } from '../memory/memoryService';
import { query } from '../database/db';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Government Dataset Discovery Tool Definition
 */
export const datasetDiscoveryTool = new DynamicStructuredTool({
  name: 'discoverGovernmentDatasets',
  description: 'Search and discover available Indian government datasets (IMD weather, data.gov.in rainfall statistics, NDMA disaster guidelines).',
  schema: z.object({
    query: z.string().describe('Search query regarding weather, rainfall, or government datasets'),
  }),
  func: async ({ query: queryText }) => {
    const datasets = discoverDatasets(queryText);
    return JSON.stringify(datasets);
  },
});

/**
 * Hybrid Freshness-Aware Live Knowledge Base Search Tool Definition
 */
export const liveKnowledgeSearchTool = new DynamicStructuredTool({
  name: 'searchLiveKnowledgeBase',
  description: 'Perform hybrid freshness-aware vector and structured SQL search over continuously ingested live government knowledge records.',
  schema: z.object({
    query: z.string().describe('The user question or search topic'),
    timeScope: z.enum(['current', 'recent', 'historical']).optional().describe('Temporal scope'),
    mode: z.enum(['semantic', 'structured', 'hybrid']).optional().describe('Retrieval mode'),
  }),
  func: async ({ query: queryText, timeScope, mode }) => {
    const results = await searchLiveKnowledgeBase(queryText, { timeScope, mode, limit: 4 });
    return JSON.stringify(results);
  },
});

/**
 * Live Ingestion Trigger Tool Definition
 */
export const triggerIngestionTool = new DynamicStructuredTool({
  name: 'triggerLiveIngestion',
  description: 'Trigger on-demand ingestion sync for government API feeds (fetches, normalizes, deduplicates via SHA-256, and embeds into pgvector).',
  schema: z.object({
    datasetId: z.string().optional().describe('Specific dataset ID to sync, or empty for all datasets'),
  }),
  func: async ({ datasetId }) => {
    const report = await runIngestionPipeline(datasetId);
    return JSON.stringify(report);
  },
});

/**
 * Weather API Tool Definition
 */
export const weatherTool = new DynamicStructuredTool({
  name: 'getLiveWeather',
  description: 'Fetch current weather data, temperature, humidity, rainfall probability, and severe weather advisories for a specified location.',
  schema: z.object({
    location: z.string().describe('The city or region name, e.g. "Delhi", "Jalandhar"'),
  }),
  func: async ({ location }) => {
    const data = await getLiveWeather(location);
    return JSON.stringify(data);
  },
});

/**
 * Government Data Advisory Tool Definition
 */
export const govDataTool = new DynamicStructuredTool({
  name: 'getGovernmentData',
  description: 'Fetch official government disaster advisories, flood warnings, and transit bulletins.',
  schema: z.object({
    topic: z.string().describe('The advisory subject, e.g., "flood management", "weather alert"'),
    location: z.string().optional().describe('Target city or region, e.g., "Delhi"'),
  }),
  func: async ({ topic, location }) => {
    const data = await getGovernmentData(topic, location || 'National');
    return JSON.stringify(data);
  },
});

/**
 * Static Document Knowledge Base Search Tool Definition
 */
export const ragTool = new DynamicStructuredTool({
  name: 'searchKnowledgeBase',
  description: 'Perform vector similarity search over uploaded static PDF and TXT documents.',
  schema: z.object({
    query: z.string().describe('Search query for static PDF/TXT documents'),
  }),
  func: async ({ query: queryText }) => {
    const results = await searchKnowledgeBase(queryText, 3);
    return JSON.stringify(results);
  },
});

/**
 * Long-Term Memory Search Tool Definition
 */
export const memorySearchTool = new DynamicStructuredTool({
  name: 'searchMemory',
  description: 'Retrieve user-specific long-term preferences, habits, and past decisions stored in vector memory.',
  schema: z.object({
    query: z.string().describe('Search query regarding user preferences or past decisions'),
  }),
  func: async ({ query: queryText }) => {
    const results = await searchMemory(queryText, 3);
    return JSON.stringify(results);
  },
});

/**
 * Save Long-Term Memory Tool Definition
 */
export const memorySaveTool = new DynamicStructuredTool({
  name: 'saveMemory',
  description: 'Save a new user preference, habit, or important fact into long-term vector memory.',
  schema: z.object({
    content: z.string().describe('The preference or fact string to remember'),
    memoryType: z.enum(['preference', 'semantic', 'episodic']).optional().describe('Type of memory'),
  }),
  func: async ({ content, memoryType }) => {
    const res = await saveMemory(content, memoryType || 'preference', 'high');
    return JSON.stringify({ status: 'saved', memory: res });
  },
});

/**
 * Controlled Safe Database Query Tool Definition
 */
export const dbQueryTool = new DynamicStructuredTool({
  name: 'queryDatabase',
  description: 'Perform safe controlled analytical queries over database stats (documents count, knowledge records count, memories count).',
  schema: z.object({
    queryType: z.enum(['stats', 'recent_documents', 'memories_count']).describe('Category of stats query'),
  }),
  func: async ({ queryType }) => {
    if (queryType === 'stats') {
      const recCount = await query('SELECT COUNT(*) FROM knowledge_records');
      const docCount = await query('SELECT COUNT(*) FROM documents WHERE user_id = $1', [DEFAULT_USER_ID]);
      const memCount = await query('SELECT COUNT(*) FROM memories WHERE user_id = $1', [DEFAULT_USER_ID]);
      const convCount = await query('SELECT COUNT(*) FROM conversations WHERE user_id = $1', [DEFAULT_USER_ID]);

      return JSON.stringify({
        knowledgeRecordsCount: parseInt(recCount.rows[0].count, 10),
        documentsCount: parseInt(docCount.rows[0].count, 10),
        memoriesCount: parseInt(memCount.rows[0].count, 10),
        conversationsCount: parseInt(convCount.rows[0].count, 10),
      });
    }

    return JSON.stringify({ result: 'Query completed' });
  },
});

/**
 * Current System Time Tool Definition
 */
export const currentTimeTool = new DynamicStructuredTool({
  name: 'getCurrentTime',
  description: 'Fetch current date, day, time, and timezone information.',
  schema: z.object({}),
  func: async () => {
    return JSON.stringify({ currentTime: getCurrentTime() });
  },
});

export const ALL_AGENT_TOOLS = [
  datasetDiscoveryTool,
  liveKnowledgeSearchTool,
  triggerIngestionTool,
  weatherTool,
  govDataTool,
  ragTool,
  memorySearchTool,
  memorySaveTool,
  dbQueryTool,
  currentTimeTool,
];
