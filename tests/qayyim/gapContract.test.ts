// @vitest-environment node
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { explainGap, isRefusal, nameGap, type GapFacts } from "@/lib/qayyim/gap-contract";

/**
 * P6-M4 — the refusal contract.
 *
 * «مش قادر» is not an answer, it's a shrug. Every refusal this swarm emits has
 * to name the thing it is missing and the shortest way to get it, so the owner
 * learns which knob to turn instead of wondering whether the machine is broken.
 */

const facts: GapFacts = {
  tools: [
    { name: "qayyim_world", desc: "مبيعات الدار والأكثر بيعاً والكتالوج والزوار" },
    { name: "qayyim_rivals", desc: "قياس المنافسين من جدول qayyim_rivals" },
    { name: "gsc_queries", desc: "كلمات البحث الحقيقية من Google Search Console" },
    { name: "qayyim_forecast", desc: "توقع المبيعات بحساب Holt-Winters" },
    { name: "qayyim_luxury_score", desc: "حساب Luxury Score الفعلي للموقع" },
  ],
};

describe("isRefusal", () => {
  it("recognises the dialect and the formal spellings", () => {
    for (const text of [
      "مش قادر على الصفحة دي",
      "ما أقدرش أعمل كده",
      "لا أستطيع تنفيذ ذلك",
      "هذا الطلب خارج نطاق اختصاصي",
      "عذراً، الأداة غير متاحة",
      // Both spellings seen live on production: the future («won't be able») and
      // the habitual («don't know how») are different constructions in Egyptian.
      "مش هقدر أبعت SMS؛ الأدوات ناقصها وكيل إشعارات",
      "مش بقدر أعدّ المخزون من هنا",
    ]) {
      expect(isRefusal(text)).toBe(true);
    }
  });

  it("does not mistake a measured answer for a refusal", () => {
    for (const text of [
      "فحصت 15 غرفة و1 منتج",
      "Luxury Score مقاسة: 51 من 100",
      "المبيعات: 700000 ج.م من 2 طلب",
    ]) {
      expect(isRefusal(text)).toBe(false);
    }
  });

  it("is not fooled by a refusal word inside a table cell", () => {
    // «غير متاح» appears in honest empty-state reports; that is a measurement,
    // not the swarm giving up. The contract only fires on a giving-up sentence.
    expect(isRefusal("| الهدف | الحالة |\n|---|---|\n| المبيعات | غير متاح بعد |")).toBe(false);
  });
});

describe("nameGap", () => {
  it("names Search Console and how to switch it on", () => {
    const gap = nameGap("كلمات البحث اللي جابلي زيارات", facts);
    expect(gap).not.toBeNull();
    expect(gap!.capability).toContain("Search Console");
    expect(gap!.enablePath).toContain("GOOGLE_APPLICATION_CREDENTIALS_JSON");
  });

  it("names the competitor table when the market question fails", () => {
    const gap = nameGap("المنافسين بيعملوا ايه دلوقتي", facts);
    expect(gap!.enablePath).toContain("qayyim_rivals");
  });

  it("names the publishing gate as a rule, not a bug", () => {
    const gap = nameGap("انشر المسودة دي حالا", facts);
    expect(gap!.capability).toContain("موافقة");
  });

  it("names the factory as out of the site's boundary", () => {
    const gap = nameGap("شوف مخزون الخشب في المصنع", facts);
    expect(gap!.capability).toContain("المصنع");
  });

  it("names the missing thing itself instead of inventing a tool", () => {
    const gap = nameGap("عايز رسم بياني للتدفقات", facts);
    expect(gap).not.toBeNull();
    expect(gap!.capability).toContain("رسم بياني");
    expect(gap!.enablePath).toContain("أقرب أداة موجودة");
    // Whatever it points at must be a tool this swarm actually has.
    expect(gap!.nearestTool).not.toBeNull();
    expect(facts.tools.map((t) => t.name)).toContain(gap!.nearestTool);
  });
});

describe("explainGap", () => {
  it("appends nothing to an answer that worked", () => {
    expect(explainGap("فحصت 15 غرفة و1 منتج", "افحص الموقع", facts)).toBe("");
  });

  it("turns a shrug into a named missing capability", () => {
    const out = explainGap("مش قادر على الصفحة دي", "كلمات البحث الحقيقية", facts);
    expect(out).toContain("الناقص:");
    expect(out).toContain("Search Console");
    expect(out).toContain("يتفعّل بـ");
  });

  it("keeps the note short enough to sit under an answer", () => {
    const out = explainGap("مش قادر", "أي حاجة", facts);
    expect(out.length).toBeLessThan(400);
  });
});

describe("wiring", () => {
  /** The contract only protects the owner if it is actually on the reply path. */
  it("the orchestrator extends refusals before the truth layer", () => {
    const src = readFileSync(join(process.cwd(), "lib/agents/AgentOrchestrator.ts"), "utf8");
    expect(src).toContain("explainGap(");
    expect(src).toContain("TOOL_CATALOG");
  });
});
