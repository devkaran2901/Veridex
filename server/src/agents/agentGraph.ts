import { StateGraph, END, START } from '@langchain/langgraph';
import { AgentState, Citation, RetrievalPlan, ToolExecutionRecord } from './agentState';
import { searchKnowledgeBase } from '../rag/ragService';
import { searchLiveKnowledgeBase, parseTimeScope } from '../rag/hybridRetrieval';
import { discoverDatasets } from '../ingestion/discovery/datasetRegistry';
import { searchMemory } from '../memory/memoryService';
import { invokeLLM } from '../services/llm';
import { config } from '../config/env';
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
    try {
      io?.to?.(conversationId)?.emit('agent_step', {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        stepName,
        toolName,
        status,
        input,
        output,
        latencyMs,
        timestamp: new Date().toLocaleTimeString(),
      });
    } catch (e) {
      // Ignore socket errors in CLI evaluation mode
    }
  }
}

/**
 * LLM Structured Retrieval Planner (FIX #5 & FIX #6 & FIX #8)
 */
export async function generateRetrievalPlan(queryText: string): Promise<RetrievalPlan> {
  const detectedScope = parseTimeScope(queryText);
  const q = queryText.toLowerCase();

  const plannerSystemPrompt = `You are the Retrieval Planner for Veridex, an Agentic RAG System over a Continuously Updated Live Knowledge Layer and User Long-Term Memory.
Analyze the user's query and generate a structured JSON retrieval plan specifying which knowledge layers must be searched.

ROUTING & INTENT RULES:
1. "needsLiveKnowledge": Set TRUE for ALL queries asking about weather, rainfall, precipitation, climate, temperature, district statistics, advisories, or government observations — REGARDLESS of timeScope (whether current, recent, historical, or comparison), because all observational data is indexed in the Knowledge Layer (knowledge_records).
2. "needsStaticRag": Set true if query asks about general government guidelines, PDF policy reports, or static documentation.
3. "needsMemory": Set true ONLY IF the query asks about user preferences, personal habits, travel choices ("my preferences", "should I travel given my preferences", etc.). Do NOT enable for generic queries like "What is today's rainfall?".
4. "needsDatasetDiscovery": Set true if query asks about available government datasets, statistics, or open catalog data.
5. "timeScope": Choose from "current", "recent", "historical", or "comparison". Use "comparison" for questions like "what changed since yesterday?".
6. "retrievalMode": Choose from "semantic", "structured" (for district rainfall ranking / numerical max/min), "hybrid", or "comparison".

Output ONLY valid JSON matching this schema:
{
  "needsLiveKnowledge": boolean,
  "needsStaticRag": boolean,
  "needsMemory": boolean,
  "needsStructuredQuery": boolean,
  "needsDatasetDiscovery": boolean,
  "timeScope": "current" | "recent" | "historical" | "comparison",
  "retrievalMode": "semantic" | "structured" | "hybrid" | "comparison",
  "location": "string or null",
  "topic": "string or null",
  "rationale": "string"
}`;

  try {
    const response = await invokeLLM([
      { role: 'system', content: plannerSystemPrompt },
      { role: 'user', content: queryText },
    ]);

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        needsLiveKnowledge: Boolean(parsed.needsLiveKnowledge),
        needsStaticRag: Boolean(parsed.needsStaticRag),
        needsMemory: Boolean(parsed.needsMemory),
        needsStructuredQuery: Boolean(parsed.needsStructuredQuery),
        needsDatasetDiscovery: Boolean(parsed.needsDatasetDiscovery),
        timeScope: parsed.timeScope || detectedScope,
        retrievalMode: parsed.retrievalMode || 'hybrid',
        location: parsed.location || undefined,
        topic: parsed.topic || undefined,
        rationale: parsed.rationale || 'LLM Structured Plan generated.',
      };
    }
  } catch (err) {
    console.warn('⚠️ LLM Retrieval Planner JSON parsing failed, using deterministic fallback plan:', err);
  }

  // Deterministic Fallback Plan Generator
  const isMemoryQuery = q.includes('my') || q.includes('preference') || q.includes('travel') || q.includes('should i');
  const isWeatherQuery = q.includes('weather') || q.includes('rain') || q.includes('temp') || q.includes('forecast') || q.includes('district') || q.includes('punjab');
  const isGovQuery = q.includes('government') || q.includes('advisory') || q.includes('recommend') || q.includes('guidance') || q.includes('report') || q.includes('pdf');

  return {
    needsLiveKnowledge: isWeatherQuery || !isMemoryQuery,
    needsStaticRag: isGovQuery || q.includes('guidance') || q.includes('pdf'),
    needsMemory: isMemoryQuery,
    needsStructuredQuery: q.includes('district') || q.includes('highest') || q.includes('most'),
    needsDatasetDiscovery: isWeatherQuery || isGovQuery,
    timeScope: detectedScope,
    retrievalMode: detectedScope === 'comparison' ? 'comparison' : q.includes('highest') ? 'structured' : 'hybrid',
    rationale: 'Deterministic fallback retrieval plan.',
  };
}

