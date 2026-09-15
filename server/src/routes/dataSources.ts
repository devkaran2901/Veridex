import { Router } from 'express';
import { query } from '../database/db';
import { validateSSRF, safeFetch } from '../services/ssrfProtection';
import { encryptCredential, maskCredential } from '../services/cryptoService';
import { detectJsonStructure } from '../ingestion/schemaDetector';
import { syncCustomDataSource } from '../ingestion/ingestionPipeline';

const router = Router();

const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * POST /api/data-sources/test
 * Test connection to a user-provided REST API endpoint (SSRF protected, payload limited)
 */
router.post('/test', async (req, res) => {
  try {
    const { url, authType, apiKey, apiKeyLocation, headerName, paramName, bearerToken } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'API URL is required' });
    }

    // 1. SSRF Check
    const ssrfCheck = await validateSSRF(url);
    if (!ssrfCheck.allowed) {
      return res.status(400).json({ success: false, error: `SSRF Validation Error: ${ssrfCheck.reason}` });
    }

    // 2. Prepare request options
    let targetUrl = url;
    const headers: Record<string, string> = {};

    if (authType === 'bearer' && bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    } else if (authType === 'api_key' && apiKey) {
      if (apiKeyLocation === 'header') {
        const hName = headerName || 'X-API-Key';
        headers[hName] = apiKey;
      } else {
        const pName = paramName || 'api_key';
        const urlObj = new URL(targetUrl);
        urlObj.searchParams.set(pName, apiKey);
        targetUrl = urlObj.toString();
      }
    }

    // 3. Perform safe HTTP GET
    const response = await safeFetch(targetUrl, { headers, timeoutMs: 8000 });

    if (response.status < 200 || response.status >= 300) {
      return res.status(400).json({
        success: false,
        error: `Connected API returned HTTP ${response.status}: ${response.statusText}`,
      });
    }

    // 4. Parse JSON & detect schema
    let jsonBody: any;
    try {
      jsonBody = response.json();
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: `Response content is not valid JSON: ${err.message}`,
      });
    }

    const detection = detectJsonStructure(jsonBody);
    if (!detection.valid) {
      return res.status(400).json({
        success: false,
        error: detection.error || 'Unsupported or ambiguous JSON structure.',
      });
    }

    res.json({
      success: true,
      message: 'Connection successful',
      recordCount: detection.recordCount,
      dataPath: detection.dataPath,
      schema: detection.schema,
      preview: detection.recordsPreview,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/data-sources
 * Add & register a new user data source
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      url,
      authType = 'none',
      apiKeyLocation = 'header',
      headerName = 'X-API-Key',
      paramName = 'api_key',
      apiKey,
      bearerToken,
      refreshInterval = 10,
      userId = DEFAULT_USER_ID,
    } = req.body;

    if (!name || !url) {
      return res.status(400).json({ error: 'Name and URL are required' });
    }

    // SSRF Check
    const ssrfCheck = await validateSSRF(url);
    if (!ssrfCheck.allowed) {
      return res.status(400).json({ error: `SSRF Error: ${ssrfCheck.reason}` });
    }

    const credentialText = authType === 'bearer' ? bearerToken : authType === 'api_key' ? apiKey : '';
    const encryptedCreds = encryptCredential(credentialText);

    const authConfig = {
      location: apiKeyLocation,
      headerName,
      paramName,
    };

    // Test request to infer schema before saving
    let schemaJSON = '[]';
    let recordCount = 0;
    try {
      const headers: Record<string, string> = {};
      let targetUrl = url;
      if (authType === 'bearer' && bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`;
      } else if (authType === 'api_key' && apiKey) {
        if (apiKeyLocation === 'header') {
          headers[headerName || 'X-API-Key'] = apiKey;
        } else {
          const uObj = new URL(targetUrl);
          uObj.searchParams.set(paramName || 'api_key', apiKey);
          targetUrl = uObj.toString();
        }
      }
      const testRes = await safeFetch(targetUrl, { headers, timeoutMs: 8000 });
      if (testRes.status >= 200 && testRes.status < 300) {
        const json = testRes.json();
        const det = detectJsonStructure(json);
        if (det.valid) {
          schemaJSON = JSON.stringify(det.schema);
          recordCount = det.recordCount;
        }
      }
    } catch (e) {
      // Proceed even if initial schema check fails
    }

    const insertRes = await query(
      `INSERT INTO data_sources 
       (user_id, name, url, auth_type, auth_config, encrypted_credentials, refresh_interval, status, schema, record_count, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'HEALTHY', $8, $9, TRUE)
       RETURNING id, user_id, name, url, auth_type, auth_config, refresh_interval, status, schema, record_count, is_active, created_at`,
      [
        userId,
        name,
        url,
        authType,
        JSON.stringify(authConfig),
        encryptedCreds,
        Math.max(5, parseInt(refreshInterval || '10', 10)),
        schemaJSON,
        recordCount,
      ]
    );

    const newSource = insertRes.rows[0];

    // Trigger initial sync in background
    syncCustomDataSource(newSource.id).catch((err) =>
      console.warn(`Initial sync failed for ${newSource.id}:`, err.message)
    );

    res.status(201).json({
      message: 'Data source added successfully',
      dataSource: {
        ...newSource,
        apiKey: credentialText ? maskCredential(credentialText) : null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/data-sources
 * List user's connected data sources (credentials sanitized)
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const dbRes = await query(
      `SELECT id, user_id, name, url, auth_type, auth_config, refresh_interval, status, last_fetched_at, last_success_at, last_error, schema, record_count, is_active, created_at, updated_at
       FROM data_sources
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );

    const sanitizedRows = dbRes.rows.map((r) => ({
      ...r,
      domain: new URL(r.url).hostname,
      apiKey: r.auth_type !== 'none' ? '********' : null,
    }));

    res.json(sanitizedRows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function verifySourceOwnership(sourceId: string, userId: string): Promise<any> {
  const dbRes = await query(`SELECT * FROM data_sources WHERE id = $1`, [sourceId]);
  if (dbRes.rows.length === 0) {
    const err: any = new Error('Data source not found');
    err.status = 404;
    throw err;
  }
  const source = dbRes.rows[0];
  if (source.user_id && source.user_id !== userId) {
    const err: any = new Error('Access denied: You do not own this data source');
    err.status = 403;
    throw err;
  }
  return source;
}

/**
 * GET /api/data-sources/:id
 * Get single data source details (enforces user ownership)
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = (req.query.userId as string) || DEFAULT_USER_ID;
    const source = await verifySourceOwnership(req.params.id, userId);

    res.json({
      ...source,
      domain: new URL(source.url).hostname,
      apiKey: source.auth_type !== 'none' ? '********' : null,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/data-sources/:id/sync
 * Manually trigger ingestion sync for a data source (enforces user ownership)
 */
router.post('/:id/sync', async (req, res) => {
  try {
    const userId = (req.body?.userId as string) || (req.query?.userId as string) || DEFAULT_USER_ID;
    await verifySourceOwnership(req.params.id, userId);

    const stats = await syncCustomDataSource(req.params.id);
    res.json({
      message: 'Sync completed successfully',
      stats,
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/data-sources/:id/disable
 * Disable continuous ingestion for a data source (enforces user ownership)
 */
router.post('/:id/disable', async (req, res) => {
  try {
    const userId = (req.body?.userId as string) || (req.query?.userId as string) || DEFAULT_USER_ID;
    await verifySourceOwnership(req.params.id, userId);

    await query(`UPDATE data_sources SET status = 'DISABLED', is_active = FALSE WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Data source disabled' });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * POST /api/data-sources/:id/enable
 * Enable continuous ingestion for a data source (enforces user ownership)
 */
router.post('/:id/enable', async (req, res) => {
  try {
    const userId = (req.body?.userId as string) || (req.query?.userId as string) || DEFAULT_USER_ID;
    await verifySourceOwnership(req.params.id, userId);

    await query(`UPDATE data_sources SET status = 'HEALTHY', is_active = TRUE WHERE id = $1`, [req.params.id]);
    // Trigger sync immediately on enable
    syncCustomDataSource(req.params.id).catch(() => {});
    res.json({ message: 'Data source enabled' });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * DELETE /api/data-sources/:id
 * Delete data source and associated knowledge records (enforces user ownership)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req.query?.userId as string) || DEFAULT_USER_ID;
    await verifySourceOwnership(req.params.id, userId);

    await query(`DELETE FROM data_sources WHERE id = $1`, [req.params.id]);
    res.json({ message: 'Data source and associated records deleted' });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
