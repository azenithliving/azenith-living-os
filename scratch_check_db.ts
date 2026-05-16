import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking consultant_learnings...");
  const { data: learnings } = await supabase.from("consultant_learnings").select("*");
  console.log(learnings);

  console.log("Checking site_settings for asi_logic...");
  const { data: asiLogic } = await supabase.from("site_settings").select("*").eq("key", "asi_logic");
  console.log(asiLogic);
}

check().catch(console.error);