/**
 * NODE 1: Analyze Query & Formulate Retrieval Plan
 */
async function analyzeQueryNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  emitTraceStep(state.conversationId, 'Query Analyzed & Structured Retrieval Plan Formulated', undefined, 'running', { query: state.originalQuery });

  const plan = await generateRetrievalPlan(state.originalQuery);
  const selectedTools: string[] = [];

  if (plan.needsDatasetDiscovery) selectedTools.push('discoverDatasets');
  if (plan.needsLiveKnowledge) selectedTools.push('searchLiveKnowledgeBase');
  if (plan.needsStaticRag) selectedTools.push('searchKnowledgeBase');
  if (plan.needsMemory) selectedTools.push('searchMemory');

  const latencyMs = Date.now() - startTime;
  emitTraceStep(
    state.conversationId,
    `✓ Retrieval Plan Created: [${selectedTools.join(', ')}] | Scope: ${plan.timeScope.toUpperCase()} | Mode: ${plan.retrievalMode.toUpperCase()}`,
    'generateRetrievalPlan',
    'completed',
    { plan },
    { selectedTools },
    latencyMs
  );

  return {
    retrievalPlan: plan,
    selectedTools,
    iterations: state.iterations + 1,
  };
}

/**
 * NODE 2: Dataset Discovery Node (FIX #4 & FIX #5)
 */
async function discoverDatasetsNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  if (!state.retrievalPlan?.needsDatasetDiscovery) {
    return { discoveredDatasets: [] };
  }

  emitTraceStep(state.conversationId, 'Discovering Open Government Datasets', 'discoverDatasets', 'running', { query: state.originalQuery });

  const datasets = await discoverDatasets(state.originalQuery);
  const latencyMs = Date.now() - startTime;

  emitTraceStep(
    state.conversationId,
    `✓ Discovered ${datasets.length} Matching Datasets (${datasets.map((d) => d.name).join(', ')})`,
    'discoverDatasets',
    'completed',
    { query: state.originalQuery },
    { datasets },
    latencyMs
  );

  return {
    discoveredDatasets: datasets,
  };
}

/**
 * NODE 3: Execute Knowledge Layer Retrieval Engine (FIX #7 & FIX #16)
 */
