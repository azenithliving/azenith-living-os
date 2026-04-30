const postgres = require('postgres');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = postgres(process.env.DATABASE_URL);

async function enableRealtime() {
  console.log('--- Enabling Realtime for Fate Table ---');
  try {
    // 1. تفعيل الهوية الكاملة للتغييرات
    await sql`ALTER TABLE reality_mutations REPLICA IDENTITY FULL`;
    
    // 2. إضافة الجدول للنشر اللحظي (إذا لم يكن مضافاً)
    // ملاحظة: قد يفشل هذا إذا كان الجدول مضافاً بالفعل، لذا سنستخدم محاولة آمنة
    try {
        await sql`ALTER PUBLICATION supabase_realtime ADD TABLE reality_mutations`;
    } catch (pubErr) {
        console.log('Note: Publication update might have already been active or needs manual check.');
    }
    
    console.log('✅ Realtime should be active now.');
  } catch (e) {
    console.error('❌ Realtime Setup Failed:', e);
  } finally {
    await sql.end();
  }
}

enableRealtime();
