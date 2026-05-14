import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, { ssl: 'require' });

async function run() {
  console.log('Manually creating the ESSENTIAL Agent Ecosystem tables...');
  try {
    // Agent Profiles
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        agent_key VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        avatar_url TEXT,
        capabilities JSONB DEFAULT '[]',
        config JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Agent Devices
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        device_key VARCHAR(255) UNIQUE NOT NULL,
        device_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'offline',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Agent Tasks
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL,
        agent_profile_id UUID REFERENCES agent_profiles(id),
        device_id UUID REFERENCES agent_devices(id),
        task_type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        progress_percent INTEGER DEFAULT 0,
        priority INTEGER DEFAULT 0,
        context JSONB DEFAULT '{}',
        input_data JSONB,
        output_data JSONB,
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('SUCCESS: Essential tables created.');
  } catch (e) {
    console.error('FAILURE:', e.message);
  } finally {
    await sql.end();
  }
}
run();
