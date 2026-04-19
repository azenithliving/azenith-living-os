require('dotenv').config({ path: '.env.local' });

const projectRef = 'dmavypdmtbxzwrexqesu';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = `
CREATE TABLE IF NOT EXISTS public.consultant_learnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instruction TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.consultant_pending_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT,
    question TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);
`;

async function createTables() {
  // Try Supabase Management API
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  console.log('Management API Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.substring(0, 500));
  
  if (res.status !== 200) {
    console.log('\n⚠️ Management API فشل. جرب pg مباشرة...');
    // Try direct postgres connection
    try {
      const { Client } = require('pg');
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      await client.query(sql);
      await client.end();
      console.log('✅ تم إنشاء الجداول عبر PostgreSQL المباشر!');
    } catch (pgErr) {
      console.error('❌ pg error:', pgErr.message);
      console.log('\n⚠️ الحل: اذهب لهذا الرابط وانسخ SQL من الملف scratch/create-consultant-tables.sql');
      console.log('https://supabase.com/dashboard/project/dmavypdmtbxzwrexqesu/sql/new');
    }
  } else {
    console.log('✅ تم إنشاء الجداول!');
  }
}

createTables().catch(e => console.error('FATAL:', e.message));
