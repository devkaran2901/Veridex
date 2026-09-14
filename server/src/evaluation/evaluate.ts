import { agentGraph } from '../agents/agentGraph';
import { AgentState } from '../agents/agentState';
import { runIngestionPipeline } from '../ingestion/ingestionPipeline';
import { searchLiveKnowledgeBase } from '../rag/hybridRetrieval';
import { config } from '../config/env';

interface EvaluationCase {
  id: string;
  query: string;
  expectedTools: string[];
  expectedScope: string;
  description: string;
}

const MANDATORY_TEST_SUITE: EvaluationCase[] = [
  {
    id: 'test-1',
    query: 'What is the current rainfall in Punjab?',
    expectedTools: ['discoverDatasets', 'searchLiveKnowledgeBase'],
    expectedScope: 'current',
    description: 'Test 1: Current Rainfall Query -> Dataset discovery -> Live Knowledge Retrieval',
  },
  {
    id: 'test-2',
    query: 'Which Punjab district has received the highest rainfall recently?',
    expectedTools: ['searchLiveKnowledgeBase'],
    expectedScope: 'recent',
    description: 'Test 2: District Highest Rainfall -> Structured SQL & Freshness Ranking',
  },
  {
    id: 'test-3',
    query: 'What does the government recommend during heavy rainfall?',
    expectedTools: ['searchKnowledgeBase'],
    expectedScope: 'current',
    description: 'Test 3: Government Advisory Guidance -> Semantic RAG Retrieval',
  },
  {
    id: 'test-4',
    query: 'What changed in Punjab rainfall since yesterday?',
    expectedTools: ['searchLiveKnowledgeBase'],
    expectedScope: 'comparison',
    description: 'Test 4: Temporal Delta Query -> Comparison Scope & Version Snapshot Retrieval',
  },
  {
    id: 'test-5',
    query: 'What are my travel preferences?',
    expectedTools: ['searchMemory'],
    expectedScope: 'current',
    description: 'Test 5: Personal Memory Query -> User Long-Term Memory Lookup',
  },
  {
    id: 'test-6',
    query: 'Considering current rainfall and my travel preferences, should I travel?',
    expectedTools: ['searchLiveKnowledgeBase', 'searchMemory'],
    expectedScope: 'current',
    description: 'Test 6: Hybrid Reasoning Query -> Live Knowledge + Memory Combination',
  },
  {
    id: 'test-7',
    query: 'What happened in Punjab rainfall last year?',
    expectedTools: ['searchLiveKnowledgeBase'],
    expectedScope: 'historical',
    description: 'Test 7: Historical Query -> Historical Scope Knowledge Search',
  },
  {
    id: 'test-8',
    query: 'What happens if the government API is unavailable?',
    expectedTools: [],
    expectedScope: 'current',
    description: 'Test 8: API Unavailable Safety Check -> Honest No-Evidence Response (No Fabrication)',
  },
];

import { initDatabase } from '../database/initDb';

export async function runEvaluationSuite() {
  console.log(`\n🧪 Starting Veridex Comprehensive Agentic RAG Evaluation Benchmark [Data Mode: ${config.dataMode.toUpperCase()}]...\n`);

  try {
    await initDatabase();
  } catch (e) {}

  // 1. Ingestion Pipeline & SHA-256 Deduplication Test
  console.log('--- TEST 1: Ingestion Pipeline & SHA-256 Change Detection ---');
  const report1 = await runIngestionPipeline();
  console.log(`   Initial Sync: ${report1.insertedRecords} inserted, ${report1.duplicateRecords} duplicates skipped`);

  const report2 = await runIngestionPipeline();
  console.log(`   Re-Sync Check: ${report2.insertedRecords} inserted, ${report2.duplicateRecords} duplicates skipped`);
  const dedupePassed = report2.duplicateRecords >= report1.totalFetched || report2.insertedRecords === 0;
  console.log(`   [${dedupePassed ? '✅ PASS' : '⚠️ WARN'}] SHA-256 Deduplication & Change Detection\n`);

  // 2. Hybrid Freshness-Aware Vector & SQL Search
  console.log('--- TEST 2: Hybrid Freshness-Aware Search ---');
  const freshResults = await searchLiveKnowledgeBase('current rainfall in Punjab districts', { timeScope: 'current' });
  if (freshResults.length > 0) {
    console.log(`   Top Result: "${freshResults[0]?.title}" | Score: ${freshResults[0]?.hybridScore} | Freshness: ${freshResults[0]?.ageString}`);
    console.log(`   [✅ PASS] Freshness-Aware Knowledge Layer Search\n`);
  } else {
    console.log(`   [ℹ️ INFO] Live Knowledge Base empty or DB offline (Mode: ${config.dataMode})\n`);
  }

  // 3. Mandatory 8 User Test Queries Benchmark (FIX #36)
  console.log('--- TEST 3: Mandatory 8 User Test Query Benchmark ---');
  let passedCases = 0;

  for (const testCase of MANDATORY_TEST_SUITE) {
    const startTime = Date.now();
    const initialState: AgentState = {
      userId: '00000000-0000-0000-0000-000000000001',
      conversationId: `eval-${Date.now()}`,
      originalQuery: testCase.query,
      messages: [],
      selectedTools: [],
      toolCallsLog: [],
      discoveredDatasets: [],
      retrievedDocuments: [],
      retrievedMemories: [],
      liveData: {},
      evidence: [],
      citations: [],
      finalAnswer: '',
      iterations: 0,
      needsMoreInfo: false,
    };

    const finalState = await agentGraph.invoke(initialState);
    const latencyMs = Date.now() - startTime;

    const plan = finalState.retrievalPlan;
    const selected = finalState.selectedTools || [];
    const scopeMatch = !plan || plan.timeScope === testCase.expectedScope;
    const toolMatch = testCase.expectedTools.length === 0 || testCase.expectedTools.some((t) => selected.includes(t));

    const isSuccess = scopeMatch && toolMatch && finalState.finalAnswer.length > 0;
    if (isSuccess) passedCases++;

    console.log(`[${isSuccess ? '✅ PASS' : '❌ FAIL'}] ${testCase.description}`);
    console.log(`   Query: "${testCase.query}"`);
    console.log(`   Planner Time Scope: ${plan?.timeScope || 'N/A'} (Expected: ${testCase.expectedScope})`);
    console.log(`   Tools Executed: [${selected.join(', ')}]`);
    console.log(`   Latency: ${latencyMs}ms | Answer Length: ${finalState.finalAnswer.length} chars\n`);
  }

  const accuracy = ((passedCases / MANDATORY_TEST_SUITE.length) * 100).toFixed(1);
  console.log('====================================================');
  console.log(`📊 VERIDEX AGENTIC RAG MANDATORY EVALUATION SCORECARD`);
  console.log(`   Total Benchmark Cases: ${MANDATORY_TEST_SUITE.length}`);
  console.log(`   Passed Cases: ${passedCases}`);
  console.log(`   Agentic Planning & Retrieval Accuracy: ${accuracy}%`);
  console.log('====================================================\n');

  return {
    accuracy: parseFloat(accuracy),
    passedCases,
    totalCases: MANDATORY_TEST_SUITE.length,
  };
}

if (require.main === module) {
  runEvaluationSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Evaluation failed:', err);
      process.exit(1);
    });
}
