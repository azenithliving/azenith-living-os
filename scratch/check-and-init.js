const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.consultant_learnings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instruction TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.consultant_pending_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL,
        question TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT now()
    );
  `;

  // We use direct query via postgres connection if available, 
  // but since we are using supabase client, we might need to use an RPC if enabled.
  // If not, we can try to use the REST API to check if tables exist first.
  
  console.log('--- [محاولة إنشاء الجداول] ---');
  console.log('يرجى التأكد من تشغيل ملف scratch/create-consultant-tables.sql في لوحة تحكم Supabase (SQL Editor) لضمان العمل بنسبة 100%');
  
  // Try a simple insert to see if tables exist
  const { error: err1 } = await supabase.from('consultant_learnings').select('id').limit(1);
  if (err1 && err1.code === 'PGRST204') {
    console.log('الجدول consultant_learnings غير موجود. يرجى إنشاؤه من SQL Editor.');
  } else {
    console.log('الجدول consultant_learnings موجود وجاهز.');
  }
}

createTables();
