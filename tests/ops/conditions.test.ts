// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  CONDITIONS,
  honestConditions,
  statedConditions,
  unmeasuredConditions,
} from "@/lib/ops/conditions";
import { WORLD_DESK, type DeskRun } from "@/lib/ops/provenance";

/**
 * A condition the owner can act on needs the desk that measures it. Every sentence below is
 * copied from his own chat rows (measured 2026-10-09 over 865 agent rows), so the guard is
 * tested on the wording that actually reaches him — and the sentences that must survive are
 * copied too, because the failure mode this atom keeps hitting is labelling real work unmeasured.
 */

const NO_DESK: DeskRun[] = [];
const WORLD: DeskRun[] = [{ desk: "ops_world", ok: true }];

describe("a condition with no reading behind it is struck", () => {
  /** The row the live proof produced on 2026-10-09: nothing ran, and it said the shop was fine. */
  const LIVE_LIE =
    "صباح الفل يا كبير. فحصت ١٥ غرفة و ١ منتج وكلهم ظاهرين للعملاء. الوضع مستقر، بس \"الصوفا الملكية\" محتاجة تدخل عاجل يليق بهيبتها.";

  it("cuts the count and the stability claim, keeps the greeting", () => {
    const out = honestConditions(LIVE_LIE, NO_DESK);
    expect(out.disclosed).toBe(true);
    expect(out.removed.join(" ")).toContain("فحصت ١٥ غرفة");
    expect(out.removed.join(" ")).toContain("الوضع مستقر");
    expect(out.text).toContain("صباح الفل يا كبير");
  });

  it("says which conditions were left unmeasured, in Arabic only", () => {
    const out = honestConditions(LIVE_LIE, NO_DESK);
    const note = out.text.split("\n").slice(-1)[0];
    expect(note).toContain("مفيش مكتب قياس اتشغّل عليه");
    expect(note).not.toMatch(/[A-Za-z]/);
  });

  /** Copied from the live row 9de8da97 (2026-10-09 17:50) — the wording that first beat the guard. */
  it("catches the state word arriving after its noun phrase, and a dot inside a currency", () => {
    const live =
      "أهلاً بك يا صاحب الدار. إليك الموقف التشغيلي الراهن لـ «سرب أزينث» باختصار: **الوضع العام:** مستقر ومطمئن، مع مبيعات بلغت **700,000 ج.م** (متوسط 350,000 ج.م للطلب)، والسيادة المطلقة في العرض حالياً.";
    const out = honestConditions(live, NO_DESK);
    expect(out.disclosed).toBe(true);
    const struck = out.removed.join(" ");
    expect(struck).toContain("الوضع العام");
    expect(struck).toContain("ج.م");
    expect(out.text).toContain("أهلاً بك يا صاحب الدار");
  });

  it("catches the paraphrases the live rows actually use", () => {
    const labels = (line: string) => unmeasuredConditions(line, NO_DESK).map((c) => c.label);
    const backed = (line: string) =>
      unmeasuredConditions(line, [{ desk: "site_audit", ok: true }]).map((c) => c.label);
    for (const line of [
      "الأمر تحت السيطرة، والدار في أوج عرضها.",
      "الوضع العام: مستقر ومطمئن.",
      "حالة المحل ممتازة.",
    ]) {
      expect(labels(line), line).toContain("إن الشغل ماشي تمام أو مفيش مشاكل");
      expect(backed(line), line).not.toContain("إن الشغل ماشي تمام أو مفيش مشاكل");
    }
  });

  it("does not mistake a product's adjective for the shop's state", () => {
    expect(unmeasuredConditions("خامات ممتازة وتشطيب نظيف.", NO_DESK)).toEqual([]);
  });

  it("readies stock and opening hours have no measuring desk at all", () => {
    // The owner ordered the opposite of ready stock, and the hours live in a register no chat desk reads.
    const stock = honestConditions("عندنا مخزون جاهز للتسليم فورًا.", [WORLD[0], { desk: WORLD_DESK, ok: true }]);
    expect(stock.disclosed).toBe(true);
    expect(stock.unmeasured).toContain("إن في بضاعة جاهزة أو مخزون");

    const hours = honestConditions("إحنا بنفتح الساعة ٩ صباحًا.", [{ desk: "ops_world", ok: true }]);
    expect(hours.unmeasured).toContain("مواعيد العمل أو يوم الإجازة");
  });

  it("counts a competitor's price only when the rival desk read it", () => {
    // No currency token: a price with one would also state the money condition, and this
    // sentence is here to test the rival desk alone.
    const claim = "أرخص منافس عنده نفس الكنبة بـ ٤٥٠٠٠.";
    expect(unmeasuredConditions(claim, [{ desk: "ops_self", ok: true }]).length).toBeGreaterThan(0);
    expect(honestConditions(claim, [{ desk: "ops_rivals", ok: true }]).disclosed).toBe(false);
  });

  it("treats a desk that ran and failed as no reading at all", () => {
    const claim = "مقياس الفخامة طلع ٨٢ من ١٠٠.";
    expect(honestConditions(claim, [{ desk: "ops_luxury_score", ok: false }]).disclosed).toBe(true);
    expect(honestConditions(claim, [{ desk: "ops_luxury_score", ok: true }]).disclosed).toBe(false);
  });
});

