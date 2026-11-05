/**
 * What actually sits in the taste column, read from the live store — read-only.
 *   npm run --silent census:style
 *
 * The elite brief was measured storing its own page name («elite-brief») where a customer's
 * taste goes. Before fixing the writer, count what the column really holds, split by the page
 * that wrote it, and ask of every value whether the store's own taste reader can read it back.
 */
const Module = require("module");
const serverOnly = Module._resolveFilename("server-only", module.parent ?? require.main!, false);
require.cache[serverOnly] = Object.assign(new Module(serverOnly, null as any), {
  filename: serverOnly,
  loaded: true,
  exports: {},
});

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { styleKey } from "@/lib/taste-words";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
for (const [k, v] of Object.entries(env)) process.env[k] = v;

async function main() {
  const sb = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
    { auth: { persistSession: false } },
  );

  const { data, error } = await sb
    .from("users")
    .select("id,style,area,room_type,last_page,full_name,created_at")
    .order("created_at", { ascending: false })
    .range(0, 999);

  if (error) throw new Error(`read failed: ${error.message}`);
  const rows = data ?? [];
  console.log(`rows read = ${rows.length} (PostgREST caps a read at 1000)`);

  const byStyle = new Map<string, { n: number; pages: Set<string>; key: string | null }>();
  for (const r of rows) {
    const raw = r.style == null ? "«null»" : `"${r.style}"`;
    const entry = byStyle.get(raw) ?? { n: 0, pages: new Set<string>(), key: styleKey(r.style) };
    entry.n += 1;
    entry.pages.add(String(r.last_page ?? "«بلا صفحة»"));
    byStyle.set(raw, entry);
  }

  console.log("\n— خانة الطراز، قيمتها · عدد السطور · قارئ الذوق بيقرأها ولا لأ · الصفحة اللي كتبتها —");
  const sorted = [...byStyle.entries()].sort((a, b) => b[1].n - a[1].n);
  for (const [value, info] of sorted) {
    console.log(
      `${value.padEnd(28)} عدد=${info.n}  ذوق=${info.key ?? "لأ"}  من=${[...info.pages].join(", ")}`,
    );
  }

  const readable = rows.filter((r) => styleKey(r.style)).length;
  const withArea = rows.filter((r) => r.area).length;
  const withAreaAndTaste = rows.filter((r) => r.area && styleKey(r.style)).length;
  console.log(`\nسطور عليها طراز يُقرأ = ${readable}`);
  console.log(`سطور عليها منطقة = ${withArea}`);
  console.log(`سطور عليها منطقة وطراز معًا = ${withAreaAndTaste}`);

  const elite = rows.filter((r) => String(r.last_page ?? "").includes("elite"));
  console.log(`\n— سطور نموذج النخبة (${elite.length}) —`);
  for (const r of elite.slice(0, 30)) {
    console.log(
      `${String(r.full_name ?? "«بلا اسم»").padEnd(18)} طراز=${r.style ?? "null"}  منطقة=${r.area ?? "null"}  غرفة=${r.room_type ?? "null"}  ${String(r.created_at ?? "").slice(0, 10)}`,
    );
  }

  const requestish = rows.filter((r) => !String(r.last_page ?? "").includes("elite"));
  console.log(`\n— سطور باقي الصفحات (${requestish.length}) —`);
  for (const r of requestish.slice(0, 30)) {
    console.log(
      `${String(r.full_name ?? "«بلا اسم»").padEnd(18)} طراز=${r.style ?? "null"}  منطقة=${r.area ?? "null"}  صفحة=${r.last_page ?? "null"}`,
    );
  }
}

main().catch((err) => {
  console.error(String(err && err.message ? err.message : err));
  process.exitCode = 1;
});
