import { supabaseServer } from './lib/dal/unified-supabase.ts';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function debugDevices() {
  console.log('--- DEBUGGING AGENT DEVICES ---');
  const companyId = '00000000-0000-0000-0000-000000000001'; // Try ...01
  
  const { data, error } = await supabaseServer
    .from('agent_devices')
    .select('*, agent_device_heartbeats(*)')
    .eq('company_id', companyId);

  if (error) {
    console.error('❌ Error fetching devices:', error);
  } else {
    console.log('✅ Success! Found devices:', data.length);
    console.log(JSON.stringify(data, null, 2));
  }
}

debugDevices();
