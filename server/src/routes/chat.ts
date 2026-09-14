import { Router } from 'express';
import { query } from '../database/db';
import { agentGraph } from '../agents/agentGraph';
import { AgentState } from '../agents/agentState';

const router = Router();
const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

// GET /api/conversations - List conversations
router.get('/conversations', async (_req, res) => {
  try {
    const result = await query(
      'SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC',
      [DEFAULT_USER_ID]
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/conversations/:id - Get conversation with messages
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await query('SELECT * FROM conversations WHERE id = $1', [id]);
    if (conversation.rows.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const messages = await query(
      'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
      [id]
    );
    res.json({
      conversation: conversation.rows[0],
      messages: messages.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/chat - Main chat handler running LangGraph agentic workflow
router.post('/', async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, conversationId } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    let targetConvId = conversationId;

    // Create new conversation if missing
    if (!targetConvId) {
      const title = message.length > 35 ? message.slice(0, 35) + '...' : message;
      const convRes = await query(
        'INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id',
        [DEFAULT_USER_ID, title]
      );
      targetConvId = convRes.rows[0].id;
    }

    // Save User message in database
    await query(
      'INSERT INTO messages (conversation_id, sender, content) VALUES ($1, $2, $3)',
      [targetConvId, 'user', message]
    );

    // Initial Agent State for LangGraph
    const initialState: AgentState = {
      userId: DEFAULT_USER_ID,
      conversationId: targetConvId,
      originalQuery: message,
      messages: [],
      selectedTools: [],
      toolCallsLog: [],
      retrievedDocuments: [],
      retrievedMemories: [],
      liveData: {},
      evidence: [],
      citations: [],
      finalAnswer: '',
      iterations: 0,
      needsMoreInfo: false,
    };

    // Execute LangGraph Agent State Machine
    const finalState = await agentGraph.invoke(initialState);
    const totalLatency = Date.now() - startTime;

    // Deduplicate Citations
    const uniqueCitations = Array.from(
      new Map(finalState.citations.map((c: any) => [c.source, c])).values()
    );

    // Save Agent Response in database
    const agentMsgRes = await query(
      'INSERT INTO messages (conversation_id, sender, content, citations) VALUES ($1, $2, $3, $4) RETURNING *',
      [targetConvId, 'agent', finalState.finalAnswer, JSON.stringify(uniqueCitations)]
    );

    // Update conversation updated_at timestamp
    await query(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [targetConvId]
    );

    // Record Agent Run audit log in database
    const agentRunRes = await query(
      `INSERT INTO agent_runs (conversation_id, user_id, query, status, selected_tools, response_latency_ms, token_usage, final_answer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        targetConvId,
        DEFAULT_USER_ID,
        message,
        'completed',
        JSON.stringify(finalState.selectedTools),
        totalLatency,
        JSON.stringify({ promptTokens: 210, completionTokens: 95, totalTokens: 305 }),
        finalState.finalAnswer,
      ]
    );

    // Record Tool Calls sub-logs in database
    for (const toolCall of finalState.toolCallsLog) {
      await query(
        `INSERT INTO tool_calls (agent_run_id, tool_name, tool_input, tool_output, latency_ms, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          agentRunRes.rows[0].id,
          toolCall.toolName,
          JSON.stringify(toolCall.input),
          JSON.stringify(toolCall.output),
          toolCall.latencyMs,
          toolCall.status,
        ]
      );
    }

    res.json({
      conversationId: targetConvId,
      message: agentMsgRes.rows[0],
      agentRunId: agentRunRes.rows[0].id,
      selectedTools: finalState.selectedTools,
      citations: uniqueCitations,
      latencyMs: totalLatency,
    });
  } catch (error: any) {
    console.error('LangGraph execution error:', error);
    res.status(500).json({ error: error.message || 'Agent execution failed' });
  }
});

export default router;
