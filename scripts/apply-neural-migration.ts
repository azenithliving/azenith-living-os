import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  const connectionString = "postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
  const sql_client = postgres(connectionString);

  try {
    console.log("🚀 Connecting to Supabase via Direct URL...");

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '050_neural_sovereignty.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log("📄 Reading migration: 050_neural_sovereignty.sql");
    
    // Execute the SQL
    // postgres-js executes raw strings via sql.unsafe
    await sql_client.unsafe(sql);
    
    console.log("✅ Migration applied successfully! Neural core is now live in the database.");
  } catch (err) {
    console.error("❌ Failed to apply migration:", err);
    process.exit(1);
  } finally {
    await sql_client.end();
  }
}

applyMigration();
