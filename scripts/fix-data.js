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

async function fix() {
  console.log('🔧 Fixing data...\n');

  // Get real company
  const { data: companies } = await supabase.from('companies').select('*').limit(5);
  console.log('Companies:', companies?.map(c => `${c.id} (${c.name})`));

  const companyId = companies?.[0]?.id || '00000000-0000-0000-0000-000000000000';
  console.log('Using company_id:', companyId);

  // Get agent profiles
  const { data: agents } = await supabase.from('agent_profiles').select('*');
  const primeId = agents?.find(a => a.agent_key === 'prime')?.id;
  const vanguardId = agents?.find(a => a.agent_key === 'vanguard')?.id;
  console.log('PRIME ID:', primeId);
  console.log('Vanguard ID:', vanguardId);

  // Insert quality checks
  console.log('\n📋 Inserting quality checks...');
  const { data: qcData, error: qcError } = await supabase.from('quality_checks').insert([
    {
      company_id: companyId,
      job_title: 'طاولة سفرة خشب بلوط',
      check_type: 'incoming_material',
      status: 'pass',
      notes: 'الخشب مطابق للمواصفات - جودة ممتازة',
      checked_by: 'فريق الجودة',
    },
    {
      company_id: companyId,
      job_title: 'كنبة زاوية مودرن',
      check_type: 'in_process',
      status: 'conditional_pass',
      notes: 'التنجيد جيد مع ملاحظات بسيطة',
      checked_by: 'فريق الجودة',
    },
    {
      company_id: companyId,
      job_title: 'خزانة ملابس كلاسيك',
      check_type: 'final',
      status: 'pass',
      notes: 'المنتج جاهز للتسليم',
      checked_by: 'فريق الجودة',
    },
  ]).select();

  if (qcError) {
    console.log('  ❌ QC Error:', qcError.message);
  } else {
    console.log(`  ✅ Created ${qcData?.length} quality checks`);
  }

  // Insert events
  console.log('\n🔔 Inserting events...');
  const { data: evData, error: evError } = await supabase.from('agent_events').insert([
    {
      company_id: companyId,
      agent_profile_id: primeId,
      event_type: 'task_complete',
      event_data: { message: 'تم إكمال تصميم مجلس كلاسيكي بنجاح', title: 'مهمة مكتملة' },
      severity: 'success',
    },
    {
      company_id: companyId,
      agent_profile_id: vanguardId,
      event_type: 'task_complete',
      event_data: { message: 'تم الاتصال بالعميل وتم تأكيد الموعد', title: 'متابعة ناجحة' },
      severity: 'success',
    },
    {
      company_id: companyId,
      agent_profile_id: primeId,
      event_type: 'suggestion',
      event_data: { message: 'أقترح مراجعة خط إنتاج الخزائن الأسبوع القادم', title: 'اقتراح' },
      severity: 'info',
    },
    {
      company_id: companyId,
      agent_profile_id: vanguardId,
      event_type: 'escalation',
      event_data: { message: 'عميل مشروع فيلا المعادي يحتاج متابعة عاجلة', title: 'تنبيه عاجل' },
      severity: 'warning',
    },
  ]).select();

  if (evError) {
    console.log('  ❌ Events Error:', evError.message);
  } else {
    console.log(`  ✅ Created ${evData?.length} events`);
  }

  // Insert command logs
  console.log('\n⌨️ Inserting command logs...');
  const { data: logData, error: logError } = await supabase.from('immutable_command_log').insert([
    { user_id: 'admin', command_text: 'عرض حالة الوكلاء', status: 'executed' },
    { user_id: 'admin', command_text: 'فحص جودة خط الإنتاج', status: 'executed' },
    { user_id: 'admin', command_text: 'إرسال عرض سعر للعميل', status: 'executed' },
  ]).select();

  if (logError) {
    console.log('  ❌ Logs Error:', logError.message);
  } else {
    console.log(`  ✅ Created ${logData?.length} command logs`);
  }

  // Insert agent tasks
  console.log('\n📝 Inserting agent tasks...');
  const { data: taskData, error: taskError } = await supabase.from('agent_tasks').insert([
    {
      company_id: companyId,
      agent_profile_id: primeId,
      task_type: 'design',
      title: 'تصميم مجلس كلاسيكي فاخر',
      description: 'تصميم مجلس بطراز كلاسيكي مع لمسات ذهبية',
      status: 'completed',
      progress_percent: 100,
      started_at: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date(Date.now() - 1800000).toISOString(),
      actual_duration_minutes: 30,
    },
    {
      company_id: companyId,
      agent_profile_id: vanguardId,
      task_type: 'sales',
      title: 'متابعة عميل مشروع فيلا المعادي',
      description: 'اتصال بالعميل لمتابعة عرض السعر',
      status: 'completed',
      progress_percent: 100,
      started_at: new Date(Date.now() - 1800000).toISOString(),
      completed_at: new Date(Date.now() - 900000).toISOString(),
      actual_duration_minutes: 15,
    },
    {
      company_id: companyId,
      agent_profile_id: primeId,
      task_type: 'research',
      title: 'بحث عن اتجاهات الأثاث 2026',
      description: 'تحليل أحدث اتجاهات تصميم الأثاث',
      status: 'running',
      progress_percent: 40,
      started_at: new Date(Date.now() - 600000).toISOString(),
    },
  ]).select();

  if (taskError) {
    console.log('  ❌ Tasks Error:', taskError.message);
  } else {
    console.log(`  ✅ Created ${taskData?.length} tasks`);
  }

  console.log('\n✅ Done!');
}

fix().catch(console.error);
