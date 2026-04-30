import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl!, supabaseKey!)

async function checkSchema() {
  const { data, error } = await supabase
    .from('consultant_sessions')
    .select('*')
    .limit(1)
  
  if (error) console.error(error)
  else console.log('Columns in consultant_sessions:', Object.keys(data[0] || {}))
}

checkSchema()
