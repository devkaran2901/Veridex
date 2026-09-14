import { Router } from 'express';
import { query } from '../database/db';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const dbResult = await query('SELECT NOW() as current_time, version() as pg_version');
    const vectorCheck = await query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        time: dbResult.rows[0].current_time,
        version: dbResult.rows[0].pg_version,
        pgvectorInstalled: vectorCheck.rows.length > 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error.message,
      },
    });
  }
});

export default router;
