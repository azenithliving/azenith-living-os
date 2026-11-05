/**
 * Census of business conditions his employees state, crossed with the desk record the row
 * actually carries — read through the production reader (`readDesks`), not a copy, so the
 * numbers describe what the guard will see.
 *   TS_NODE_COMPILER_OPTIONS='{"module":"commonjs","moduleResolution":"node"}' \
 *   node -r ts-node/register/transpile-only -r tsconfig-paths/register scratch/census-conditions-live.cts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { readDesks } from "@/lib/ops/provenance";

dotenv.config({ path: ".env.local" });

/** Conditions the owner can act on — each is a fact about the shop, not a sentence about work. */
const CONDITIONS: Array<[string, RegExp]> = [
  ["the shop is stable / problem-free", /(الوضع مستقر|كله تمام|كل حاجة تمام|لا توجد مشاكل|مفيش مشاكل|لا مشاكل|بحالة جيدة|جيدة جدًا)/],
  ["a customer can see it (published)", /(ظاهر(?:ين)? للعملاء|متاح(?:ة)? للجمهور|منشور فعلًا|يظهر للعملاء|كلهم ظاهرين)/],
  ["stock / ready goods", /(مخزون|متوفر(?:ة)? فورًا|جاهز(?:ة)? للتسليم|موجود(?:ة)? في المخزن)/],
  ["opening hours", /(مواعيد|٩\s*ص|٨\s*م|9\s*am|8\s*pm|موعد)/],
  ["a money figure", /(ج\.م|ريال|EGP|متوسط الطلب)/],
  ["a count of rooms or products", /(غرفة|غرف|منتج|منتجات|قسم|أقسام)/],
  ["a season or a date window", /(موسم|رمضان|صيف|الأسبوع الجاي|الشهر الجاي)/],
  ["a quality or luxury score", /(مقياس الفخامة|درجة الجودة|Luxury Score|تقييم)/],
  ["a competitor fact", /(المنافس|المنافسين|سعرهم)/],
  ["traffic / visitors", /(زائر|زوار|جلسة|جلسات|مشاهدة)/],
];

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

  const tally = CONDITIONS.map(([name, re]) => ({
    name,
    re,
    asserted: 0,
    withDesk: 0,
    noDesk: 0,
    desks: new Map<string, number>(),
  }));

  for (const r of rows) {
    const text = String(r.content ?? "");
    const desks = readDesks(r.context);
    for (const t of tally) {
      if (!t.re.test(text)) continue;
      t.asserted += 1;
      if (desks.length) {
        t.withDesk += 1;
        for (const d of desks) t.desks.set(d.desk, (t.desks.get(d.desk) ?? 0) + 1);
      } else {
        t.noDesk += 1;
      }
    }
  }

  const recorded = rows.filter((r) => (r.context as any)?.via).length;
  console.log(`agent rows: ${rows.length} · carrying a provenance envelope: ${recorded}`);
  console.log("");
  for (const t of tally.sort((a, b) => b.asserted - a.asserted)) {
    const top = [...t.desks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([d, n]) => `${d}=${n}`)
      .join(", ");
    console.log(
      `${t.name.padEnd(33)} asserted ${String(t.asserted).padStart(3)} · desk recorded ${String(
        t.withDesk
      ).padStart(3)} · none ${String(t.noDesk).padStart(3)}${top ? ` · top desks: ${top}` : ""}`
    );
  }
}

main().catch((e) => {
  console.error("census failed:", e?.message ?? e);
  process.exit(1);
});
