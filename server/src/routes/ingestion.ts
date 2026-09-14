import { Router } from 'express';
import { query } from '../database/db';
import { runIngestionPipeline } from '../ingestion/ingestionPipeline';
import { REGISTERED_PROVIDERS } from '../ingestion/discovery/datasetRegistry';
import { config } from '../config/env';

const router = Router();

// GET /api/ingestion/status - System Data Mode & Ingestion Status
router.get('/status', async (_req, res) => {
  try {
    let recordCount = 0;
    try {
      const countRes = await query('SELECT COUNT(*) FROM knowledge_records');
      recordCount = parseInt(countRes.rows[0]?.count || '0', 10);
    } catch (e) {}

    res.json({
      dataMode: config.dataMode,
      demoMode: config.demoMode,
      datagovApiKeyConfigured: Boolean(config.datagovApiKey),
      ingestionIntervalMinutes: config.ingestionIntervalMinutes,
      registeredProvidersCount: REGISTERED_PROVIDERS.length,
      knowledgeRecordsCount: recordCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ingestion/datasets - List government datasets and last sync stats
router.get('/datasets', async (_req, res) => {
  try {
    const dbRes = await query('SELECT * FROM knowledge_datasets ORDER BY last_synced_at DESC');
    if (dbRes.rows.length > 0) {
      return res.json(dbRes.rows);
    }
    throw new Error('No datasets in DB');
  } catch (error: any) {
    const fallback = REGISTERED_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      source: p.source,
      description: p.description,
      record_count: 5,
      last_synced_at: new Date().toISOString(),
      is_mock: p.isMock || false,
    }));
    res.json(fallback);
  }
});

// GET /api/ingestion/records - List canonical knowledge records with freshness metadata
router.get('/records', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, source, source_type, dataset_id, title, content, structured_data, metadata, valid_from, observed_at, retrieved_at, version, created_at 
       FROM knowledge_records 
       ORDER BY valid_from DESC 
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ingestion/sync - Trigger live data ingestion pipeline sync
router.post('/sync', async (req, res) => {
  try {
    const { datasetId } = req.body;
    const report = await runIngestionPipeline(datasetId);

    res.json({
      message: 'Live Knowledge Ingestion Pipeline sync executed successfully!',
      report,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