async function executeRetrievalNode(state: AgentState): Promise<Partial<AgentState>> {
  const toolCallsLog: ToolExecutionRecord[] = [...state.toolCallsLog];
  const citations: Citation[] = [...state.citations];
  const evidence: string[] = [...state.evidence];
  let retrievedDocuments = [...state.retrievedDocuments];
  let retrievedMemories = [...state.retrievedMemories];

  const plan = state.retrievalPlan || await generateRetrievalPlan(state.originalQuery);

  // 1. Live Knowledge Layer Search (PostgreSQL + pgvector / Structured SQL)
  if (plan.needsLiveKnowledge) {
    const tStart = Date.now();
    emitTraceStep(state.conversationId, `Retrieving Live Knowledge Layer (${plan.retrievalMode} mode, ${plan.timeScope} scope)`, 'searchLiveKnowledgeBase', 'running');

    try {
      const records = await searchLiveKnowledgeBase(state.originalQuery, {
        timeScope: plan.timeScope,
        mode: plan.retrievalMode,
        limit: 4,
      });
      const latency = Date.now() - tStart;

      toolCallsLog.push({
        toolName: 'searchLiveKnowledgeBase',
        input: { query: state.originalQuery, timeScope: plan.timeScope, mode: plan.retrievalMode },
        output: { foundRecords: records.length, records },
        latencyMs: latency,
        status: 'success',
      });

      for (const rec of records) {
        const freshTag = rec.isFresh ? '🟢 FRESH' : '🟡 HISTORICAL';
        const mockTag = rec.isMock ? ' [DEMO DATA]' : '';
        evidence.push(
          `LIVE KNOWLEDGE LAYER${mockTag} [${freshTag} - ${rec.ageString}] (${rec.source}): ${rec.content} (Hybrid Score: ${rec.hybridScore})`
        );
        citations.push({
          source: `${rec.source} (${rec.ageString})${mockTag}`,
          type: 'Live Knowledge',
          datasetId: rec.datasetId,
          observedAt: rec.observedAt,
          details: rec.content,
          isMock: rec.isMock,
        });
      }

      emitTraceStep(
        state.conversationId,
        `✓ Live Knowledge Retrieved (${records.length} records)`,
        'searchLiveKnowledgeBase',
        'completed',
        { query: state.originalQuery, plan },
        { recordCount: records.length, records },
        latency
      );
    } catch (err: any) {
      console.error('Error in searchLiveKnowledgeBase:', err);
    }
  }

  // 2. Static Document RAG Search
  if (plan.needsStaticRag) {
    const tStart = Date.now();
    emitTraceStep(state.conversationId, 'Retrieving Static Uploaded Document Chunks', 'searchKnowledgeBase', 'running');

    try {
      const docs = await searchKnowledgeBase(state.originalQuery, 3);
      retrievedDocuments = docs;
      const latency = Date.now() - tStart;

      toolCallsLog.push({
        toolName: 'searchKnowledgeBase',
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
          details: doc.content.slice(0, 120) + '...',
        });
      }

      emitTraceStep(
        state.conversationId,
        `✓ Static Document Vectors Searched (${docs.length} chunks)`,
        'searchKnowledgeBase',
        'completed',
        { query: state.originalQuery },
        { count: docs.length },
        latency
      );
    } catch (err: any) {
      console.error('Error in searchKnowledgeBase:', err);
    }
  }

  // 3. User Long-Term Memory Search (Conditional)
  if (plan.needsMemory) {
    const tStart = Date.now();
    emitTraceStep(state.conversationId, 'Retrieving User Long-Term Memories', 'searchMemory', 'running');

    try {
      const memories = await searchMemory(state.originalQuery, 3);
      retrievedMemories = memories;
      const latency = Date.now() - tStart;

      toolCallsLog.push({
        toolName: 'searchMemory',
        input: { query: state.originalQuery },
        output: { memoriesFound: memories.length, memories },
        latencyMs: latency,
        status: 'success',
      });

      for (const mem of memories) {
        evidence.push(`USER LONG-TERM MEMORY (${mem.memoryType.toUpperCase()} PREFERENCE): ${mem.content}`);
        citations.push({
          source: `User Memory (${mem.memoryType})`,
          type: 'Memory',
          details: mem.content,
        });
      }

      emitTraceStep(
        state.conversationId,
        `✓ Long-Term Memories Searched (${memories.length} memories)`,
        'searchMemory',
        'completed',
        { query: state.originalQuery },
        { count: memories.length },
        latency
      );
    } catch (err: any) {
      console.error('Error in searchMemory:', err);
    }
  }

  return {
    toolCallsLog,
    citations,
    evidence,
    retrievedDocuments,
    retrievedMemories,
  };
}

/**
 * NODE 4: Evaluate Evidence Sufficiency (FIX #24)
 */
