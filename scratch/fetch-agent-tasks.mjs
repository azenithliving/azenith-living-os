import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  console.log("=== AGENT PROFILES ===");
  const { data: profiles, error: pErr } = await supabase
    .from("agent_profiles")
    .select("*");
  if (pErr) console.error("Error fetching profiles:", pErr);
  else console.table(profiles);

  console.log("\n=== AGENT TASKS ===");
  const { data: tasks, error: tErr } = await supabase
    .from("agent_tasks")
    .select("*")
    .order("created_at", { ascending: false });
  if (tErr) console.error("Error fetching tasks:", tErr);
  else {
    console.log(`Total tasks found: ${tasks.length}`);
    tasks.forEach((t, i) => {
      console.log(`\n--- Task #${i + 1} ---`);
      console.log(`ID: ${t.id}`);
      console.log(`Agent Profile ID: ${t.agent_profile_id}`);
      console.log(`Task Type: ${t.task_type || t.type}`);
      console.log(`Status: ${t.status}`);
      console.log(`Created At: ${t.created_at}`);
      console.log(`Started At: ${t.started_at}`);
      console.log(`Completed At: ${t.completed_at}`);
      console.log(`Input/Details:`, JSON.stringify(t.input_data || t.payload || t.description || t.params || {}, null, 2));
      console.log(`Output/Result:`, JSON.stringify(t.result || t.output || t.output_data || {}, null, 2));
    });
  }
}

run();
