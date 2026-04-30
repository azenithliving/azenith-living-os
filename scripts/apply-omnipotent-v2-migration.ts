import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  const connectionString = "postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
  const sql_client = postgres(connectionString);

  try {
    console.log("🚀 Connecting to Supabase via Direct URL...");

    const migrationPath = path.join(process.cwd(), 'lib', 'supabase', 'omnipotent_v2_migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log("📄 Reading migration: omnipotent_v2_migration.sql");
    
    // Execute the SQL
    await sql_client.unsafe(sql);
    
    console.log("✅ Omnipotent V2 Migration applied successfully! Sovereign DB is fully upgraded.");
  } catch (err) {
    console.error("❌ Failed to apply migration:", err);
    process.exit(1);
  } finally {
    await sql_client.end();
  }
}

applyMigration();