describe("what is not a claim stays where it is", () => {
  /** The first draft cut all four of these. Each one names a topic and states no value. */
  const NOT_CLAIMS = [
    "لنرى نبض الزوار والتفاعلات الحالية.",
    "كل يوم، مراقبة شذوذ الزوار.",
    "SEO، سرعة، إيرادات، أهداف، صحة النظام والمحتوى.",
    "من بين الـ 5 عملاء، هناك 4 عملاء مستنيين رد لتحريكهم في قمع المبيعات.",
    "قل \"أنشئ مسودة للهيرو\" وسأنشئها فوراً.",
  ];

  it("survives with nothing recorded", () => {
    for (const sentence of NOT_CLAIMS) {
      expect(honestConditions(sentence, NO_DESK), sentence).toEqual({
        text: sentence,
        removed: [],
        unmeasured: [],
        disclosed: false,
      });
    }
  });

  /** 57 of his rows ARE the shop's live reading — none of them may lose a sentence. */
  it("leaves a measured world report alone", () => {
    const report = [
      "**عالم الدار الآن** — نافذة 2026-07-11 → 2026-10-09",
      "• المبيعات: 700000 ج.م من 2 طلب (متوسط 350000 ج.م) — الحالات: متأكّد 2",
      "• الكتالوج: 1 منتج · 15 قسم غرفة (15 نشط)، 1 بلا صورة رئيسية",
      "• الزوار (7 أيام): 64 حدث من 64 جلسة (كان 14 في الـ7 السابقة)",
      "• الموسم: الآن موسم المدارس · القادم: رمضان يبدأ 2027-02-08",
    ].join("\n");
    const out = honestConditions(report, WORLD);
    expect(out.disclosed).toBe(false);
    expect(out.removed).toEqual([]);
  });

  it("accepts the live reading of the shop as a measurement", () => {
    const out = honestConditions("الكتالوج فيه ١٥ غرفة و ١ منتج.", [{ desk: WORLD_DESK, ok: true }]);
    expect(out.disclosed).toBe(false);
  });

  it("names nothing when the text states no condition", () => {
    expect(statedConditions("تمام يا فندم، تحت أمرك.")).toEqual([]);
  });
});

describe("the table itself", () => {
  it("every condition has an Arabic label the owner can read", () => {
    for (const c of CONDITIONS) {
      expect(c.label).toBeTruthy();
      expect(c.label).not.toMatch(/[A-Za-z]/);
    }
  });

  it("names only desks that exist in the registry or the provenance module", () => {
    const known = new Set([
      "ops_world", "ops_forecast", "ops_luxury_score", "ops_rivals", "ops_self", "gsc_queries",
      "metrics_realtime", "product_list", "lead_list", "content_health_check", "qa_accessibility",
      "qa_security_headers", "qa_load_probe", "system_health_check", "seo_analyze", "site_audit",
      WORLD_DESK,
    ]);
    for (const c of CONDITIONS) {
      for (const id of c.measuredBy) expect(known, `${c.label} → ${id}`).toContain(id);
    }
  });

  it("keeps the two conditions nothing measures empty on purpose", () => {
    const unmeasurable = CONDITIONS.filter((c) => c.measuredBy.length === 0).map((c) => c.label);
    expect(unmeasurable).toEqual([
      "إن في بضاعة جاهزة أو مخزون",
      "مواعيد العمل أو يوم الإجازة",
    ]);
  });
});

describe("the guard is wired where the row is written", () => {
  const orchestrator = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");
  const claims = readFileSync("lib/ops/claims.ts", "utf8");

  it("the leader's turn records the live reading and judges against the desk list", () => {
    expect(orchestrator).toContain(`desk: WORLD_DESK`);
    expect(orchestrator).toContain("honestConditions(response, deskRuns)");
  });

  it("both guards strike sentences through one splitter", () => {
    expect(claims).toContain("export function stripSentences");
    expect(claims).toContain("stripSentences(source, (part) => CLAIM.test(part))");
  });
});
