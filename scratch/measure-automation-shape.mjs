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

// Every name the automation door puts in its payload today, read out of its source.
const source = fs.readFileSync("app/api/admin/automation/route.ts", "utf8");
const insertBlock = source.slice(source.indexOf("const insertData"), source.indexOf("const { data, error } = await insertAutomationRule"));
const sent = [...insertBlock.matchAll(/^\s*([a-z_]+)[,:]/gm)].map((m) => m[1]).filter((n) => !["const", "typeof", "record"].includes(n));

try {
  log("names in the door's insert payload: " + sent.join(","));
  let refused = 0;
  for (const name of sent) {
    const { error } = await supabase.from("automation_rules").select(name).limit(1);
    const present = !error;
    if (!present) refused++;
    log("  " + name + " present=" + present + (error ? " code=" + String(error.code) : ""));
  }
  log("REFUSED=" + refused);

  log("== what the record's own answer costs the door: reproduce the old payload once ==");
  const probeName = "قياس-القاعدة-غير-محفوظة";
  const oldPayload = {
    name: probeName,
    trigger: "manual",
    conditions: {},
    actions: {},
    enabled: true,
    is_active: true,
    company_id: null,
    created_by: "probe",
  };
  const first = await supabase.from("automation_rules").insert(oldPayload).select().single();
  log("OLD_SHAPE_FIRST ok=" + !first.error + " code=" + (first.error ? String(first.error.code) : "-") + " msg=" + (first.error ? String(first.error.message).slice(0, 120) : "-"));

  const stripped = { ...oldPayload };
  delete stripped.is_active;
  delete stripped.created_by;
  const second = await supabase.from("automation_rules").insert(stripped).select().single();
  log("OLD_SHAPE_AFTER_STRIP ok=" + !second.error + " id=" + (second.data ? String(second.data.id).slice(0, 8) : "-"));

  if (second.data) {
    const del = await supabase.from("automation_rules").delete().eq("id", second.data.id);
    log("CLEANUP ok=" + !del.error);
  }
  const left = await supabase.from("automation_rules").select("id").eq("name", probeName);
  log("LEFTOVER_ROWS=" + (left.data ?? []).length);
  const total = await supabase.from("automation_rules").select("id", { count: "exact", head: true });
  log("TABLE_ROWS=" + total.count);
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  fs.writeFileSync("scratch/measure-automation-shape.out", out.join("\n") + "\n");
}
