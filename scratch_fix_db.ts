import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function fixDB() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // We can just delete all memories from the last 1 day to be safe and clean the test slate
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("agent_memory")
    .delete()
    .gte("created_at", yesterday);

  if (error) {
    console.error("Error deleting:", error);
  } else {
    console.log("Deleted recent memories!");
  }
}

fixDB();
