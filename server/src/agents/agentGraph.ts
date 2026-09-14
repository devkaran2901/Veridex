import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, Citation, ToolExecutionRecord } from './agentState';
import { getLiveWeather } from '../tools/weatherProvider';
import { getGovernmentData } from '../tools/governmentDataProvider';
import { searchKnowledgeBase } from '../rag/ragService';
import { searchMemory, extractAndSaveMemories } from '../memory/memoryService';
import { invokeLLM } from '../services/llm';
import { io } from '../index';

/**
 * Emit Socket.IO trace step event helper
 */
function emitTraceStep(
  conversationId: string,
  stepName: string,
  toolName?: string,
  status: 'pending' | 'running' | 'completed' | 'failed' = 'completed',
  input?: any,
  output?: any,
  latencyMs?: number
) {
  if (conversationId) {
    io.to(conversationId).emit('agent_step', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      stepName,
      toolName,
      status,
      input,
      output,
      latencyMs,
      timestamp: new Date().toLocaleTimeString(),
    });
  }
}

/**
 * NODE 1: Analyze Query & Select Tools
 */
async function analyzeQueryNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  const query = state.originalQuery.toLowerCase();
  const selectedTools: string[] = [];

  emitTraceStep(state.conversationId, 'Query Analyzed & Intent Recognized', undefined, 'running', { query: state.originalQuery });

  // Intelligent Tool Selection Heuristics
  if (query.includes('weather') || query.includes('rain') || query.includes('temp') || query.includes('forecast')) {
    selectedTools.push('getLiveWeather');
  }
  if (query.includes('flood') || query.includes('government') || query.includes('advisory') || query.includes('ndma') || query.includes('report')) {
    selectedTools.push('getGovernmentData');
    selectedTools.push('searchKnowledgeBase');
  }
  if (query.includes('preference') || query.includes('my') || query.includes('travel') || query.includes('habit') || query.includes('should i')) {
    selectedTools.push('searchMemory');
  }

  // Multi-tool reasoning fallback for open-ended travel decisions
  if (query.includes('should i travel') || query.includes('recommendation') || (selectedTools.length === 0 && query.length > 15)) {
    if (!selectedTools.includes('getLiveWeather')) selectedTools.push('getLiveWeather');
    if (!selectedTools.includes('getGovernmentData')) selectedTools.push('getGovernmentData');
    if (!selectedTools.includes('searchKnowledgeBase')) selectedTools.push('searchKnowledgeBase');
    if (!selectedTools.includes('searchMemory')) selectedTools.push('searchMemory');
  }

  // Extract implicit user preferences if present
  await extractAndSaveMemories(state.originalQuery);

  const latencyMs = Date.now() - startTime;
  emitTraceStep(state.conversationId, `Intent Classified: Required Tools [${selectedTools.join(', ')}]`, undefined, 'completed', { selectedTools }, undefined, latencyMs);

  return {
    selectedTools,
    iterations: state.iterations + 1,
  };
}

/**
 * NODE 2: Execute Selected Tools
 */
