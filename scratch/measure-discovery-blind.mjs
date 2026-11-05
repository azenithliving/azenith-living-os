import fs from "node:fs";
import dotenv from "dotenv";

for (const f of [".env.local", ".env"]) {
  const p = process.cwd() + "/" + f;
  if (fs.existsSync(p)) dotenv.config({ path: p });
}
const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Accept: "application/json" } });
const spec = await r.json();
const defs = spec.definitions || {};
log("INVENTORY definitions=" + Object.keys(defs).length);

for (const t of ["site_settings", "automation_rules"]) {
  const d = defs[t];
  log("== " + t + " in inventory: " + (d ? "YES" : "NO"));
  if (d) {
    const cols = Object.keys(d.properties || {});
    log("   columns(" + cols.length + "): " + cols.join(", "));
    log("   required: " + JSON.stringify(d.required || []));
  }
}

// What each table actually holds, read through the same door the app uses.
for (const t of ["site_settings", "automation_rules"]) {
  if (!defs[t]) continue;
  const cols = Object.keys(defs[t].properties || {});
  const res = await fetch(`${url}/rest/v1/${t}?select=${encodeURIComponent(cols.join(","))}&limit=3`, {
    headers: { apikey: key, Accept: "application/json", Prefer: "count=exact" },
  });
  const rows = await res.json();
  // Redacted: settings rows can hold credentials, so only the shape is printed, never a value.
  const shape = (Array.isArray(rows) ? rows : []).map((row) => {
    const entries = Object.entries(row).map(([k, v]) => {
      const isSecret = /key|token|secret|password/i.test(k) || /key|token|secret|password/i.test(String(row.name ?? ""));
      const type = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
      return k + "=" + (isSecret ? `<${type}>` : type);
    });
    return entries.join(" ");
  });
  log("== read " + t + " → status=" + res.status + " range=" + res.headers.get("content-range"));
  log("   rows(redacted): " + JSON.stringify(shape).slice(0, 400));
}

// The exact pre-check the engine does today, measured for blindness.
const pre = await fetch(
  `${url}/rest/v1/information_schema.tables?select=table_name&table_schema=eq.public&table_name=eq.site_settings&limit=1`,
  { headers: { apikey: key, Accept: "application/json" } }
);
const preBody = await pre.text();
log("== old existence probe → status=" + pre.status + " body=" + preBody.slice(0, 220));

fs.writeFileSync("scratch/measure-discovery-blind.out", out.join("\n") + "\n");
