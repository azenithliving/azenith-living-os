const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkResults() {
  console.log('--- [فحص بيانات Supabase: المستشار الذكي] ---');
  
  const { data, error } = await supabase
    .from('consultant_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  if (data && data.length > 0) {
    const s = data[0];
    console.log(`ID الجلسة: ${s.session_id}`);
    console.log(`تاريخ البدء: ${s.created_at}`);
    console.log('المحادثة الحقيقية:');
    s.messages.forEach((m) => {
      console.log(` - [${m.role}]: ${m.content}`);
    });
    
    console.log('\nتحليلات العميل (Insights) التي استخرجها الذكاء الاصطناعي:');
    console.log(JSON.stringify(s.insights, null, 2));
  } else {
    console.log('لا توجد جلسات مسجلة.');
  }
}

checkResults();