async function executeToolsNode(state: AgentState): Promise<Partial<AgentState>> {
  const toolCallsLog: ToolExecutionRecord[] = [...state.toolCallsLog];
  const citations: Citation[] = [...state.citations];
  const evidence: string[] = [...state.evidence];
  let liveData = { ...state.liveData };
  let retrievedDocuments = [...state.retrievedDocuments];
  let retrievedMemories = [...state.retrievedMemories];

  for (const toolName of state.selectedTools) {
    const tStart = Date.now();
    emitTraceStep(state.conversationId, `Executing Tool: ${toolName}`, toolName, 'running', { query: state.originalQuery });

    try {
      if (toolName === 'getLiveWeather') {
        const locMatch = state.originalQuery.match(/in ([a-zA-Z\s]+)/i);
        const targetLoc = locMatch ? locMatch[1].trim() : 'Delhi';
        const weather = await getLiveWeather(targetLoc);
        liveData.weather = weather;
        const latency = Date.now() - tStart;

        toolCallsLog.push({
          toolName,
          input: { location: targetLoc },
          output: weather,
          latencyMs: latency,
          status: 'success',
        });

        evidence.push(`CURRENT WEATHER DATA (${weather.location}): ${weather.condition}, ${weather.temperatureC}°C, Humidity ${weather.humidity}%, Rain probability ${weather.precipitationProb}%. ${weather.advisoryAlert || ''}`);

        citations.push({
          source: weather.source,
          type: 'Live API',
          details: `${weather.location}: ${weather.condition}, ${weather.temperatureC}°C`,
        });

        emitTraceStep(state.conversationId, `✓ Live Weather API Checked (${weather.location})`, toolName, 'completed', { location: targetLoc }, weather, latency);
      } else if (toolName === 'getGovernmentData') {
        const govData = await getGovernmentData('Flood & Transit Alert', 'Delhi');
        liveData.government = govData;
        const latency = Date.now() - tStart;

        toolCallsLog.push({
          toolName,
          input: { topic: 'Flood & Transit Alert' },
          output: govData,
          latencyMs: latency,
          status: 'success',
        });

        evidence.push(`GOVERNMENT ADVISORY (${govData.issuingAuthority}): ${govData.summary} Bulletins: ${govData.bulletins.join(' ')}`);

        citations.push({
          source: govData.source,
          type: 'Live API',
          details: govData.summary,
        });

        emitTraceStep(state.conversationId, `✓ Government Advisory Checked`, toolName, 'completed', { topic: 'Flood & Transit' }, govData, latency);
      } else if (toolName === 'searchKnowledgeBase') {
        const docs = await searchKnowledgeBase(state.originalQuery, 3);
        retrievedDocuments = docs;
        const latency = Date.now() - tStart;

        toolCallsLog.push({
          toolName,
          input: { query: state.originalQuery },
          output: { foundChunks: docs.length, docs },
          latencyMs: latency,
          status: 'success',
        });

        for (const doc of docs) {
          evidence.push(`KNOWLEDGE BASE DOCUMENT (${doc.documentTitle}, Pg ${doc.pageNumber}): ${doc.content}`);
          citations.push({
            source: doc.documentTitle,
            type: 'Document',
            page: doc.pageNumber,
            details: doc.content.slice(0, 100) + '...',
          });
        }

        emitTraceStep(state.conversationId, `✓ RAG Vector Search (${docs.length} chunks retrieved)`, toolName, 'completed', { query: state.originalQuery }, { count: docs.length }, latency);
      } else if (toolName === 'searchMemory') {
        const memories = await searchMemory(state.originalQuery, 3);
        retrievedMemories = memories;
        const latency = Date.now() - tStart;

        toolCallsLog.push({
          toolName,
          input: { query: state.originalQuery },
          output: { memoriesFound: memories.length, memories },
          latencyMs: latency,
          status: 'success',
        });

        for (const mem of memories) {
          evidence.push(`USER LONG-TERM MEMORY (${mem.memoryType.toUpperCase()} PREFERENCE): ${mem.content}`);
          citations.push({
            source: `User Saved Memory (${mem.memoryType})`,
            type: 'Memory',
            details: mem.content,
          });
        }

        emitTraceStep(state.conversationId, `✓ Long-Term Memory Lookup (${memories.length} memories retrieved)`, toolName, 'completed', { query: state.originalQuery }, { count: memories.length }, latency);
      }
    } catch (err: any) {
      console.error(`Tool error [${toolName}]:`, err);
      toolCallsLog.push({
        toolName,
        input: { query: state.originalQuery },
        output: { error: err.message },
        latencyMs: Date.now() - tStart,
        status: 'error',
      });
    }
  }

  return {
    toolCallsLog,
    citations,
    evidence,
    liveData,
    retrievedDocuments,
    retrievedMemories,
  };
}

/**
 * NODE 3: Evaluate Evidence Sufficiency
 */
