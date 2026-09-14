import { query } from '../database/db';
import { generateEmbedding } from '../services/embedding';
import { config } from '../config/env';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface MemoryItem {
  id: string;
  userId: string;
  memoryType: 'semantic' | 'episodic' | 'preference';
  content: string;
  importance: 'low' | 'medium' | 'high';
  similarity?: number;
  score?: number;
  createdAt: string;
}

/**
 * Save new memory into PostgreSQL pgvector store
 */
export async function saveMemory(
  content: string,
  memoryType: 'semantic' | 'episodic' | 'preference' = 'preference',
  importance: 'low' | 'medium' | 'high' = 'medium',
  metadata: Record<string, any> = {}
): Promise<MemoryItem> {
  // Check for duplicate memory content to avoid redundant memory store bloat
  const existing = await query(
    `SELECT id FROM memories WHERE user_id = $1 AND LOWER(content) = LOWER($2)`,
    [DEFAULT_USER_ID, content.trim()]
  );
  if (existing.rows.length > 0) {
    const fetchExisting = await query(`SELECT * FROM memories WHERE id = $1`, [existing.rows[0].id]);
    return fetchExisting.rows[0];
  }

  const embedding = await generateEmbedding(content);
  const vectorSqlStr = `[${embedding.join(',')}]`;

  const res = await query(
    `INSERT INTO memories (user_id, memory_type, content, importance, metadata, embedding)
     VALUES ($1, $2, $3, $4, $5, $6::vector) RETURNING *`,
    [
      DEFAULT_USER_ID,
      memoryType,
      content.trim(),
      importance,
      JSON.stringify(metadata),
      vectorSqlStr,
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    memoryType: row.memory_type,
    content: row.content,
    importance: row.importance,
    createdAt: row.created_at,
  };
}

/**
 * Search relevant long-term memories using pgvector cosine similarity + importance weighting (FIX #17)
 */
export async function searchMemory(
  queryText: string,
  limit: number = 3
): Promise<MemoryItem[]> {
  try {
    const queryEmbedding = await generateEmbedding(queryText);
    const vectorSqlStr = `[${queryEmbedding.join(',')}]`;

    const sql = `
      SELECT 
        id,
        user_id,
        memory_type,
        content,
        importance,
        created_at,
        1 - (embedding <=> $1::vector) as similarity
      FROM memories
      WHERE user_id = $2
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $3;
    `;

    const result = await query(sql, [vectorSqlStr, DEFAULT_USER_ID, limit]);

    if (result.rows.length === 0 && config.dataMode === 'demo') {
      return getDemoFallbackMemories();
    }

    return result.rows.map((row: any) => {
      const similarity = parseFloat(row.similarity.toFixed(4));
      const weight = row.importance === 'high' ? 1.2 : row.importance === 'low' ? 0.8 : 1.0;
      const finalScore = parseFloat((similarity * weight).toFixed(4));

      return {
        id: row.id,
        userId: row.user_id,
        memoryType: row.memory_type,
        content: row.content,
        importance: row.importance,
        similarity,
        score: finalScore,
        createdAt: row.created_at,
      };
    });
  } catch (err: any) {
    console.warn('⚠️ Memory DB query failed:', err.message);
    if (config.dataMode === 'demo') {
      return getDemoFallbackMemories();
    }
    return [];
  }
}

function getDemoFallbackMemories(): MemoryItem[] {
  return [
    {
      id: 'demo-mem-1',
      userId: DEFAULT_USER_ID,
      memoryType: 'preference',
      content: '[DEMO USER MEMORY] User prefers train travel over driving during adverse weather or heavy rainfall.',
      importance: 'high',
      similarity: 0.92,
      score: 1.1,
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * Extract durable user preferences/facts (FIX #18: Prevent Memory Contamination)
 * Only saves explicit preference declarations, never random conversation or government facts.
 */
export async function extractAndSaveMemories(userMessage: string): Promise<MemoryItem[]> {
  const lower = userMessage.toLowerCase().trim();
  const saved: MemoryItem[] = [];

  // Strictly check for explicit preference statements
  const isExplicitPreference =
    lower.includes('i prefer') ||
    lower.includes('my preference is') ||
    lower.includes('i like to travel by') ||
    lower.includes('remember that i') ||
    lower.startsWith('preference:');

  if (isExplicitPreference) {
    if (lower.includes('train')) {
      const mem = await saveMemory('User prefers train travel over driving during adverse weather', 'preference', 'high');
      saved.push(mem);
    }
    if (lower.includes('avoid') && (lower.includes('rain') || lower.includes('storm'))) {
      const mem = await saveMemory('User prefers avoiding heavy rain and storms during travel', 'preference', 'high');
      saved.push(mem);
    }
    if (lower.includes('concise') || lower.includes('short')) {
      const mem = await saveMemory('User prefers concise and direct answers', 'preference', 'medium');
      saved.push(mem);
    }
  }

  return saved;
}
