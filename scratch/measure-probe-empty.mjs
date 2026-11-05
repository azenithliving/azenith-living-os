import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}
const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

try {
  log("== control: an EMPTY table with columns that really exist ==");
  const count = await supabase.from("chat_history").select("id", { count: "exact", head: true });
  log("chat_history rows=" + String(count.count));
  for (const column of ["role", "content", "metadata"]) {
    const { data, error } = await supabase.from("chat_history").select(column).limit(1);
    log(
      "  probe " + column + " present=" + !error + " rows=" + (Array.isArray(data) ? data.length : -1) +
        (error ? " code=" + String(error.code) + " msg=" + String(error.message).slice(0, 90) : "")
    );
  }
  const { error: fakeErr } = await supabase.from("chat_history").select("no_such_probe_column").limit(1);
  log("  probe fake column present=" + !fakeErr + " code=" + (fakeErr ? String(fakeErr.code) : "-"));

  log("== control: a batch projection over an empty table, all real columns ==");
  const batch = await supabase.from("chat_history").select("user_id, role, content, metadata").limit(1);
  log("  batch ok=" + !batch.error + " rows=" + (Array.isArray(batch.data) ? batch.data.length : -1));

  log("== control: an empty table missing one of the batched columns ==");
  const mixed = await supabase.from("chat_history").select("role, no_such_probe_column").limit(1);
  log("  mixed ok=" + !mixed.error + " code=" + (mixed.error ? String(mixed.error.code) : "-") + " msg=" + (mixed.error ? String(mixed.error.message).slice(0, 120) : "-"));
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  fs.writeFileSync("scratch/measure-probe-empty.out", out.join("\n") + "\n");
}
