import postgres from 'postgres';

async function clearOldEnglishLogs() {
  const connectionString = "postgresql://postgres.dmavypdmtbxzwrexqesu:3laa1992aziz@aws-1-eu-central-1.pooler.supabase.com:5432/postgres";
  const sql = postgres(connectionString);

  try {
    console.log("🧹 Cleaning up old English logs and proposals...");
    
    // Delete old logs that contain English technical terms
    await sql`DELETE FROM neural_stream WHERE agent_name = 'Executive Agent';`;
    await sql`DELETE FROM evolution_log WHERE description LIKE '%Optimize%';`;
    
    console.log("✅ Database cleaned. Only new Arabic records will remain.");
  } catch (err) {
    console.error("❌ Failed to clean database:", err);
  } finally {
    await sql.end();
  }
}

clearOldEnglishLogs();
