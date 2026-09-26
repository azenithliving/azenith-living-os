/**
 * ops-2fa-diag.mjs — ask the database what the gate can see about the key.
 *
 * Production refuses a TOTP that verifies locally. Either the enrolled secret
 * never reaches the check, or the account the check runs for is not the account
 * the row belongs to. This script answers that without printing a secret:
 * every judgement comes out as a boolean or a mismatch count.
 *
 * Read-only. Credentials are read from an env file, never from argv.
 *
 * Usage: node scripts/ops-2fa-diag.mjs [envFile]
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import speakeasy from "speakeasy";

const envFile = process.argv[2] || ".env.local";
const env = {};
for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = (env.ADMIN_GATE_EMAIL || "").trim().toLowerCase();
const envSecret = (env.ADMIN_GATE_2FA_SECRET || "").trim().toUpperCase();

if (!url || !serviceKey || !email) {
  console.error(`${envFile} is missing the Supabase or gate variables`);
  process.exit(2);
}

console.log(`project: ${new URL(url).hostname}`);
console.log(`service role key present: ${Boolean(serviceKey)}`);
console.log(`gate env secret present: ${Boolean(envSecret)}`);

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const norm = (s) => String(s || "").replace(/\s+/g, "").replace(/-/g, "").toUpperCase();

const { data: users, error: usersError } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) {
  console.error(`listUsers failed: ${usersError.message}`);
  process.exit(1);
}
const gateUsers = users.users.filter((u) => (u.email || "").toLowerCase() === email);
console.log(`\nauth accounts for the gate email: ${gateUsers.length}`);
for (const u of gateUsers) {
  console.log(`  id ${u.id.slice(0, 8)}…  confirmed_at ${u.confirmed_at ? "yes" : "no"}`);
}

const { data: rows, error: rowsError } = await sb
  .from("user_2fa")
  .select("user_id, is_enabled, secret, backup_codes");
if (rowsError) {
  console.error(`\nuser_2fa read failed: ${rowsError.code} ${rowsError.message}`);
  process.exit(1);
}
console.log(`\nuser_2fa rows: ${rows.length}`);

const gateIds = new Set(gateUsers.map((u) => u.id));
for (const r of rows) {
  const secret = norm(r.secret);
  const live = speakeasy.totp({ secret, encoding: "base32", step: 30, digits: 6 });
  console.log(
    `  user_id ${r.user_id.slice(0, 8)}…  belongs to a gate account: ${gateIds.has(r.user_id)}` +
      `  enabled: ${r.is_enabled}  backup codes: ${(r.backup_codes || []).length}` +
      `  equals env secret: ${secret === envSecret}` +
      `  a code generated now verifies: ${speakeasy.totp.verify({ secret, encoding: "base32", token: live, step: 30, digits: 6, window: 1 })}`,
  );
}

const idsWithRows = new Set(rows.map((r) => r.user_id));
for (const u of gateUsers) {
  if (!idsWithRows.has(u.id)) {
    console.log(`\nmismatch: gate account ${u.id.slice(0, 8)}… has NO user_2fa row`);
  }
}

if (envSecret) {
  const live = speakeasy.totp({ secret: envSecret, encoding: "base32", step: 30, digits: 6 });
  console.log(
    `\nenv secret verifies its own code: ${speakeasy.totp.verify({ secret: envSecret, encoding: "base32", token: live, step: 30, digits: 6, window: 1 })}`,
  );
  console.log(`env secret equals a stored secret: ${rows.some((r) => norm(r.secret) === envSecret)}`);
}

const columns = await sb.from("user_2fa").select("email").limit(1);
console.log(
  `\nuser_2fa.email column: ${columns.error ? `absent (${columns.error.code})` : "present"}`,
);
