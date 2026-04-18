import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("agent_memory")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  const formattedMemories = data
    .reverse()
    .map((memory) => {
      const role = memory.context?.role === "user" ? "User" : "Agent";
      return `${role}: ${memory.content}`;
    });

  console.log("Memory Dump:");
  console.log(formattedMemories.join("\n"));
}

test();
