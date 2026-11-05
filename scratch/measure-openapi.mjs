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

try {
  for (const accept of ["application/openapi", "application/json", "application/openapi+json"]) {
    const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Accept: accept } });
    const text = await r.text();
    log("== Accept: " + accept + " → status=" + r.status + " bytes=" + text.length);
    log("   body: " + text.slice(0, 220).replace(/\s+/g, " "));
    if (r.status !== 200) continue;
    let spec = null;
    try {
      spec = JSON.parse(text);
    } catch {}
    if (!spec) continue;
    const paths = Object.keys(spec.paths || spec || {});
    log("   PATHS=" + paths.length + " · has audit_log: " + paths.includes("/audit_log") + " · has users: " + paths.includes("/users"));
    const defs = spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0;
    log("   SCHEMA DEFINITIONS=" + defs);
    const mem = spec.components?.schemas?.["agent_memory"];
    if (mem) log("   agent_memory columns=" + Object.keys(mem.properties || {}).length);
    const audit = spec.components?.schemas?.["audit_log"];
    if (audit) log("   audit_log columns=" + Object.keys(audit.properties || {}).length);
  }
} catch (e) {
  log("ERROR: " + String(e && e.message ? e.message : e));
} finally {
  fs.writeFileSync("scratch/measure-openapi.out", out.join("\n") + "\n");
}
