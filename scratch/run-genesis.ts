import { SovereignArchitect } from '../lib/sovereign-architect';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log("🚀 Starting Sovereign Genesis Migration...");
  const sqlPath = path.join(process.cwd(), 'lib', 'supabase', 'genesis_migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  const architect = SovereignArchitect.getInstance();
  try {
    // We use a internal method or just call a direct supabase query if we have access
    // Since evolveSchema is private, we will mock the logic or use the supabase admin directly
    const { getSupabaseAdminClient } = await import('../lib/supabase-admin');
    const supabase = getSupabaseAdminClient();
    
    if (!supabase) {
      console.error("❌ Failed to connect to Supabase Admin.");
      return;
    }

    console.log("🔗 Injecting Sovereign Schema into the substrate...");
    const { error } = await supabase.rpc('execute_sql', { sql_query: sql });
    
    if (error) {
      console.error("❌ Migration Failed:", error.message);
      console.log("⚠️ Note: Make sure the 'execute_sql' RPC exists in your Supabase project.");
    } else {
      console.log("✅ Sovereign Genesis Migration Complete. Reality manifested.");
    }
  } catch (err) {
    console.error("💥 Critical Failure during migration:", err);
  }
}

runMigration();
