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

const MARK = "قياس السجل";
const count = async () => {
  const { count: n } = await supabase.from("audit_log").select("id", { count: "exact", head: true });
  return n;
};
const mine = async () => {
  const { data, error } = await supabase.from("audit_log").select("id, action, actor, result").eq("action", MARK);
  return { rows: data ?? [], error: error ? `${error.code} ${error.message}` : null };
};

const base = {
  event_type: "probe",
  action: MARK,
  actor: "probe",
  details: { note: MARK },
  result: "success",
  timestamp: new Date().toISOString(),
};

try {
  const before = await count();
  log("rows before=" + before);

  log("== the writer's first attempt: the payload lib/ultimate-agent/security-manager.ts actually sends ==");
  const full = { ...base, company_id: null, actor_user_id: null, approval_request_id: null, command_log_id: null };
  const r1 = await supabase.from("audit_log").insert(full);
  log("FULL_INSERT ok=" + !r1.error + " code=" + (r1.error ? String(r1.error.code) : "-") + " msg=" + (r1.error ? String(r1.error.message).slice(0, 140) : "-"));

  log("== the retry it falls back to (the four names stripped) ==");
  const r2 = await supabase.from("audit_log").insert(base);
  log("LEGACY_INSERT ok=" + !r2.error + " code=" + (r2.error ? String(r2.error.code) : "-") + " msg=" + (r2.error ? String(r2.error.message).slice(0, 200) : "-"));
  const landed = await mine();
  log("READ_BACK rows=" + landed.rows.length + " readError=" + (landed.error ?? "-"));

  log("== does the read side of the desk work at all? ==");
  const read = await supabase.from("audit_log").select("*").order("timestamp", { ascending: false }).limit(3);
  log("SELECT_STAR ok=" + !read.error + " rows=" + (read.data ?? []).length + (read.error ? " code=" + String(read.error.code) + " msg=" + String(read.error.message).slice(0, 140) : ""));

  log("== cleanup: delete only the rows this instrument marked ==");
  const del = await supabase.from("audit_log").delete().eq("action", MARK);
  log("DELETE ok=" + !del.error + " code=" + (del.error ? String(del.error.code) : "-") + " msg=" + (del.error ? String(del.error.message).slice(0, 140) : "-"));
  const leftMine = await mine();
  const after = await count();
  log("rows after=" + after + " my rows left=" + leftMine.rows.length);
  if (after !== before) log("NOTE: the table count moved by " + (after - before) + " rows");
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  fs.writeFileSync("scratch/measure-audit-write.out", out.join("\n") + "\n");
}
