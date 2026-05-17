import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const tables = ['consultant_faq','requests','users','companies','pages','leads','consultant_sessions','consultant_learnings','consultant_pending_questions','bookings','automation_rules','api_keys'];
for (const t of tables) {
  const { error } = await sb.from(t).select('id').limit(1);
  console.log(`${t}: ${error ? error.message : 'OK'}`);
}
