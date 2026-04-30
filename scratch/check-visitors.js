const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkVisitorSessions() {
  console.log('--- [فحص جلسات الزوار: المحاولات الأخيرة] ---');
  
  const { data, error } = await supabase
    .from('visitor_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (data && data.length > 0) {
    data.forEach(s => {
      console.log(`- [${s.created_at}] SessionID: ${s.session_id}, Intent: ${s.intent}, LeadScore: ${s.lead_score}`);
    });
  } else {
    console.log('لا توجد جلسات زوار مسجلة.');
  }
}

checkVisitorSessions();
