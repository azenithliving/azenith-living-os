import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from('agent_messages').select('*').order('created_at', { ascending: false }).limit(1);
if (error) throw new Error(error.message);
console.log(Object.keys(data[0] || {}).join(' · '));
