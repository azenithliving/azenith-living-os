const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (error) {
    console.error('Error:', error);
    // Fallback: try a direct query
    const { data: data2, error: error2 } = await supabase.rpc('get_tables');
    if (error2) console.error('Fallback error:', error2);
    else console.log('Tables via RPC:', data2);
    return;
  }

  console.log('Available Tables in public schema:');
  data.forEach(t => console.log(`- ${t.table_name}`));
}

listTables();
