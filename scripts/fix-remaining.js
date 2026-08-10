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

async function fixRemaining() {
  const companyId = 'dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d';
  const { data: agents } = await supabase.from('agent_profiles').select('*');
  const primeId = agents?.find(a => a.agent_key === 'prime')?.id;
  const vanguardId = agents?.find(a => a.agent_key === 'vanguard')?.id;

  // Fix events (without severity)
  console.log('🔔 Inserting events (fixed)...');
  const { data: evData, error: evError } = await supabase.from('agent_events').insert([
    {
      company_id: companyId,
      agent_profile_id: primeId,
      event_type: 'task_complete',
      event_data: { message: 'تم إكمال تصميم مجلس كلاسيكي بنجاح', title: 'مهمة مكتملة' },
    },
    {
      company_id: companyId,
      agent_profile_id: vanguardId,
      event_type: 'task_complete',
      event_data: { message: 'تم الاتصال بالعميل وتم تأكيد الموعد', title: 'متابعة ناجحة' },
    },
    {
      company_id: companyId,
      agent_profile_id: primeId,
      event_type: 'suggestion',
      event_data: { message: 'أقترح مراجعة خط إنتاج الخزائن الأسبوع القادم', title: 'اقتراح' },
    },
    {
      company_id: companyId,
      agent_profile_id: vanguardId,
      event_type: 'escalation',
      event_data: { message: 'عميل مشروع فيلا المعادي يحتاج متابعة عاجلة', title: 'تنبيه عاجل' },
    },
  ]).select();

  if (evError) {
    console.log('  ❌ Events Error:', evError.message);
  } else {
    console.log(`  ✅ Created ${evData?.length} events`);
  }

  // Fix command logs (without user_id or with null)
  console.log('\n⌨️ Inserting command logs (fixed)...');
  const { data: logData, error: logError } = await supabase.from('immutable_command_log').insert([
    { command_text: 'عرض حالة الوكلاء', status: 'executed' },
    { command_text: 'فحص جودة خط الإنتاج', status: 'executed' },
    { command_text: 'إرسال عرض سعر للعميل', status: 'executed' },
  ]).select();

  if (logError) {
    console.log('  ❌ Logs Error:', logError.message);
  } else {
    console.log(`  ✅ Created ${logData?.length} command logs`);
  }

  console.log('\n✅ All fixed!');
}

fixRemaining().catch(console.error);
