import pdfParse from 'pdf-parse';
import { query } from '../database/db';
import { generateEmbedding } from '../services/embedding';
import { chunkText } from './chunker';

import { config } from '../config/env';

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface SearchResultChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  source: string;
  content: string;
  pageNumber?: number;
  similarity: number;
}

/**
 * Extract raw text from PDF or TXT buffer
 */
export async function extractTextFromFile(buffer: Buffer, fileType: string): Promise<string> {
  if (fileType.includes('pdf') || fileType.endsWith('.pdf')) {
    const pdfData = await pdfParse(buffer);
    return pdfData.text;
  }
  return buffer.toString('utf-8');
}

/**
 * Process document upload: Extract -> Chunk -> Embed -> Insert into pgvector
 */
export async function processAndIndexDocument(
  fileBuffer: Buffer,
  filename: string,
  fileType: string,
  fileSize: number
) {
  const title = filename.replace(/\.[^/.]+$/, '');
  
  // 1. Create document record in PostgreSQL
  const docRes = await query(
    `INSERT INTO documents (user_id, title, filename, file_type, file_size, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [DEFAULT_USER_ID, title, filename, fileType, fileSize, 'indexing']
  );
  const documentId = docRes.rows[0].id;

  try {
    // 2. Text Extraction
    const rawText = await extractTextFromFile(fileBuffer, fileType);

    if (!rawText.trim()) {
      throw new Error('Extracted text is empty or unreadable');
    }

    // 3. Chunking
    const chunks = chunkText(rawText, { chunkSize: 500, chunkOverlap: 50 }, { title, source: filename });

    // 4. Embedding Generation & Database Insert
    for (const chunk of chunks) {
      const embedding = await generateEmbedding(chunk.content);
      const vectorSqlStr = `[${embedding.join(',')}]`;

      await query(
        `INSERT INTO document_chunks (document_id, chunk_index, content, metadata, embedding)
         VALUES ($1, $2, $3, $4, $5::vector)`,
        [
          documentId,
          chunk.chunkIndex,
          chunk.content,
          JSON.stringify(chunk.metadata),
          vectorSqlStr,
        ]
      );
    }

    // 5. Update document status
    await query(
      `UPDATE documents SET status = 'indexed', chunk_count = $1 WHERE id = $2`,
      [chunks.length, documentId]
    );

    return {
      documentId,
      title,
      chunkCount: chunks.length,
      status: 'indexed',
    };
  } catch (error: any) {
    console.error(`❌ Failed to index document ${filename}:`, error);
    await query(`UPDATE documents SET status = 'failed' WHERE id = $1`, [documentId]);
    throw error;
  }
}

/**
 * Semantic Vector Search over indexed document chunks using pgvector cosine distance
 */
export async function searchKnowledgeBase(
  queryText: string,
  limit: number = 3
): Promise<SearchResultChunk[]> {
  const queryEmbedding = await generateEmbedding(queryText);
  const vectorSqlStr = `[${queryEmbedding.join(',')}]`;

  // pgvector Cosine similarity: 1 - (embedding <=> queryVector)
  const sql = `
    SELECT 
      c.id as chunk_id,
      c.document_id,
      c.content,
      c.metadata,
      d.title as document_title,
      d.filename as source,
      1 - (c.embedding <=> $1::vector) as similarity
    FROM document_chunks c
    JOIN documents d ON c.document_id = d.id
    WHERE d.status = 'indexed'
    ORDER BY c.embedding <=> $1::vector ASC
    LIMIT $2;
  `;

  try {
    const result = await query(sql, [vectorSqlStr, limit]);

    return result.rows.map((row: any) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      source: row.source,
      content: row.content,
      pageNumber: row.metadata?.pageNumber || 1,
      similarity: parseFloat(row.similarity.toFixed(4)),
    }));
  } catch (err: any) {
    console.warn('⚠️ Knowledge base DB query failed:', err.message);
    if (config.dataMode === 'demo') {
      return [
        {
          chunkId: 'mock-chunk-1',
          documentId: 'mock-doc-1',
          documentTitle: '[MOCK / DEMO] Government Disaster Management Guidelines.pdf',
          source: 'Government Advisory Report (Demo)',
          content: '[DEMO FALLBACK RECORD] Heavy rainfall and urban flooding cause significant transportation delays. Commuters are advised to restrict movement during severe weather alerts.',
          pageNumber: 17,
          similarity: 0.89,
        },
      ];
    }
    return [];
  }
}
