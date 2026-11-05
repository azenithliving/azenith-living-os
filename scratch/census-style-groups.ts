/**
 * What the style charts show today, and what they would show through the store's own taste reader.
 *   node node_modules/ts-node/dist/bin.js --transpile-only -r tsconfig-paths/register \
 *     --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scratch/census-style-groups.ts
 *
 * Read-only. The grouping in lib/analytics.ts and lib/admin-data.ts counts the taste column
 * verbatim, so a screen name counts as a style and one taste written two ways counts twice. This
 * prints both tallies using the store's real reader, so the fix is measured before it is built.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// The taste reader sits behind a module that refuses to load in a client bundle; this census is a
// plain script, so the guard is stubbed the same way the other instruments stub it.
const Mod = require("module") as any;
const serverOnly = Mod._resolveFilename("server-only", module.parent ?? require.main, false);
require.cache[serverOnly] = Object.assign(new Mod(serverOnly, null), { filename: serverOnly, loaded: true, exports: {} });

const { styleKey, storedTaste } = require("@/lib/taste-words") as typeof import("@/lib/taste-words");
const { STYLE_LABELS } = require("@/lib/constants/rooms") as typeof import("@/lib/constants/rooms");

const AR = (s: unknown) => String(s).replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

async function main() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
  );
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data, error } = await db.from("users").select("id,style,area,room_type,last_page").range(0, 999);
  if (error) throw new Error(`read failed: ${error.message}`);
  const rows = data ?? [];

  const asIs = new Map<string, number>();
  const byTaste = new Map<string, number>();
  let refused = 0;
  for (const r of rows) {
    const raw = String(r.style ?? "").trim() || "(فاضي)";
    asIs.set(raw, (asIs.get(raw) ?? 0) + 1);

    // What the writer would have kept, and what the reader can name.
    const kept = storedTaste(r.style, r.last_page);
    const key = styleKey(kept ?? "");
    if (key) byTaste.set(STYLE_LABELS[key] ?? key, (byTaste.get(STYLE_LABELS[key] ?? key) ?? 0) + 1);
    else if (kept) byTaste.set("كلامه هو (مفيش صورة تطابقه)", (byTaste.get("كلامه هو (مفيش صورة تطابقه)") ?? 0) + 1);
    else refused += 1;
  }

  console.log(`سطور مقروءة = ${AR(rows.length)} (سقف القراءة ١٠٠، فالعدد لو طلع ١٠٠٠ يبقى السقف مش الحقيقة)`);
  console.log(`أنواع كما تعدّها اللوحة النهاردة = ${AR(asIs.size)} · بعد القارئ = ${AR(byTaste.size)} · مرفوض = ${AR(refused)}`);
  console.log("\n— اللوحة النهاردة: كل قيمة كما هي —");
  for (const [value, n] of [...asIs.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${value.padEnd(26)} ${AR(n)}`);
  console.log("\n— بنفس السطور، بعد قارئ الذوق —");
  for (const [value, n] of [...byTaste.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${value.padEnd(34)} ${AR(n)}`);
  const both = rows.filter((r) => r.area && r.style).length;
  console.log(`\n   سطور عليها منطقة وطراز: ${AR(both)}`);
}

main().catch((e) => {
  console.error(String(e && e.message ? e.message : e));
  process.exitCode = 1;
});
