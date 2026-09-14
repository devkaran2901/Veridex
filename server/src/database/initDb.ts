import fs from 'fs';
import path from 'path';
import { pool } from './db';

export async function initDatabase() {
  try {
    console.log('🔄 Initializing PostgreSQL schema & pgvector extension...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    
    await pool.query(sql);
    console.log('✅ PostgreSQL database schema initialized successfully!');
  } catch (err) {
    console.error('❌ Failed to initialize database schema:', err);
    throw err;
  }
}

// Allow direct CLI execution: `npx tsx src/database/initDb.ts`
if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
