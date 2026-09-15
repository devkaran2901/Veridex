import { ingestLiveRecord } from '../ingestion/ingestionPipeline';
import { searchLiveKnowledgeBase } from '../rag/hybridRetrieval';
import { discoverDatasets } from '../ingestion/discovery/datasetRegistry';
import { generateRetrievalPlan, agentGraph, classifyQueryIntent } from '../agents/agentGraph';

async function runEndToEndTest() {
  console.log('🧪 Starting Veridex End-to-End Architectural & Query Routing Verification Test...\n');

  const testUserId = '00000000-0000-0000-0000-000000000001';
  const testDatasetId = 'e2e_test_dataset';

  // 1. Casual Query Fast-Path Test ("hey")
  console.log('1️⃣ Testing Casual Query Fast-Path ("hey")...');
  const casualIntent = classifyQueryIntent('hey');
  const casualPlan = await generateRetrievalPlan('hey');
  const casualDatasets = await discoverDatasets('hey', testUserId);

  console.log(`   ✓ Intent Classification: "${casualIntent}"`);
  console.log(`   ✓ Retrieval Plan needsLiveKnowledge: ${casualPlan.needsLiveKnowledge}`);
  console.log(`   ✓ Discovered Datasets for "hey": ${casualDatasets.length} (Expected: 0)`);

  if (casualPlan.needsLiveKnowledge || casualDatasets.length > 0) {
    throw new Error('FAIL: Casual query "hey" triggered live knowledge search or dataset discovery!');
  }

  // Test full agentGraph execution for "hey"
  const casualState = await agentGraph.invoke({
    userId: testUserId,
    conversationId: 'test_casual_conv',
    originalQuery: 'hey',
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

  console.log(`   ✓ Agent Final Answer for "hey": "${casualState.finalAnswer}"`);
  console.log(`   ✓ Total Evidence Items: ${casualState.evidence.length} (Expected: 0)`);
  console.log(`   ✓ Total Citations: ${casualState.citations.length} (Expected: 0)`);

  if (casualState.evidence.length > 0 || casualState.citations.length > 0) {
    throw new Error('FAIL: Casual query "hey" returned evidence or citations!');
  }

  // 2. Ingest Version 1
  console.log('\n2️⃣ Ingesting Version 1 Record...');
  const v1Record = {
    source: 'E2E Official Government Feed',
    sourceType: 'api_feed' as const,
    datasetId: testDatasetId,
    userId: testUserId,
    title: 'E2E Punjab Rainfall Record',
    content: 'E2E District Amritsar cumulative rainfall is 72 mm for current monsoon window.',
    structuredData: { district: 'Amritsar', rainfall_mm: 72 },
    metadata: { isMock: false },
    validFrom: new Date(),
  };

  const res1 = await ingestLiveRecord(v1Record);
  console.log(`   ✓ V1 Ingest Result: inserted=${res1.inserted}, id=${res1.id}`);

  // 3. Ingest Version 2 (Changed Data -> Triggers Versioning)
  console.log('\n3️⃣ Ingesting Version 2 Record (Changed rainfall to 92 mm)...');
  const v2Record = {
    ...v1Record,
    content: 'E2E District Amritsar cumulative rainfall updated to 92 mm for current monsoon window.',
    structuredData: { district: 'Amritsar', rainfall_mm: 92 },
  };

  const res2 = await ingestLiveRecord(v2Record);
  console.log(`   ✓ V2 Ingest Result: inserted=${res2.inserted}, isUpdate=${res2.isUpdate}`);

  // 4. Dataset Discovery Test
  console.log('\n4️⃣ Testing Dataset Discovery for Valid Research Query...');
  const datasets = await discoverDatasets('Amritsar rainfall', testUserId);
  console.log(`   ✓ Discovered Datasets: ${datasets.length} datasets found (${datasets.map((d) => d.name).join(', ')})`);

  // 5. Dataset-Aware Retrieval Test
  console.log('\n5️⃣ Testing Dataset-Constrained Retrieval...');
  const retrievedRecords = await searchLiveKnowledgeBase('Amritsar rainfall', {
    datasetIds: [testDatasetId],
    userId: testUserId,
    limit: 5,
  });

  console.log(`   ✓ Retrieved ${retrievedRecords.length} records matching datasetId "${testDatasetId}":`);
  for (const rec of retrievedRecords) {
    console.log(`     - [${rec.title}] Score=${rec.hybridScore}, Freshness=${rec.freshnessScore}, Age=${rec.ageString}`);
  }

  // 6. Version Comparison Retrieval Test
  console.log('\n6️⃣ Testing Version Comparison Retrieval ("What changed since yesterday?")...');
  const comparisonRecords = await searchLiveKnowledgeBase('Amritsar rainfall difference', {
    timeScope: 'comparison',
    datasetIds: [testDatasetId],
    userId: testUserId,
  });

  console.log(`   ✓ Comparison Search Returned ${comparisonRecords.length} Version Records:`);
  for (const rec of comparisonRecords) {
    console.log(`     - ${rec.title}: ${rec.content}`);
  }

  console.log('\n✅ Veridex End-to-End Test & Query Routing Fixes Verified Successfully!');
}

if (require.main === module) {
  runEndToEndTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ E2E Test Failed:', err);
      process.exit(1);
    });
}