async function evaluateEvidenceNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  emitTraceStep(state.conversationId, 'Evaluating Retrieved Evidence Sufficiency', undefined, 'running');

  const hasEvidence = state.evidence.length > 0;
  const needsMoreInfo = !hasEvidence && state.iterations < 2;

  const latencyMs = Date.now() - startTime;
  emitTraceStep(
    state.conversationId,
    hasEvidence ? '✓ Evidence Evaluation Complete: Sufficient Context' : '⚠️ Evidence Incomplete',
    undefined,
    'completed',
    { totalEvidenceItems: state.evidence.length },
    { needsMoreInfo },
    latencyMs
  );

  return {
    needsMoreInfo,
  };
}

/**
 * NODE 4: Grounded LLM Synthesis Node
 */
async function synthesizeAnswerNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  emitTraceStep(state.conversationId, 'Synthesizing Grounded Answer & Citations', undefined, 'running');

  const systemPrompt = `You are Veridex, an Agentic Intelligence System with access to Live APIs, Vector RAG Knowledge Base, and User Long-Term Memory.
Answer the user's question accurately using ONLY the retrieved evidence below.

CRITICAL GROUNDING RULES:
1. Clearly distinguish between:
   - CURRENT DATA: Live API information (weather, government advisories).
   - HISTORICAL KNOWLEDGE: Retrieved documents from RAG knowledge base.
   - USER MEMORY: User's saved preferences or habits.
2. Do NOT present user memory as an external fact.
3. Attach clear source citations at the end of factual recommendations.
4. If evidence is empty, state clearly that information is unavailable rather than inventing facts.

RETRIEVED EVIDENCE:
${state.evidence.join('\n\n')}`;

  const formattedMessages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: state.originalQuery },
  ];

  const llmRes = await invokeLLM(formattedMessages);
  const latencyMs = Date.now() - startTime;

  emitTraceStep(state.conversationId, '✓ Grounded Response Synthesized', undefined, 'completed', undefined, { answerLength: llmRes.content.length }, latencyMs);

  return {
    finalAnswer: llmRes.content,
  };
}

/**
 * Routing Condition Edge
 */
function routeEvidenceCondition(state: AgentState) {
  if (state.needsMoreInfo && state.iterations < 2) {
    return 'execute_tools';
  }
  return 'synthesize_answer';
}

/**
 * Compile LangGraph Workflow
 */
const workflow = new StateGraph<AgentState>({
  channels: {
    userId: { value: (x, y) => y ?? x, default: () => '' },
    conversationId: { value: (x, y) => y ?? x, default: () => '' },
    originalQuery: { value: (x, y) => y ?? x, default: () => '' },
    messages: { value: (x, y) => y ?? x, default: () => [] },
    selectedTools: { value: (x, y) => y ?? x, default: () => [] },
    toolCallsLog: { value: (x, y) => y ?? x, default: () => [] },
    retrievedDocuments: { value: (x, y) => y ?? x, default: () => [] },
    retrievedMemories: { value: (x, y) => y ?? x, default: () => [] },
    liveData: { value: (x, y) => y ?? x, default: () => ({}) },
    evidence: { value: (x, y) => y ?? x, default: () => [] },
    citations: { value: (x, y) => y ?? x, default: () => [] },
    finalAnswer: { value: (x, y) => y ?? x, default: () => '' },
    iterations: { value: (x, y) => y ?? x, default: () => 0 },
    needsMoreInfo: { value: (x, y) => y ?? x, default: () => false },
    error: { value: (x, y) => y ?? x, default: () => undefined },
  },
});

workflow.addNode('analyze_query' as any, analyzeQueryNode as any);
workflow.addNode('execute_tools' as any, executeToolsNode as any);
workflow.addNode('evaluate_evidence' as any, evaluateEvidenceNode as any);
workflow.addNode('synthesize_answer' as any, synthesizeAnswerNode as any);

workflow.addEdge(START, 'analyze_query' as any);
workflow.addEdge('analyze_query' as any, 'execute_tools' as any);
workflow.addEdge('execute_tools' as any, 'evaluate_evidence' as any);

workflow.addConditionalEdges('evaluate_evidence' as any, routeEvidenceCondition as any, {
  execute_tools: 'execute_tools' as any,
  synthesize_answer: 'synthesize_answer' as any,
});

workflow.addEdge('synthesize_answer' as any, END);

export const agentGraph = workflow.compile();
