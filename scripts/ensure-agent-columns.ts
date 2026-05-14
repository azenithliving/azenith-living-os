import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, { ssl: 'require' });

async function run() {
  console.log('Ensuring all specific columns for Agent APIs exist...');
  try {
    await sql.unsafe('ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS requires_action BOOLEAN DEFAULT false');
    await sql.unsafe('ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS action_taken BOOLEAN DEFAULT false');
    await sql.unsafe('ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()');
    await sql.unsafe('ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS context JSONB DEFAULT \'{}\'');
    // Using TEXT[] for participants if UUID[] is too restrictive for mixed IDs
    await sql.unsafe('ALTER TABLE agent_conversations ADD COLUMN IF NOT EXISTS participants TEXT[]');
    
    console.log('SUCCESS: Columns verified/created.');
  } catch (e) {
    console.error('FAILURE:', e.message);
  } finally {
    await sql.end();
  }
}
run();
