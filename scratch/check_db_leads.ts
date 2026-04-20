import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkLeads() {
  console.log('--- Checking Consultant Sessions ---')
  const { data: sessions, error: sError } = await supabase
    .from('consultant_sessions')
    .select('id, session_id, user_name')
    .limit(10)
  
  if (sError) console.error('Sessions Error:', sError)
  else console.log('Recent Sessions:', sessions)

  console.log('\n--- Checking Telemetry Data ---')
  const { data: telemetry, error: tError } = await supabase
    .from('visitor_telemetry')
    .select('id, session_id')
    .limit(10)
    
  if (tError) console.error('Telemetry Error:', tError)
  else console.log('Recent Telemetry:', telemetry)
}

checkLeads()
