import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, { ssl: 'require' });

async function seed() {
  console.log('Final seeding with schema corrections...');
  const companyId = '00000000-0000-0000-0000-000000000000';
  
  try {
    // 1. Fix column if missing
    await sql.unsafe(`ALTER TABLE agent_devices ADD COLUMN IF NOT EXISTS hostname VARCHAR(255)`);
    await sql.unsafe(`ALTER TABLE agent_devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ`);
    await sql.unsafe(`ALTER TABLE agent_devices ADD COLUMN IF NOT EXISTS current_task_count INTEGER DEFAULT 0`);

    // 2. Insert Profiles
    await sql.unsafe(`
      INSERT INTO agent_profiles (company_id, agent_key, name, description)
      VALUES 
        ('${companyId}', 'prime', 'PRIME (Engineer)', 'المسؤول عن الكود والتصنيع والبحث'),
        ('${companyId}', 'vanguard', 'Vanguard (Sales)', 'المسؤول عن التواصل والمبيعات')
      ON CONFLICT (agent_key) DO NOTHING
    `);

    // 3. Insert Devices
    const devices = [
      { key: 'powerhouse-alpha', type: 'docker_container', host: 'powerhouse-alpha' },
      { key: 'powerhouse-beta', type: 'docker_container', host: 'powerhouse-beta' }
    ];

    for (const d of devices) {
      const [device] = await sql.unsafe(`
        INSERT INTO agent_devices (company_id, device_key, device_type, hostname, status, last_seen_at)
        VALUES ('${companyId}', '${d.key}', '${d.type}', '${d.host}', 'online', NOW())
        ON CONFLICT (device_key) DO UPDATE SET status = 'online', last_seen_at = NOW()
        RETURNING id
      `);

      // 4. Insert Heartbeat
      await sql.unsafe(`
        INSERT INTO agent_device_heartbeats (device_id, status, cpu_percent, memory_percent, active_tasks)
        VALUES ('${device.id}', 'online', ${Math.random() * 20}, ${40 + Math.random() * 10}, 0)
      `);
    }

    console.log('SUCCESS: Full seed complete.');
  } catch (e) {
    console.error('FAILURE:', e.message);
  } finally {
    await sql.end();
  }
}
seed();
