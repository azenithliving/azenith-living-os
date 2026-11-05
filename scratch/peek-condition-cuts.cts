/**
 * What the guard would actually cut — six real rows, the removed sentences printed.
 * A guard nobody has read the output of is a rumor.
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ts-node/register/transpile-only -r tsconfig-paths/register scratch/peek-condition-cuts.cts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { honestConditions } from "@/lib/ops/conditions";
import { readDesks } from "@/lib/ops/provenance";

dotenv.config({ path: ".env.local" });

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb
    .from("agent_messages")
    .select("created_at,sender_name,context,content")
    .eq("sender_type", "agent")
    .order("created_at", { ascending: false })
    .limit(600);
  if (error) throw new Error(error.message);

  let shown = 0;
  for (const r of data ?? []) {
    const text = String(r.content ?? "");
    const desks = readDesks(r.context);
    const out = honestConditions(text, desks);
    if (!out.removed.length) continue;
    shown += 1;
    console.log(`\n=== ${r.created_at} · ${r.sender_name} · desks=[${desks.map((d) => d.desk).join(",") || "فاضي"}]`);
    console.log(`    حُذف: ${out.removed.map((s) => `«${s.replace(/\s+/g, " ").slice(0, 110)}»`).join(" | ")}`);
    console.log(`    السطر اللي اتلمّس: «${text.replace(/\s+/g, " ").slice(0, 130)}»`);
    if (shown >= 6) break;
  }
  console.log(`\nمعروض ${shown} من ٦٠٠ سطر أخير`);
}

main().catch((e) => {
  console.error("failed:", e?.message ?? e);
  process.exit(1);
});
