import fs from 'fs';
import path from 'path';
import { pool } from './db';

export async function initDatabase() {
  try {
    console.log('🔄 Initializing PostgreSQL schema & migrations...');

    // Run column migrations first to ensure old DB instances have all columns
    await pool.query(`
      CREATE TABLE IF NOT EXISTS data_sources (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          url TEXT NOT NULL,
          auth_type VARCHAR(50) NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'bearer')),
          auth_config JSONB DEFAULT '{}'::jsonb,
          encrypted_credentials TEXT,
          refresh_interval INTEGER NOT NULL DEFAULT 10,
          status VARCHAR(50) NOT NULL DEFAULT 'HEALTHY' CHECK (status IN ('HEALTHY', 'DEGRADED', 'ERROR', 'DISABLED')),
          last_fetched_at TIMESTAMP WITH TIME ZONE,
          last_success_at TIMESTAMP WITH TIME ZONE,
          last_error TEXT,
          schema JSONB DEFAULT '[]'::jsonb,
          record_count INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE;
      ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE;
      ALTER TABLE knowledge_records ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
    `);

    // Execute schema.sql file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);

    console.log('✅ PostgreSQL database schema & migrations initialized successfully!');
  } catch (err: any) {
    console.warn('⚠️ Database init notice:', err.message);
  }
}

// Allow direct CLI execution: `npx tsx src/database/initDb.ts`
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
