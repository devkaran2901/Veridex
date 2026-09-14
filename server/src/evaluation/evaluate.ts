import { agentGraph } from '../agents/agentGraph';
import { AgentState } from '../agents/agentState';
import { runIngestionPipeline } from '../ingestion/ingestionPipeline';
import { searchLiveKnowledgeBase } from '../rag/hybridRetrieval';
import { computeContentHash } from '../ingestion/deduplicator';

interface EvaluationCase {
  id: string;
  query: string;
  expectedTools: string[];
  description: string;
}

const EVALUATION_DATASET: EvaluationCase[] = [
  {
    id: 'eval-1',
    query: 'What is the current weather in Delhi?',
    expectedTools: ['searchLiveKnowledgeBase', 'getLiveWeather'],
    description: 'Live Weather Feed & Knowledge Retrieval Evaluation',
  },
  {
    id: 'eval-2',
    query: 'What does the government report say about flood management?',
    expectedTools: ['searchLiveKnowledgeBase', 'getGovernmentData', 'searchKnowledgeBase'],
    description: 'Government Disaster Advisory & Document Retrieval Evaluation',
  },
  {
    id: 'eval-3',
    query: 'Which Punjab districts received the most rainfall recently?',
    expectedTools: ['searchLiveKnowledgeBase'],
    description: 'Structured SQL & Freshness-Aware District Rainfall Evaluation',
  },
  {
    id: 'eval-4',
    query: 'What are my preferences for travelling?',
    expectedTools: ['searchLiveKnowledgeBase', 'searchMemory'],
    description: 'Long-Term Memory Retrieval Evaluation',
  },
];

export async function runEvaluationSuite() {
  console.log('🧪 Starting Veridex Live-Data Knowledge Ingestion & Hybrid Retrieval Evaluation Benchmark...\n');

  // 1. Ingestion Pipeline & SHA-256 Deduplication Test
  console.log('--- TEST 1: Ingestion & Change Detection ---');
  const report1 = await runIngestionPipeline();
  console.log(`   Initial Ingestion: ${report1.insertedRecords} inserted, ${report1.duplicateRecords} duplicates`);

  const report2 = await runIngestionPipeline();
  console.log(`   Second Ingestion (Deduplication Check): ${report2.insertedRecords} inserted, ${report2.duplicateRecords} duplicates skipped`);
  const dedupePassed = report2.duplicateRecords >= report1.totalFetched || report2.insertedRecords === 0;
  console.log(`   [${dedupePassed ? '✅ PASS' : '⚠️ WARN'}] SHA-256 Change Detection & Deduplication Verification\n`);

  // 2. Hybrid Freshness-Aware Vector & SQL Retrieval Test
  console.log('--- TEST 2: Hybrid Freshness-Aware Search ---');
  const freshResults = await searchLiveKnowledgeBase('recent rainfall in Punjab districts', { timeScope: 'current' });
  console.log(`   Top Record: "${freshResults[0]?.title}" | Score: ${freshResults[0]?.hybridScore} | Freshness: ${freshResults[0]?.ageString}`);
  const freshnessPassed = freshResults.length > 0 && freshResults[0]?.hybridScore > 0.7;
  console.log(`   [${freshnessPassed ? '✅ PASS' : '❌ FAIL'}] Freshness Decay Scoring Verification\n`);

  // 3. Agent Tool Selection & Multi-Tool Reasoning Benchmark
  console.log('--- TEST 3: Agentic Multi-Tool Reasoning Benchmark ---');
  let passedCases = 0;

  for (const testCase of EVALUATION_DATASET) {
    const startTime = Date.now();
    const initialState: AgentState = {
      userId: '00000000-0000-0000-0000-000000000001',
      conversationId: `eval-${Date.now()}`,
      originalQuery: testCase.query,
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

    const finalState = await agentGraph.invoke(initialState);
    const latencyMs = Date.now() - startTime;

    const selected = finalState.selectedTools || [];
    const matchesAll = testCase.expectedTools.every((t) => selected.includes(t));

    if (matchesAll) {
      passedCases++;
    }

    console.log(`[${matchesAll ? '✅ PASS' : '❌ FAIL'}] ${testCase.description}`);
    console.log(`   Expected: [${testCase.expectedTools.join(', ')}]`);
    console.log(`   Selected: [${selected.join(', ')}]`);
    console.log(`   Latency: ${latencyMs}ms\n`);
  }

  const accuracy = ((passedCases / EVALUATION_DATASET.length) * 100).toFixed(1);
  console.log('====================================================');
  console.log(`📊 VERIDEX AGENTIC RAG EVALUATION SCORECARD`);
  console.log(`   Total Benchmark Cases: ${EVALUATION_DATASET.length}`);
  console.log(`   Passed Cases: ${passedCases}`);
  console.log(`   Tool Selection & Knowledge Retrieval Accuracy: ${accuracy}%`);
  console.log('====================================================\n');

  return {
    accuracy: parseFloat(accuracy),
    passedCases,
    totalCases: EVALUATION_DATASET.length,
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
