/**
 * measure-settings-readers.mjs — who reads each key the settings table holds, counted from the code.
 *
 * The registry in `lib/settings/facts.ts` is a census, and a census goes stale: it was written when
 * the table held seventeen keys. This walks the repository and the live table and prints the split,
 * so the numbers in the desk come from a run and not from memory.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const rows = await (
  await fetch(`${url}/rest/v1/site_settings?select=key&limit=200`, { headers: { apikey: key } })
).json();
const tableKeys = rows.map((r) => r.key).sort();
say("keys in the table: " + tableKeys.length);

const DIRS = ["lib", "app", "components", "scripts"];
const files = [];
for (const dir of DIRS) {
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
}
say("code files walked: " + files.length);

const ADMIN = /^(app|components)\/admin\//;
const SELF = "lib/settings/facts.ts";

let live = 0;
let oldHouseOnly = 0;
let none = 0;
for (const k of tableKeys) {
  const needle = `"${k}"`;
  const readers = [];
  const adminUsers = [];
  for (const file of files) {
    const norm = file.split(path.sep).join("/");
    if (norm === SELF) continue;
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes(needle)) continue;
    if (ADMIN.test(norm)) adminUsers.push(norm);
    else readers.push(norm);
  }
  if (readers.length > 0) {
    live++;
    say(`LIVE  ${k} → ${readers.slice(0, 3).join(", ")}`);
  } else if (adminUsers.length > 0) {
    oldHouseOnly++;
    say(`OLD   ${k} → only admin screens: ${adminUsers.slice(0, 3).join(", ")}`);
  } else {
    none++;
    say(`NONE  ${k} → no code mentions it`);
  }
}
say(`SPLIT live=${live} admin-only=${oldHouseOnly} no-code=${none} total=${tableKeys.length}`);

fs.writeFileSync("scratch/measure-settings-readers.out", out.join("\n") + "\n");
