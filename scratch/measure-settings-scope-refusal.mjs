/**
 * measure-settings-scope-refusal.mjs — what the root layout's scoped read actually costs.
 *
 * The layout asks `site_settings` to filter on `company_id`. This measures the answer, the same
 * request the server makes, and the unscoped read that follows it.
 */
import fs from "node:fs";
import dotenv from "dotenv";

for (const f of [".env.local", ".env"]) if (fs.existsSync(f)) dotenv.config({ path: f });

const out = [];
const say = (s) => {
  out.push(s);
  console.log(s);
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: key, Accept: "application/json" };

const cols = await (
  await fetch(`${url}/rest/v1/`, { headers: { ...headers } })
).json();
const props = Object.keys(cols.definitions?.site_settings?.properties ?? {});
say("site_settings columns in the record: " + props.length + " [" + props.join(",") + "]");
say("has company_id: " + props.includes("company_id"));

const companies = await fetch(`${url}/rest/v1/companies?select=id&order=created_at.asc&limit=1`, { headers });
const companyRows = await companies.json();
const companyId = companyRows?.[0]?.id;
say("first company id read: " + (companyId ? "yes" : "no") + " status=" + companies.status);

const scoped = await fetch(
  `${url}/rest/v1/site_settings?select=key,value&company_id=eq.${companyId}&key=in.(theme,seo)`,
  { headers }
);
const scopedBody = await scoped.text();
say(`SCOPED read → status=${scoped.status} code=${(scopedBody.match(/"code":"([^"]+)"/) ?? [])[1] ?? "-"} bytes=${scopedBody.length}`);
say("   refusal message: " + scopedBody.slice(0, 160).replace(/\s+/g, " "));

const plain = await fetch(`${url}/rest/v1/site_settings?select=key,value&key=in.(theme,seo)`, { headers });
const plainRows = await plain.json();
say(`UNSCOPED read → status=${plain.status} rows=${Array.isArray(plainRows) ? plainRows.length : "-"}`);
say("   keys returned: " + (Array.isArray(plainRows) ? plainRows.map((r) => r.key).join(",") : JSON.stringify(plainRows).slice(0, 120)));

fs.writeFileSync("scratch/measure-settings-scope-refusal.out", out.join("\n") + "\n");
