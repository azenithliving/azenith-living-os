import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = "https://dmavypdmtbxzwrexqesu.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtYXZ5cGRtdGJ4endyZXhxZXN1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI1NDU2MywiZXhwIjoyMDkwODMwNTYzfQ.0W_EsDD1J_UTKhmdbJy-HC0-lur6Q3qiCQK9_Yk0MVg";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' }
});

async function runMigration() {
  console.log('🔄 Reading migration file...');
  const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260923_qayyim_foundation.sql');
  const sql = readFileSync(migrationPath, 'utf-8');
  
  console.log('📄 Migration loaded, size:', sql.length, 'chars');
  
  // Split by semicolon but be careful with function bodies
  const statements = splitSqlStatements(sql);
  console.log(`📋 Found ${statements.length} statements to execute`);
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim();
    if (!stmt || stmt.startsWith('--')) continue;
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        // Try direct query via PostgREST
        const { error: err2 } = await supabase.from('_dummy').select('1').limit(0);
        // If rpc doesn't exist, try using raw SQL via REST
        console.log(`⚠️ Statement ${i+1} needs manual execution (RPC not available):`);
        console.log(stmt.substring(0, 200) + '...');
        failed++;
      } else {
        success++;
        if (success % 10 === 0) console.log(`✅ Executed ${success} statements...`);
      }
    } catch (e) {
      console.log(`❌ Statement ${i+1} failed:`, e instanceof Error ? e.message : String(e));
      failed++;
    }
  }
  
  console.log(`\n📊 Summary: ${success} succeeded, ${failed} need manual execution`);
  
  if (failed > 0) {
    console.log('\n📝 Please run the full migration in Supabase SQL Editor:');
    console.log('   1. Go to https://supabase.com/dashboard/project/dmavypdmtbxzwrexqesu/sql/new');
    console.log('   2. Paste the contents of supabase/migrations/20260923_qayyim_foundation.sql');
    console.log('   3. Click Run');
  }
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inFunction = false;
  let dollarTag = '';
  
  const lines = sql.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Detect dollar-quoted function bodies
    if (trimmed.match(/^\$\w*\$/)) {
      if (!inFunction) {
        inFunction = true;
        dollarTag = trimmed;
      } else if (trimmed === dollarTag) {
        inFunction = false;
        dollarTag = '';
      }
    }
    
    current += line + '\n';
    
    // Split on semicolon only if not in function body
    if (!inFunction && trimmed.endsWith(';') && !trimmed.startsWith('--')) {
      statements.push(current);
      current = '';
    }
  }
  
  if (current.trim()) statements.push(current);
  return statements;
}

runMigration().catch(console.error);