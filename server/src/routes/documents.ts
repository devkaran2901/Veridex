import { Router } from 'express';
import multer from 'multer';
import { query } from '../database/db';
import { processAndIndexDocument, searchKnowledgeBase } from '../rag/ragService';

const router = Router();
const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain' ||
      file.originalname.endsWith('.pdf') ||
      file.originalname.endsWith('.txt')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT document formats are allowed.'));
    }
  },
});

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// GET /api/documents - List indexed documents
router.get('/', async (_req, res) => {
  try {
    const result = await query(
      'SELECT id, title, filename, file_type, file_size, chunk_count, status, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC',
      [DEFAULT_USER_ID]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/documents/upload - Upload and index document
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    const { originalname, mimetype, size, buffer } = req.file;

    const indexedDoc = await processAndIndexDocument(buffer, originalname, mimetype, size);

    res.status(201).json({
      message: 'Document uploaded and indexed successfully into pgvector!',
      document: indexedDoc,
    });
  } catch (error: any) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to process document' });
  }
});

// POST /api/documents/search - Test vector similarity search
router.post('/search', async (req, res) => {
  try {
    const { query: queryText, limit } = req.body;
    if (!queryText) {
      return res.status(400).json({ error: 'Search query parameter is required' });
    }

    const chunks = await searchKnowledgeBase(queryText, limit || 3);
    res.json({
      query: queryText,
      resultsCount: chunks.length,
      chunks,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/documents/:id - Delete document and cascading chunks
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM documents WHERE id = $1 AND user_id = $2', [id, DEFAULT_USER_ID]);
    res.json({ message: 'Document deleted successfully from pgvector' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