async function evaluateEvidenceNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  emitTraceStep(state.conversationId, 'Evaluating Retrieved Evidence Quality & Completeness', undefined, 'running');

  const hasEvidence = state.evidence.length > 0;
  const currentIterations = (state.iterations || 0) + 1;
  const needsMoreInfo = !hasEvidence && currentIterations < 2;

  const latencyMs = Date.now() - startTime;
  emitTraceStep(
    state.conversationId,
    hasEvidence ? '✓ Evidence Sufficiency Confirmed' : '⚠️ Evidence Incomplete (Refinement Triggered)',
    undefined,
    'completed',
    { totalEvidenceItems: state.evidence.length, iterations: currentIterations },
    { needsMoreInfo },
    latencyMs
  );

  return {
    needsMoreInfo,
    iterations: currentIterations,
  };
}

/**
 * NODE 5: Grounded LLM Synthesis Node (FIX #22, FIX #23, FIX #25, FIX #28)
 */
async function synthesizeAnswerNode(state: AgentState): Promise<Partial<AgentState>> {
  const startTime = Date.now();
  emitTraceStep(state.conversationId, 'Synthesizing Grounded Answer & Source Citations', undefined, 'running');

  const dataModeTag = config.dataMode === 'demo' ? '[DATA MODE: DEMO / TEST]' : '[DATA MODE: LIVE DATA]';

  const systemPrompt = `You are Veridex, an Agentic Intelligence System operating over a Continuously Updated Live Knowledge Layer (IMD weather feeds, data.gov.in datasets, NDMA guidelines) and User Long-Term Memory.
Current Operating Mode: ${dataModeTag}

CRITICAL GROUNDING & SYNTHESIS RULES:
1. Use ONLY the retrieved evidence provided below to formulate your response.
2. Clearly distinguish between:
   - LIVE KNOWLEDGE LAYER: Ingested government API feeds and datasets (include observed timestamps & freshness).
   - STATIC KNOWLEDGE: Uploaded PDF/TXT documents.
   - USER MEMORY: Saved user preferences or habits.
3. Do NOT present user memory as external government facts. Separate user preferences from external facts.
4. If evidence is empty or missing:
   - State clearly: "The requested live government data is currently unavailable in the indexed knowledge layer."
   - Do NOT invent weather metrics, rainfall numbers, or fake advisories.
5. If evidence contains [DEMO DATA], explicitly state in your answer that synthetic demonstration records were used.
6. Provide logical reasoning connecting the facts, user memory (if applicable), and final recommendation.

RETRIEVED EVIDENCE:
${state.evidence.length > 0 ? state.evidence.join('\n\n') : 'NO EVIDENCE RETRIEVED'}`;

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
    return 'execute_retrieval';
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
    retrievalPlan: { value: (x, y) => y ?? x, default: () => undefined },
    selectedTools: { value: (x, y) => y ?? x, default: () => [] },
    toolCallsLog: { value: (x, y) => y ?? x, default: () => [] },
    discoveredDatasets: { value: (x, y) => y ?? x, default: () => [] },
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
workflow.addNode('discover_datasets' as any, discoverDatasetsNode as any);
workflow.addNode('execute_retrieval' as any, executeRetrievalNode as any);
workflow.addNode('evaluate_evidence' as any, evaluateEvidenceNode as any);
workflow.addNode('synthesize_answer' as any, synthesizeAnswerNode as any);

workflow.addEdge(START, 'analyze_query' as any);
workflow.addEdge('analyze_query' as any, 'discover_datasets' as any);
workflow.addEdge('discover_datasets' as any, 'execute_retrieval' as any);
workflow.addEdge('execute_retrieval' as any, 'evaluate_evidence' as any);

workflow.addConditionalEdges('evaluate_evidence' as any, routeEvidenceCondition as any, {
  execute_retrieval: 'execute_retrieval' as any,
  synthesize_answer: 'synthesize_answer' as any,
});

workflow.addEdge('synthesize_answer' as any, END);

export const agentGraph = workflow.compile();
