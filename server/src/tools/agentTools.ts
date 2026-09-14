import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getLiveWeather } from './weatherProvider';
import { getGovernmentData, getCurrentTime } from './governmentDataProvider';
import { searchKnowledgeBase } from '../rag/ragService';
import { searchMemory, saveMemory } from '../memory/memoryService';
import { query } from '../database/db';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Weather API Tool Definition
 */
export const weatherTool = new DynamicStructuredTool({
  name: 'getLiveWeather',
  description: 'Fetch current weather data, temperature, humidity, rainfall probability, and severe weather advisories for a specified city or location.',
  schema: z.object({
    location: z.string().describe('The city or region name, e.g. "Delhi", "Mumbai"'),
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
  description: 'Fetch official government disaster advisories, flood warnings, and transit bulletins for a topic or location.',
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
 * RAG Knowledge Base Search Tool Definition
 */
export const ragTool = new DynamicStructuredTool({
  name: 'searchKnowledgeBase',
  description: 'Perform semantic vector similarity search over uploaded PDF and TXT documents in the RAG Knowledge Base.',
  schema: z.object({
    query: z.string().describe('The specific search query or keywords to look up in government/disaster documents'),
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
  description: 'Retrieve user-specific long-term preferences, habits, and past decisions stored in PostgreSQL pgvector memory.',
  schema: z.object({
    query: z.string().describe('Search query regarding user preferences, travel habits, or past decisions'),
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
  description: 'Perform safe controlled analytical queries over the application PostgreSQL database stats (documents count, memories count, conversations count).',
  schema: z.object({
    queryType: z.enum(['stats', 'recent_documents', 'memories_count']).describe('Category of stats query'),
  }),
  func: async ({ queryType }) => {
    if (queryType === 'stats') {
      const docCount = await query('SELECT COUNT(*) FROM documents WHERE user_id = $1', [DEFAULT_USER_ID]);
      const memCount = await query('SELECT COUNT(*) FROM memories WHERE user_id = $1', [DEFAULT_USER_ID]);
      const convCount = await query('SELECT COUNT(*) FROM conversations WHERE user_id = $1', [DEFAULT_USER_ID]);

      return JSON.stringify({
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
  weatherTool,
  govDataTool,
  ragTool,
  memorySearchTool,
  memorySaveTool,
  dbQueryTool,
  currentTimeTool,
];
