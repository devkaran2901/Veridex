import { OpenAIEmbeddings } from '@langchain/openai';
import { config } from '../config/env';

let openaiEmbeddings: OpenAIEmbeddings | null = null;

if (config.openaiApiKey && config.openaiApiKey !== 'mock-key' && config.openaiApiKey !== 'your_openai_api_key_here') {
  openaiEmbeddings = new OpenAIEmbeddings({
    openAIApiKey: config.openaiApiKey,
    modelName: 'text-embedding-3-small',
  });
}

/**
 * Generate 1536-dimensional vector embedding for a given text string.
 * Uses OpenAI text-embedding-3-small when API key is valid.
 * Falls back to a deterministic normalized 1536-dim mock vector when offline or using mock keys.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (openaiEmbeddings) {
    try {
      const vector = await openaiEmbeddings.embedQuery(text);
      return vector;
    } catch (err) {
      console.warn('⚠️ OpenAI Embedding API call failed, falling back to mock vector:', err);
    }
  }

  // Deterministic 1536-dimension mock vector generator based on text hashing
  const dimensions = 1536;
  const vector: number[] = new Array(dimensions);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    // Generate pseudo-random value between -1 and 1
    const pseudoVal = Math.sin(hash + i * 0.1);
    vector[i] = pseudoVal;
    sumSq += pseudoVal * pseudoVal;
  }

  // Normalize vector to unit length
  const norm = Math.sqrt(sumSq) || 1;
  return vector.map((v) => v / norm);
}
