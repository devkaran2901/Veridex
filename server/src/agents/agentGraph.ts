import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, Citation, ToolExecutionRecord } from './agentState';
import { getLiveWeather } from '../tools/weatherProvider';
import { getGovernmentData } from '../tools/governmentDataProvider';
import { searchKnowledgeBase } from '../rag/ragService';
import { searchLiveKnowledgeBase, parseTimeScope } from '../rag/hybridRetrieval';
import { discoverDatasets } from '../ingestion/discovery/datasetRegistry';
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
 * NODE 1: Analyze Query & Discover Government Datasets
 */
async function analyzeQueryNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  const query = state.originalQuery.toLowerCase();
  const selectedTools: string[] = [];

  emitTraceStep(state.conversationId, 'Query Analyzed & Temporal Intent Recognized', undefined, 'running', { query: state.originalQuery });

  const timeScope = parseTimeScope(query);

  // 1. Government Dataset Discovery Component (FIX #3)
  const discoveredDatasets = await discoverDatasets(query);
  emitTraceStep(
    state.conversationId,
    `Discovered ${discoveredDatasets.length} Government Datasets (${discoveredDatasets.map((d) => d.name).join(', ')})`,
    'discoverGovernmentDatasets',
    'completed',
    { query, timeScope },
    { datasets: discoveredDatasets }
  );


  // 2. Intelligent Tool Selection
  selectedTools.push('searchLiveKnowledgeBase');

  if (query.includes('weather') || query.includes('rain') || query.includes('temp') || query.includes('forecast')) {
    selectedTools.push('getLiveWeather');
  }
  if (query.includes('flood') || query.includes('government') || query.includes('advisory') || query.includes('report') || query.includes('pdf')) {
    selectedTools.push('getGovernmentData');
    selectedTools.push('searchKnowledgeBase');
  }
  if (query.includes('preference') || query.includes('my') || query.includes('travel') || query.includes('habit') || query.includes('should i')) {
    selectedTools.push('searchMemory');
  }

  // Extract implicit user preferences
  await extractAndSaveMemories(state.originalQuery);

  const latencyMs = Date.now() - startTime;
  emitTraceStep(
    state.conversationId,
    `Tools Selected: [${selectedTools.join(', ')}] | Time Scope: ${timeScope.toUpperCase()}`,
    undefined,
    'completed',
    { selectedTools, timeScope },
    undefined,
    latencyMs
  );

  return {
    selectedTools,
    iterations: state.iterations + 1,
  };
}

/**
 * NODE 2: Execute Knowledge Retrieval & Tools
 */
