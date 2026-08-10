const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadEnv();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function fixLogs() {
  // Try with all required fields
  console.log('⌨️ Trying command logs with UUID user_id...');
  
  // First get a real user
  const { data: users } = await supabase.from('auth.users').select('id').limit(1);
  console.log('Users:', users);
  
  // Try with null user_id
  const { data: logData, error: logError } = await supabase.from('immutable_command_log').insert([
    { command_text: 'عرض حالة الوكلاء', status: 'executed', user_id: null },
  ]).select();

  if (logError) {
    console.log('  ❌ Error with null:', logError.message);
    
    // Try with a fake UUID
    const { data: logData2, error: logError2 } = await supabase.from('immutable_command_log').insert([
      { command_text: 'عرض حالة الوكلاء', status: 'executed', user_id: '00000000-0000-0000-0000-000000000000' },
    ]).select();
    
    if (logError2) {
      console.log('  ❌ Error with UUID:', logError2.message);
    } else {
      console.log('  ✅ Created with fake UUID');
    }
  } else {
    console.log('  ✅ Created with null user_id');
  }
}

fixLogs().catch(console.error);
