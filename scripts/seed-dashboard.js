/**
 * Seed Script - Populates database with initial data for dashboard
 * Run with: node scripts/seed-dashboard.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('.env.local not found at:', envPath);
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
  console.log('Loaded env from .env.local');
  console.log('SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'FOUND' : 'MISSING');
  console.log('SERVICE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'FOUND' : 'MISSING');
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing environment variables!');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const COMPANY_ID = '00000000-0000-0000-0000-000000000000';

async function seed() {
  console.log('🌱 Starting seed...\n');

  // 1. Ensure agent profiles exist
  console.log('📋 Creating agent profiles...');
  const { data: existingProfiles } = await supabase
    .from('agent_profiles')
    .select('agent_key')
    .in('agent_key', ['prime', 'vanguard']);

  const existingKeys = (existingProfiles || []).map((p) => p.agent_key);

  if (!existingKeys.includes('prime')) {
    await supabase.from('agent_profiles').insert({
      company_id: COMPANY_ID,
      agent_key: 'prime',
      name: 'PRIME',
      description: 'كبير مهندسي التصميم والتطوير',
      capabilities: ['research', 'code_generation', 'design_ai', 'manufacturing_analysis'],
      is_active: true,
    });
    console.log('  ✅ PRIME created');
  } else {
    console.log('  ⏭️ PRIME already exists');
  }

  if (!existingKeys.includes('vanguard')) {
    await supabase.from('agent_profiles').insert({
      company_id: COMPANY_ID,
      agent_key: 'vanguard',
      name: 'Vanguard',
      description: 'مدير العمليات والمبيعات',
      capabilities: ['customer_communication', 'sales_management', 'project_management'],
      is_active: true,
    });
    console.log('  ✅ Vanguard created');
  } else {
    console.log('  ⏭️ Vanguard already exists');
  }

  // 2. Get agent profile IDs
  const { data: profiles } = await supabase
    .from('agent_profiles')
    .select('id, agent_key')
    .in('agent_key', ['prime', 'vanguard']);

  const primeId = profiles?.find((p) => p.agent_key === 'prime')?.id;
  const vanguardId = profiles?.find((p) => p.agent_key === 'vanguard')?.id;

  // 3. Create sample agent tasks
  console.log('\n📝 Creating sample tasks...');
  const { data: existingTasks } = await supabase
    .from('agent_tasks')
    .select('id')
    .limit(1);

  if (!existingTasks || existingTasks.length === 0) {
    const tasks = [
      {
        company_id: COMPANY_ID,
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
        company_id: COMPANY_ID,
        agent_profile_id: primeId,
        task_type: 'manufacturing',
        title: 'مراجعة خط إنتاج الخزائن',
        description: 'فحص جودة خط إنتاج الخزائن الجديدة',
        status: 'completed',
        progress_percent: 100,
        started_at: new Date(Date.now() - 7200000).toISOString(),
        completed_at: new Date(Date.now() - 5400000).toISOString(),
        actual_duration_minutes: 30,
      },
      {
        company_id: COMPANY_ID,
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
        company_id: COMPANY_ID,
        agent_profile_id: vanguardId,
        task_type: 'follow_up',
        title: 'إرسال عرض سعر لمقهى جديد',
        description: 'تجهيز وإرسال عرض سعر لتصميم مقهى في الشيخ زايد',
        status: 'running',
        progress_percent: 60,
        started_at: new Date(Date.now() - 600000).toISOString(),
      },
      {
        company_id: COMPANY_ID,
        agent_profile_id: primeId,
        task_type: 'research',
        title: 'بحث عن اتجاهات الأثاث 2026',
        description: 'تحليل أحدث اتجاهات تصميم الأثاث للعام الجديد',
        status: 'pending',
        progress_percent: 0,
      },
    ];

    await supabase.from('agent_tasks').insert(tasks);
    console.log(`  ✅ Created ${tasks.length} tasks`);
  } else {
    console.log('  ⏭️ Tasks already exist');
  }

  // 4. Create sample quality checks
  console.log('\n🔍 Creating sample quality checks...');
  const { data: existingQC } = await supabase
    .from('quality_checks')
    .select('id')
    .limit(1);

  if (!existingQC || existingQC.length === 0) {
    const checks = [
      {
        company_id: COMPANY_ID,
        job_title: 'طاولة سفرة خشب بلوط',
        check_type: 'incoming_material',
        status: 'pass',
        notes: 'الخشب مطابق للمواصفات - جودة ممتازة',
        checked_by: 'فريق الجودة',
        checked_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        company_id: COMPANY_ID,
        job_title: 'كنبة زاوية مودرن',
        check_type: 'in_process',
        status: 'conditional_pass',
        notes: 'التنجيد جيد مع ملاحظات بسيطة على الخياطة',
        checked_by: 'فريق الجودة',
        checked_at: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        company_id: COMPANY_ID,
        job_title: 'خزانة ملابس كلاسيك',
        check_type: 'final',
        status: 'pass',
        notes: 'المنتج جاهز للتسليم - جودة عالية',
        checked_by: 'فريق الجودة',
        checked_at: new Date(Date.now() - 21600000).toISOString(),
      },
    ];

    await supabase.from('quality_checks').insert(checks);
    console.log(`  ✅ Created ${checks.length} quality checks`);
  } else {
    console.log('  ⏭️ Quality checks already exist');
  }

  // 5. Create sample agent events (notifications)
  console.log('\n🔔 Creating sample events...');
  const { data: existingEvents } = await supabase
    .from('agent_events')
    .select('id')
    .limit(1);

  if (!existingEvents || existingEvents.length === 0) {
    const events = [
      {
        company_id: COMPANY_ID,
        agent_profile_id: primeId,
        event_type: 'task_complete',
        event_data: { message: 'تم إكمال تصميم مجلس كلاسيكي بنجاح', title: 'مهمة مكتملة' },
        severity: 'success',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        company_id: COMPANY_ID,
        agent_profile_id: vanguardId,
        event_type: 'task_complete',
        event_data: { message: 'تم الاتصال بالعميل وتم تأكيد الموعد', title: 'متابعة ناجحة' },
        severity: 'success',
        created_at: new Date(Date.now() - 900000).toISOString(),
      },
      {
        company_id: COMPANY_ID,
        agent_profile_id: primeId,
        event_type: 'suggestion',
        event_data: { message: 'أقترح مراجعة خط إنتاج الخزائن الأسبوع القادم', title: 'اقتراح' },
        severity: 'info',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        company_id: COMPANY_ID,
        agent_profile_id: vanguardId,
        event_type: 'escalation',
        event_data: { message: 'عميل مشروع فيلا المعادي يحتاج متابعة عاجلة', title: 'تنبيه عاجل' },
        severity: 'warning',
        created_at: new Date(Date.now() - 600000).toISOString(),
      },
    ];

    await supabase.from('agent_events').insert(events);
    console.log(`  ✅ Created ${events.length} events`);
  } else {
    console.log('  ⏭️ Events already exist');
  }

  // 6. Create sample command logs
  console.log('\n⌨️ Creating sample command logs...');
  const { data: existingLogs } = await supabase
    .from('immutable_command_log')
    .select('id')
    .limit(1);

  if (!existingLogs || existingLogs.length === 0) {
    const logs = [
      {
        user_id: 'admin',
        command_text: 'عرض حالة الوكلاء',
        status: 'executed',
        executed_at: new Date(Date.now() - 300000).toISOString(),
      },
      {
        user_id: 'admin',
        command_text: 'فحص جودة خط الإنتاج',
        status: 'executed',
        executed_at: new Date(Date.now() - 600000).toISOString(),
      },
      {
        user_id: 'admin',
        command_text: 'إرسال عرض سعر للعميل',
        status: 'executed',
        executed_at: new Date(Date.now() - 900000).toISOString(),
      },
    ];

    await supabase.from('immutable_command_log').insert(logs);
    console.log(`  ✅ Created ${logs.length} command logs`);
  } else {
    console.log('  ⏭️ Command logs already exist');
  }

  console.log('\n🎉 Seed completed successfully!');
  console.log('\nDashboard now has:');
  console.log('  - 2 agent profiles (PRIME, Vanguard)');
  console.log('  - 5 agent tasks (3 completed, 1 running, 1 pending)');
  console.log('  - 3 quality checks');
  console.log('  - 4 notification events');
  console.log('  - 3 command logs');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
