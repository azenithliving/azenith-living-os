import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, { ssl: 'require' });

async function run() {
  console.log('Ensuring all system tables exist for Dashboard and Agents...');
  try {
    // 1. Agent Device Heartbeats
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_device_heartbeats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL REFERENCES agent_devices(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL,
        cpu_percent DECIMAL(5,2),
        memory_percent DECIMAL(5,2),
        disk_percent DECIMAL(5,2),
        active_tasks INTEGER DEFAULT 0,
        queue_depth INTEGER DEFAULT 0,
        network_latency_ms INTEGER,
        metadata JSONB,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 2. Agent Events
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        agent_profile_id UUID REFERENCES agent_profiles(id),
        device_id UUID REFERENCES agent_devices(id),
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB,
        task_id UUID REFERENCES agent_tasks(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 3. Agent Conversations
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        title VARCHAR(255),
        conversation_type VARCHAR(50) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // 4. Agent Messages
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
        sender_type VARCHAR(50) NOT NULL,
        sender_id UUID,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('SUCCESS: System tables verified/created.');
  } catch (e) {
    console.error('FAILURE:', e.message);
  } finally {
    await sql.end();
  }
}
run();
