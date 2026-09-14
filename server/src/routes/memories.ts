import { Router } from 'express';
import { query } from '../database/db';
import { saveMemory, searchMemory } from '../memory/memoryService';

const router = Router();
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// GET /api/memories - List stored memories
router.get('/', async (_req, res) => {
  try {
    const result = await query(
      'SELECT id, memory_type, content, importance, metadata, created_at FROM memories WHERE user_id = $1 ORDER BY created_at DESC',
      [DEFAULT_USER_ID]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/memories - Add new memory
router.post('/', async (req, res) => {
  try {
    const { content, memoryType, importance } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Memory content string is required' });
    }

    const memory = await saveMemory(
      content,
      memoryType || 'semantic',
      importance || 'medium'
    );

    res.status(201).json({
      message: 'Memory saved successfully into pgvector!',
      memory,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/memories/search - Vector retrieval search over memory store
router.post('/search', async (req, res) => {
  try {
    const { query: queryText, limit } = req.body;
    if (!queryText) {
      return res.status(400).json({ error: 'Search query parameter is required' });
    }

    const memories = await searchMemory(queryText, limit || 3);
    res.json({
      query: queryText,
      count: memories.length,
      memories,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/memories/:id - Delete a memory
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM memories WHERE id = $1 AND user_id = $2', [id, DEFAULT_USER_ID]);
    res.json({ message: 'Memory deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
