import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!;
if (!connectionString) {
  console.error('DATABASE_URL or DIRECT_URL not found in environment.');
  process.exit(1);
}

console.log('Using connection string:', connectionString.split('@')[1]);

const sqlClient = postgres(connectionString, {
  ssl: 'require',
  max: 1
});

async function main() {
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260423_agents.sql');
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('Applying migration...');
  
  try {
    await sqlClient.unsafe(sqlContent);
    console.log('SUCCESS: Migration applied.');
  } catch (err) {
    console.error('FAILURE: Error executing migration:');
    console.error(err);
    process.exit(1);
  } finally {
    await sqlClient.end();
  }
}

main();
