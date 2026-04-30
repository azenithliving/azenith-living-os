const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvents() {
  console.log('--- [فحص سجل الأحداث: التفاعلات الأخيرة] ---');
  
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Last 5 Events:');
  data.forEach(e => {
    console.log(`- [${e.created_at}] Type: ${e.type}, Value: ${e.value}`);
    if (e.metadata) console.log(`  Metadata: ${JSON.stringify(e.metadata)}`);
  });
}

checkEvents();
