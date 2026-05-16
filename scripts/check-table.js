
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.join(__dirname, '..', '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY);

async function checkTable() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'consultant_sessions' });
  // If RPC doesn't exist, try a simple select
  if (error) {
    const { data: cols, error: err2 } = await supabase.from('consultant_sessions').select('*').limit(1);
    if (err2) {
      console.error('Error:', err2);
    } else {
      console.log('Columns:', Object.keys(cols[0] || {}));
    }
  } else {
    console.log('Columns:', data);
  }
}

checkTable();
