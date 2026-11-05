/**
 * Blast radius of the condition guard, measured on his real rows before any of it ships.
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ts-node/register/transpile-only -r tsconfig-paths/register scratch/census-condition-guard.cts
 *
 * Two readings of the same corpus:
 *   (أ) desks exactly as the rows record them today
 *   (ب) the same rows, plus the live reading of the shop recorded for the rows that ARE that
 *       reading — which is what the wiring will do. A guard that gets much worse under (ب)
 *       is a guard about to strike true numbers, and does not ship.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { honestConditions, unmeasuredConditions } from "@/lib/ops/conditions";
import { WORLD_DESK, readDesks, type DeskRun } from "@/lib/ops/provenance";

dotenv.config({ path: ".env.local" });

const WORLD_TITLE = "عالم الدار الآن";

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const PAGE = 500;
  const rows: { content: string; context: unknown; created_at: string }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("agent_messages")
      .select("content,context,created_at")
      .eq("sender_type", "agent")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }

  const tally = (withWorld: boolean) => {
    let touched = 0;
    let sentences = 0;
    let chars = 0;
    const byCondition = new Map<string, number>();
    for (const r of rows) {
      const text = String(r.content ?? "");
      const desks: DeskRun[] = readDesks(r.context);
      const desksNow = withWorld && text.includes(WORLD_TITLE) ? [...desks, { desk: WORLD_DESK, ok: true }] : desks;
      const missing = unmeasuredConditions(text, desksNow);
      if (!missing.length) continue;
      const out = honestConditions(text, desksNow);
      touched += 1;
      sentences += out.removed.length;
      chars += out.text.length - text.length;
      for (const m of missing) byCondition.set(m.label, (byCondition.get(m.label) ?? 0) + 1);
    }
    return { touched, sentences, chars, byCondition };
  };

  for (const [name, withWorld] of [["أ) كما هو مسجّل دلوقتي", false], ["ب) وقراءة العالم مسجّلة", true]] as const) {
    const t = tally(withWorld);
    console.log(`\n${name}: ${t.touched} سطر من ${rows.length} هيتلمّس · ${t.sentences} جملة هتتشال · صافي تغيير الحروف ${t.chars}`);
    for (const [label, n] of [...t.byCondition.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`   ${String(n).padStart(3)} × ${label}`);
    }
  }

  // Negative control: the rows that ARE a measured answer must survive untouched.
  const worldRows = rows.filter((r) => String(r.content ?? "").includes(WORLD_TITLE));
  let struck = 0;
  for (const r of worldRows) {
    const desks: DeskRun[] = [...readDesks(r.context), { desk: WORLD_DESK, ok: true }];
    if (honestConditions(String(r.content), desks).removed.length) struck += 1;
  }
  console.log(`\nسطور «عالم الدار» = ${worldRows.length} · اللي هيتشال منها كلام = ${struck} (المطلوب صفر)`);
}

main().catch((e) => {
  console.error("census failed:", e?.message ?? e);
  process.exit(1);
});
