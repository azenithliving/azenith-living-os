import { readFileSync } from "node:fs";
import speakeasy from "speakeasy";
import postgres from "postgres";

/**
 * Which enrolled key does the gate actually hold? Reports names and comparisons only — never a value.
 */
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);

const norm = (s) => String(s).replace(/\s+/g, "").replace(/-/g, "").toUpperCase();
const local = norm(env.ADMIN_GATE_2FA_SECRET ?? "");
const sql = postgres(env.DIRECT_URL, { ssl: "require", max: 1 });

const email = (env.ADMIN_GATE_EMAIL ?? "").trim().toLowerCase();
const users = await sql`select id, email from users where lower(email)=${email}`;
console.log(`rows in users for the admin email: ${users.length}`);

for (const u of users) {
  const rec = await sql`select is_enabled, length(secret) as secret_len, char_length(secret) as chars, created_at, updated_at, backup_codes from user_2fa where user_id=${u.id}`;
  console.log(`user found · 2FA rows: ${rec.length}`);
  for (const r of rec) {
    console.log(`  enabled=${r.is_enabled} secret length=${r.secret_len} chars=${r.chars} updated=${r.updated_at ?? "n/a"} backup codes=${(r.backup_codes ?? []).length}`);
  }
  const full = await sql`select secret from user_2fa where user_id=${u.id}`;
  for (const f of full) {
    const db = norm(f.secret ?? "");
    console.log(`  same key as my local file? ${db === local}`);
    console.log(`  current code from the stored key validates against the stored key? ${speakeasy.totp.verify({ secret: db, encoding: "base32", token: speakeasy.totp({ secret: db, encoding: "base32" }), window: 1 })}`);
    console.log(`  current code from my local file validates against the stored key? ${speakeasy.totp.verify({ secret: db, encoding: "base32", token: speakeasy.totp({ secret: local, encoding: "base32" }), window: 1 })}`);
  }
}

const countAll = await sql`select count(*)::int as n from user_2fa`;
console.log(`user_2fa rows in total: ${countAll[0].n}`);
console.log(`local key length: ${local.length} chars`);
await sql.end();
