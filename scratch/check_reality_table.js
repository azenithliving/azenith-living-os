const postgres = require('postgres');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL);

async function checkTable() {
  console.log('--- Checking reality_mutations table ---');
  try {
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reality_mutations'
    `;
    console.log('Columns:', columns);
    
    const hasActive = columns.some(c => c.column_name === 'active');
    if (!hasActive) {
      console.log('❌ Column "active" is MISSING. Adding it now...');
      await sql`ALTER TABLE reality_mutations ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`;
      console.log('✅ Column "active" added.');
    } else {
      console.log('✅ Column "active" exists.');
    }

    const hasPayload = columns.some(c => c.column_name === 'payload');
    if (!hasPayload) {
      console.log('❌ Column "payload" is MISSING. Adding it now...');
      await sql`ALTER TABLE reality_mutations ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb`;
      console.log('✅ Column "payload" added.');
    } else {
      console.log('✅ Column "payload" exists.');
    }

  } catch (e) {
    console.error('❌ Table Check Failed:', e);
  } finally {
    await sql.end();
  }
}

checkTable();
