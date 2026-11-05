/**
 * Which suspect is it — the deploy, or the regex? Run the guard, as production builds it,
 * over the exact sentence the live row stored. No browser, no model, no guessing.
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ts-node/register/transpile-only -r tsconfig-paths/register scratch/order-condition-suspects.cts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { honestConditions, unmeasuredConditions } from "@/lib/ops/conditions";
import { readDesks } from "@/lib/ops/provenance";

dotenv.config({ path: ".env.local" });

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await sb
    .from("agent_messages")
    .select("id,created_at,context,content")
    .eq("sender_type", "agent")
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw new Error(error.message);

  for (const r of data ?? []) {
    const text = String(r.content ?? "");
    const desks = readDesks(r.context);
    const missing = unmeasuredConditions(text, desks);
    const out = honestConditions(text, desks);
    console.log(
      `${r.created_at} · ${r.id.slice(0, 8)} · desks=[${desks.map((d) => d.desk).join(",") || "فاضي"}] · ` +
        `conditions=${missing.length ? missing.map((m) => m.label).join("|") : "مفيش"} · ` +
        `هيتشال ${out.removed.length} جملة`
    );
    for (const s of out.removed.slice(0, 2)) console.log(`     «${s.replace(/\s+/g, " ").slice(0, 120)}»`);
  }
}

main().catch((e) => {
  console.error("failed:", e?.message ?? e);
  process.exit(1);
});
