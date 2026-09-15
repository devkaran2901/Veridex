import { searchLiveKnowledgeBase, extractLocationFromQuery } from '../rag/hybridRetrieval';
import { agentGraph } from '../agents/agentGraph';

async function testJhajjarQuery() {
  console.log('🧪 Testing "weather in jhajjar" query routing and grounding...\n');

  const queryText = 'weather in jhajjar';
  const extractedLoc = extractLocationFromQuery(queryText);
  console.log(`1️⃣ Extracted Location for "${queryText}": "${extractedLoc}"`);
  if (extractedLoc?.toLowerCase() !== 'jhajjar') {
    throw new Error(`FAIL: Expected location "jhajjar", got "${extractedLoc}"`);
  }

  console.log('\n2️⃣ Running searchLiveKnowledgeBase for "weather in jhajjar"...');
  const records = await searchLiveKnowledgeBase(queryText, { limit: 5 });
  console.log(`   ✓ Retrieved ${records.length} records:`);
  for (const rec of records) {
    console.log(`     - [${rec.title}] (${rec.source}) - Hybrid Score: ${rec.hybridScore}`);
    const text = `${rec.title} ${rec.content}`.toLowerCase();
    if (!text.includes('jhajjar')) {
      throw new Error(`FAIL: Retrieved record for "${rec.title}" does not contain target location "jhajjar"!`);
    }
  }

  console.log('\n3️⃣ Running agentGraph for "weather in jhajjar"...');
  const state = await agentGraph.invoke({
    userId: '00000000-0000-0000-0000-000000000001',
    conversationId: 'test_jhajjar_conv',
    originalQuery: queryText,
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
  });

  console.log(`   ✓ Final Answer:\n${state.finalAnswer}\n`);
  console.log(`   ✓ Evidence Count: ${state.evidence.length}`);
  for (const ev of state.evidence) {
    console.log(`     - ${ev}`);
    if (!ev.toLowerCase().includes('jhajjar')) {
      throw new Error(`FAIL: Evidence "${ev}" does not mention Jhajjar!`);
    }
  }

  console.log('\n✅ "weather in jhajjar" test PASSED successfully!');
}

if (require.main === module) {
  testJhajjarQuery()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Test Failed:', err);
      process.exit(1);
    });
}
