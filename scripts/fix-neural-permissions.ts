import postgres from 'postgres';

async function fixPermissions() {
  const connectionString = "postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
  const sql = postgres(connectionString);

  try {
    console.log("🔓 Unlocking Neural Tables (Disabling RLS for now)...");
    
    await sql`ALTER TABLE neural_stream DISABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE evolution_log DISABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE neural_knowledge DISABLE ROW LEVEL SECURITY;`;
    
    console.log("✅ Tables unlocked. AI can now write to them.");
  } catch (err) {
    console.error("❌ Failed to unlock tables:", err);
  } finally {
    await sql.end();
  }
}

fixPermissions();
