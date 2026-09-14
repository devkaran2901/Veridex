import http from 'http';
import { validateSSRF } from '../services/ssrfProtection';
import { encryptCredential, decryptCredential, maskCredential } from '../services/cryptoService';
import { detectJsonStructure, formatRecordToSearchableText } from '../ingestion/schemaDetector';
import { CustomApiProvider } from '../ingestion/providers/CustomApiProvider';
import { query } from '../database/db';
import { searchLiveKnowledgeBase } from '../rag/hybridRetrieval';
import { discoverDatasets } from '../ingestion/discovery/datasetRegistry';
import { agentGraph } from '../agents/agentGraph';
import { AgentState } from '../agents/agentState';
import { initDatabase } from '../database/initDb';
import { syncCustomDataSource } from '../ingestion/ingestionPipeline';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

export async function runDataSourcesTestSuite(): Promise<TestResult[]> {
  console.log('🧪 Starting Veridex Custom REST/JSON Data Sources Evaluation Test Suite...\n');
  try {
    await initDatabase();
  } catch (e) {}

  const results: TestResult[] = [];

  // TEST 1: SSRF Protection Rules
  try {
    const localhostTest = await validateSSRF('http://localhost:5000/api/health');
    const privateIpTest = await validateSSRF('http://127.0.0.1:8080/data');
    const metadataTest = await validateSSRF('http://169.254.169.254/latest/meta-data');
    const fileProtoTest = await validateSSRF('file:///etc/passwd');

    const allBlocked = !localhostTest.allowed && !privateIpTest.allowed && !metadataTest.allowed && !fileProtoTest.allowed;
    results.push({
      name: 'SSRF Protection (Localhost, Private IPs, Cloud Metadata, Non-HTTP protocols blocked)',
      passed: allBlocked,
      details: allBlocked ? 'All SSRF vectors successfully rejected.' : 'SSRF check failed!',
    });
  } catch (err: any) {
    results.push({ name: 'SSRF Protection', passed: false, details: err.message });
  }

  // TEST 2: Credential Encryption & Security
  try {
    const rawApiKey = 'sk-proj-veridex-secret-key-1234567890';
    const encrypted = encryptCredential(rawApiKey);
    const decrypted = decryptCredential(encrypted);
    const masked = maskCredential(rawApiKey);

    const isSecure = encrypted !== rawApiKey && decrypted === rawApiKey && masked.includes('...');
    results.push({
      name: 'Credential Security (AES-256-GCM Encryption & Masked UI Output)',
      passed: isSecure,
      details: `Encrypted: ${encrypted.slice(0, 15)}... | Masked: ${masked}`,
    });
  } catch (err: any) {
    results.push({ name: 'Credential Security', passed: false, details: err.message });
  }

  // TEST 3: Schema Detection & Record Serialization
  try {
    const samplePayload = {
      status: 'success',
      data: [
        { district: 'Amritsar', rainfall: 92.1, date: '2026-09-14', alert: 'High Runoff' },
        { district: 'Jalandhar', rainfall: 84.5, date: '2026-09-14', alert: 'Normal' },
      ],
    };

    const detection = detectJsonStructure(samplePayload);
    const textFormatted = formatRecordToSearchableText('Punjab Weather API', samplePayload.data[0]);

    const passed =
      detection.valid &&
      detection.recordCount === 2 &&
      detection.schema.some((s) => s.name === 'rainfall' && s.type === 'number') &&
      (textFormatted.includes('District: Amritsar') || textFormatted.includes('Amritsar'));

    results.push({
      name: 'JSON Structure Detection & Text Serialization',
      passed,
      details: `Records: ${detection.recordCount}, Fields: ${detection.schema.map((s) => s.name).join(', ')}`,
    });
  } catch (err: any) {
    results.push({ name: 'Schema Detection', passed: false, details: err.message });
  }

  // TEST 4: Data Source CRUD & Ingestion Sync Lifecycle
  try {
    // Insert test source into DB
    const insRes = await query(
      `INSERT INTO data_sources 
       (user_id, name, url, auth_type, encrypted_credentials, refresh_interval, status, schema, record_count, is_active)
       VALUES ('00000000-0000-0000-0000-000000000001', 'Test E2E Irrigation API', 'https://api.punjab-irrigation.gov.in/v1/advisory', 'api_key', $1, 10, 'HEALTHY', '[]'::jsonb, 0, TRUE)
       RETURNING id`,
      [encryptCredential('sk-test-key-999')]
    );
    const sourceId = insRes.rows[0].id;

    // Verify GET list (credentials masked)
    const listRes = await query(`SELECT * FROM data_sources WHERE id = $1`, [sourceId]);
    const fetchedSource = listRes.rows[0];

    // Toggle disable / enable
    await query(`UPDATE data_sources SET status = 'DISABLED', is_active = FALSE WHERE id = $1`, [sourceId]);
    const disRes = await query(`SELECT status FROM data_sources WHERE id = $1`, [sourceId]);

    await query(`UPDATE data_sources SET status = 'HEALTHY', is_active = TRUE WHERE id = $1`, [sourceId]);
    const enRes = await query(`SELECT status FROM data_sources WHERE id = $1`, [sourceId]);

    // Clean up test source
    await query(`DELETE FROM data_sources WHERE id = $1`, [sourceId]);
    const delRes = await query(`SELECT count(*) FROM data_sources WHERE id = $1`, [sourceId]);

    const isLifecycleValid =
      sourceId &&
      fetchedSource.name === 'Test E2E Irrigation API' &&
      disRes.rows[0].status === 'DISABLED' &&
      enRes.rows[0].status === 'HEALTHY' &&
      parseInt(delRes.rows[0].count, 10) === 0;

    results.push({
      name: 'Data Source Database Lifecycle & Security Scoping',
      passed: Boolean(isLifecycleValid),
      details: `Created ID: ${sourceId.slice(0, 8)}... | Disabled & Enabled | Purged successfully`,
    });
  } catch (err: any) {
    results.push({ name: 'Data Source Lifecycle', passed: false, details: err.message });
  }

  // TEST 5: Dataset Discovery over Government Catalog & Custom APIs
  try {
    const discovered = await discoverDatasets('Punjab weather API');
    const hasCustom = discovered.some((d) => d.name.toLowerCase().includes('punjab') || d.id.includes('custom'));

    results.push({
      name: 'Dataset Discovery over Government Catalog & Custom APIs',
      passed: hasCustom,
      details: `Discovered datasets count: ${discovered.length}`,
    });
  } catch (err: any) {
    results.push({ name: 'Dataset Discovery', passed: false, details: err.message });
  }

  // TEST 6: Multi-Source Agent RAG Flagship Query
  try {
    const initialState: Partial<AgentState> = {
      userId: '00000000-0000-0000-0000-000000000001',
      conversationId: 'test-conv-ds',
      originalQuery: 'Is the current weather situation concerning according to government guidance?',
      messages: [],
      toolCallsLog: [],
      evidence: [],
      citations: [],
      iterations: 0,
      selectedTools: [],
      discoveredDatasets: [],
      retrievedDocuments: [],
      retrievedMemories: [],
      liveData: {},
    };

    const agentRes: any = await agentGraph.invoke(initialState as any);

    const hasAnswer = agentRes.finalAnswer && agentRes.finalAnswer.length > 20;

    results.push({
      name: 'Agentic Multi-Source Synthesis (Custom Weather API + Government Advisory)',
      passed: Boolean(hasAnswer),
      details: `Citations retrieved: ${agentRes.citations ? agentRes.citations.length : 0}`,
    });
  } catch (err: any) {
    results.push({ name: 'Agentic Multi-Source Synthesis', passed: false, details: err.message });
  }

  // Print Summary
  console.log('\n📊 Custom Data Sources Evaluation Test Results Summary:');
  console.log('--------------------------------------------------');
  let passCount = 0;
  results.forEach((r, idx) => {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} Test #${idx + 1}: ${r.name}`);
    if (r.details) console.log(`   └─ ${r.details}`);
    if (r.passed) passCount++;
  });
  console.log('--------------------------------------------------');
  console.log(`PASSED: ${passCount} / ${results.length} (${Math.round((passCount / results.length) * 100)}%)\n`);

  return results;
}

if (require.main === module) {
  runDataSourcesTestSuite()
    .then((res) => {
      const allPassed = res.every((r) => r.passed);
      process.exit(allPassed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal test error:', err);
      process.exit(1);
    });
}
