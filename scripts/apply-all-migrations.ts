import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
const sqlClient = postgres(connectionString, { ssl: 'require', max: 1 });

async function runMigration(fileName: string) {
  const migrationPath = path.join(process.cwd(), 'supabase/migrations', fileName);
  if (!fs.existsSync(migrationPath)) {
    console.warn(`WARNING: Migration file ${fileName} not found, skipping.`);
    return;
  }
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  console.log(`Applying migration: ${fileName}...`);
  try {
    // We try to run the whole block
    await sqlClient.unsafe(sqlContent);
    console.log(`SUCCESS: ${fileName} applied.`);
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('already a trigger')) {
      console.log(`INFO: Some objects in ${fileName} already exist, continuing...`);
    } else {
      console.error(`FAILURE in ${fileName}: ${err.message}`);
      // Don't throw, try to continue with other files as they might be independent
    }
  }
}

async function main() {
  const migrations = [
    '002_sovereign_protocol.sql',
    '028_agent_memory.sql',
    '029_fix_agent_memory.sql',
    '20260423_manufacturing.sql',
    '20260423_agents.sql'
  ];

  for (const m of migrations) {
    await runMigration(m);
  }
  
  console.log('MIGRATION SEQUENCE FINISHED.');
  await sqlClient.end();
}

main();