async function executeToolsNode(state: AgentState): Promise<Partial<AgentState>> {
  const toolCallsLog: ToolExecutionRecord[] = [...state.toolCallsLog];
  const citations: Citation[] = [...state.citations];
  const evidence: string[] = [...state.evidence];
  let liveData = { ...state.liveData };
  let retrievedDocuments = [...state.retrievedDocuments];
  let retrievedMemories = [...state.retrievedMemories];

  const timeScope = parseTimeScope(state.originalQuery);

  for (const toolName of state.selectedTools) {
    const tStart = Date.now();
    emitTraceStep(state.conversationId, `Executing Tool: ${toolName}`, toolName, 'running', { query: state.originalQuery });

    try {
      if (toolName === 'searchLiveKnowledgeBase') {
        // Hybrid Freshness-Aware Vector & SQL Search over PostgreSQL knowledge_records
        const records = await searchLiveKnowledgeBase(state.originalQuery, { timeScope, limit: 4 });
        const latency = Date.now() - tStart;

        toolCallsLog.push({
          toolName,
          input: { query: state.originalQuery, timeScope },
          output: { foundRecords: records.length, records },
          latencyMs: latency,
          status: 'success',
        });

        for (const rec of records) {
          const freshTag = rec.isFresh ? '🟢 FRESH' : '🟡 HISTORICAL';
          evidence.push(
            `LIVE KNOWLEDGE LAYER [${freshTag} - ${rec.ageString}] (${rec.source}): ${rec.content} (Hybrid Score: ${rec.hybridScore})`
          );
          citations.push({
            source: `${rec.source} (${rec.ageString})`,
            type: 'Live API',
            details: rec.content,
          });
        }

        emitTraceStep(
          state.conversationId,
          `✓ Hybrid Live Knowledge Retrieved (${records.length} records, Top Score: ${records[0]?.hybridScore || 0})`,
          toolName,
          'completed',
          { query: state.originalQuery, timeScope },
          { count: records.length, records },
          latency
        );
      } else if (toolName === 'getLiveWeather') {
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

        evidence.push(
          `LIVE API FEED (${weather.location}): ${weather.condition}, ${weather.temperatureC}°C, Humidity ${weather.humidity}%, Rain probability ${weather.precipitationProb}%. ${weather.advisoryAlert || ''}`
        );

        citations.push({
          source: weather.source,
          type: 'Live API',
          details: `${weather.location}: ${weather.condition}, ${weather.temperatureC}°C`,
        });

        emitTraceStep(state.conversationId, `✓ Live Weather Checked (${weather.location})`, toolName, 'completed', { location: targetLoc }, weather, latency);
      } else if (toolName === 'getGovernmentData') {
        const govData = await getGovernmentData('Flood & Transit Advisory', 'Delhi');
        liveData.government = govData;
        const latency = Date.now() - tStart;

        toolCallsLog.push({
          toolName,
          input: { topic: 'Flood & Transit Advisory' },
          output: govData,
          latencyMs: latency,
          status: 'success',
        });

        evidence.push(`GOVERNMENT ADVISORY BULLETIN (${govData.issuingAuthority}): ${govData.summary} Directives: ${govData.bulletins.join(' ')}`);

        citations.push({
          source: govData.source,
          type: 'Live API',
          details: govData.summary,
        });

        emitTraceStep(state.conversationId, `✓ Government Advisory Bulletin Checked`, toolName, 'completed', { topic: 'Flood & Transit' }, govData, latency);
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
          evidence.push(`STATIC KNOWLEDGE DOCUMENT (${doc.documentTitle}, Pg ${doc.pageNumber}): ${doc.content}`);
          citations.push({
            source: doc.documentTitle,
            type: 'Document',
            page: doc.pageNumber,
            details: doc.content.slice(0, 100) + '...',
          });
        }

        emitTraceStep(state.conversationId, `✓ Static Document Vector Search (${docs.length} chunks)`, toolName, 'completed', { query: state.originalQuery }, { count: docs.length }, latency);
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

        emitTraceStep(state.conversationId, `✓ Long-Term Memory Lookup (${memories.length} memories)`, toolName, 'completed', { query: state.originalQuery }, { count: memories.length }, latency);
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
  emitTraceStep(state.conversationId, 'Evaluating Retrieved Evidence Sufficiency & Freshness', undefined, 'running');

  const hasEvidence = state.evidence.length > 0;
  const needsMoreInfo = !hasEvidence && state.iterations < 2;

  const latencyMs = Date.now() - startTime;
  emitTraceStep(
    state.conversationId,
    hasEvidence ? '✓ Evidence Evaluation Complete: Sufficient Context' : '⚠️ Context Incomplete',
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

  const systemPrompt = `You are Veridex, an Agentic Intelligence System operating over a Continuously Updated Live Knowledge Layer (IMD weather feeds, data.gov.in datasets, NDMA guidelines) and User Long-Term Memory.
Answer the user's question accurately using ONLY the retrieved evidence below.

CRITICAL GROUNDING RULES:
1. Clearly distinguish between:
   - LIVE KNOWLEDGE LAYER: Ingested government API feeds and datasets (include freshness tags like "Updated 10m ago").
   - STATIC KNOWLEDGE: Uploaded PDF/TXT documents.
   - USER MEMORY: Saved user travel or communication preferences.
2. Do NOT present user memory as an external fact.
3. Attach clear source citations at the end of factual recommendations.
4. If evidence is empty, state clearly that information is unavailable.

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
