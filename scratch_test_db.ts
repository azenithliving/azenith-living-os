import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function test() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("--- Probing Schema for 'orders' ---");
  const { data, error } = await supabase.from("orders").select("id").limit(1);
  if (error) console.log("Orders probe error:", error.message);
  else console.log("Orders probe success!");

  // Try to find schema via Postgres internal tables
  const { data: schemaData, error: schemaErr } = await supabase
    .from("pg_tables") // This might fail via REST, but worth a try
    .select("schemaname, tablename")
    .eq("tablename", "orders");
  
  if (schemaErr) {
    console.log("pg_tables access failed (expected via REST).");
  } else {
    console.log("Schema match:", schemaData);
  }
}

test();
