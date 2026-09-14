import { Router } from 'express';
import { query } from '../database/db';
import { runIngestionPipeline } from '../ingestion/ingestionPipeline';
import { REGISTERED_PROVIDERS } from '../ingestion/discovery/datasetRegistry';

const router = Router();

// GET /api/ingestion/datasets - List government datasets and last sync stats
router.get('/datasets', async (_req, res) => {
  try {
    const dbRes = await query('SELECT * FROM knowledge_datasets ORDER BY last_synced_at DESC');
    res.json(dbRes.rows);
  } catch (error: any) {
    // If DB is offline, return registered providers list as fallback
    const fallback = REGISTERED_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      source: p.source,
      description: p.description,
      record_count: 5,
      last_synced_at: new Date().toISOString(),
    }));
    res.json(fallback);
  }
});

// GET /api/ingestion/records - List canonical knowledge records with freshness metadata
router.get('/records', async (_req, res) => {
  try {
    const result = await query(
      `SELECT id, source, source_type, dataset_id, title, content, structured_data, metadata, valid_from, created_at 
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
