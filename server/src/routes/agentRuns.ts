import { Router } from 'express';
import { query } from '../database/db';

const router = Router();
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// GET /api/agent-runs - List past agent execution runs
router.get('/', async (_req, res) => {
  try {
    const result = await query(
      'SELECT * FROM agent_runs WHERE user_id = $1 ORDER BY created_at DESC',
      [DEFAULT_USER_ID]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/agent-runs/:id - Get detailed agent run with tool calls
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const runRes = await query('SELECT * FROM agent_runs WHERE id = $1', [id]);
    if (runRes.rows.length === 0) {
      return res.status(404).json({ error: 'Agent run not found' });
    }
    const toolCallsRes = await query(
      'SELECT * FROM tool_calls WHERE agent_run_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json({
      run: runRes.rows[0],
      toolCalls: toolCallsRes.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
