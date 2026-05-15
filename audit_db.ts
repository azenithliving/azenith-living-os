
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function auditDatabase() {
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const tables = [
    "users",
    "requests",
    "consultant_sessions",
    "api_keys",
    "agent_devices",
    "agent_tasks",
    "media_items",
    "events"
  ];

  console.log("--- Database Audit Report ---");
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      
      if (error) {
        console.log(`Table [${table}]: ERROR - ${error.message}`);
      } else {
        console.log(`Table [${table}]: ${count} records`);
      }
    } catch (e: any) {
      console.log(`Table [${table}]: CRASH - ${e.message}`);
    }
  }
}

auditDatabase();
