const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLearnings() {
  const { data, error } = await supabase
    .from('consultant_learnings')
    .select('*');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('--- [قائمة التعليمات الموثقة للمستشار] ---');
  if (data.length === 0) {
    console.log('لا توجد تعليمات مسجلة حالياً. المستشار سيعتمد على القواعد الصارمة فقط.');
  } else {
    data.forEach((l, i) => {
      console.log(`${i+1}. ${l.instruction} (تم الإضافة في: ${l.created_at})`);
    });
  }
}

checkLearnings();
