import { agentGraph } from '../agents/agentGraph';
import { AgentState } from '../agents/agentState';

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
    expectedTools: ['getLiveWeather'],
    description: 'Live Weather API Query Evaluation',
  },
  {
    id: 'eval-2',
    query: 'What does the government report say about flood management?',
    expectedTools: ['getGovernmentData', 'searchKnowledgeBase'],
    description: 'RAG Knowledge Base Document Retrieval Evaluation',
  },
  {
    id: 'eval-3',
    query: 'What are my preferences for travelling?',
    expectedTools: ['searchMemory'],
    description: 'Long-Term Memory Search Evaluation',
  },
  {
    id: 'eval-4',
    query: "Considering today's weather, government advisories, and my travel preferences, should I travel to Delhi tomorrow?",
    expectedTools: ['getLiveWeather', 'getGovernmentData', 'searchKnowledgeBase', 'searchMemory'],
    description: 'Multi-Tool Reasoning & Synthesis Evaluation',
  },
];

export async function runEvaluationSuite() {
  console.log('🧪 Starting Veridex Agentic RAG Evaluation Benchmark Suite...\n');

  let passedCases = 0;
  const results: any[] = [];

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

    // Check tool selection accuracy
    const selected = finalState.selectedTools || [];
    const matchesAll = testCase.expectedTools.every((t) => selected.includes(t));

    if (matchesAll) {
      passedCases++;
    }

    results.push({
      id: testCase.id,
      description: testCase.description,
      query: testCase.query,
      expectedTools: testCase.expectedTools,
      selectedTools: selected,
      latencyMs,
      passed: matchesAll,
    });

    console.log(`[${matchesAll ? '✅ PASS' : '❌ FAIL'}] ${testCase.description}`);
    console.log(`   Expected: [${testCase.expectedTools.join(', ')}]`);
    console.log(`   Selected: [${selected.join(', ')}]`);
    console.log(`   Latency: ${latencyMs}ms\n`);
  }

  const accuracy = ((passedCases / EVALUATION_DATASET.length) * 100).toFixed(1);
  console.log('====================================================');
  console.log(`📊 EVALUATION SCORECARD`);
  console.log(`   Total Benchmark Cases: ${EVALUATION_DATASET.length}`);
  console.log(`   Passed Cases: ${passedCases}`);
  console.log(`   Tool Selection Accuracy: ${accuracy}%`);
  console.log('====================================================\n');

  return {
    accuracy: parseFloat(accuracy),
    passedCases,
    totalCases: EVALUATION_DATASET.length,
    results,
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
