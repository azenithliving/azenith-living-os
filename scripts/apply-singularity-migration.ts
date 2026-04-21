import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

async function applyMigration() {
  // Use the connection string found in the previous script
  const connectionString = "postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
  const sql_client = postgres(connectionString);

  try {
    console.log("🚀 Connecting to Supabase for Singularity Kernel initialization...");

    const migrations = [
      '071_execute_sql.sql'
    ];
    
    for (const migrationName of migrations) {
      console.log(`📄 Reading migration: ${migrationName}`);
      const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', migrationName);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute the SQL
      await sql_client.unsafe(sql);
      console.log(`✅ ${migrationName} applied successfully!`);
    }
  } catch (err) {
    console.error("❌ Failed to apply singularity migration:", err);
    process.exit(1);
  } finally {
    await sql_client.end();
  }
}

applyMigration();
