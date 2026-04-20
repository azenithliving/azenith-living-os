const postgres = require('postgres');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL);

async function setup() {
  console.log('--- Connecting to Database ---');
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS reality_mutations (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    console.log('✅ Table "reality_mutations" is ready.');
  } catch (e) {
    console.error('❌ Setup Failed:', e);
  } finally {
    await sql.end();
  }
}

setup();
