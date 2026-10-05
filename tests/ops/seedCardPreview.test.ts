// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { previewLine } from "@/lib/ops/command-canvas";

/**
 * The one line under the manager's name on the seed card.
 *
 * It used to flatten whatever the agent said — including markdown tables — which
 * is how a phone screen ended up showing «فحصت 0 غرفة و1 منتج. | المشكلة | الرابط
 * | ماذا أفعل؟ | | —»: a months-old message, in table pipes, presented as news.
 */

describe("previewLine", () => {
  it("drops table rows instead of flattening them", () => {
    const out = previewLine(
      "فحصت 15 غرفة ومنتج واحد.\n\n| المشكلة | الرابط | ماذا أفعل؟ |\n| --- | --- | --- |\n| منتج بلا صورة | /x | أضف صورة |",
    );
    expect(out).toBe("فحصت ١٥ غرفة ومنتج واحد.");
  });

  it("returns nothing when the reply was only a table", () => {
    expect(previewLine("| أ | ب |\n| --- | --- |\n| 1 | 2 |")).toBe("");
  });

  it("strips markdown decoration and caps the length", () => {
    const out = previewLine(`**${"كلمة ".repeat(60)}**`);
    expect(out).not.toContain("*");
    expect(out.length).toBeLessThanOrEqual(130);
    expect(out.endsWith("…")).toBe(true);
  });

  it("keeps a short plain sentence intact", () => {
    expect(previewLine("مفيش شذوذ في حركة الزوار")).toBe("مفيش شذوذ في حركة الزوار");
  });

  /**
   * Measured on the live store: the newest agent line in 10 of 10 conversations carried Latin
   * letters, so every card under his employees' names was unreadable to him. The reports open
   * with the model's own English headings («SEO Audit Results», «Hero Image Wide Shot») and put
   * the Arabic sentence further down.
   */
  it("takes the first Arabic sentence when the reply opens with English headings", () => {
    const out = previewLine("SEO Audit Results\nHero Image Wide Shot Countertop\nالمشكلة إن 3 منتجات بلا صور.");
    expect(out).toBe("المشكلة إن ٣ منتجات بلا صور.");
  });

  it("returns nothing when the reply carries no Arabic at all", () => {
    expect(previewLine("WARNING: no rows returned for metrics_realtime")).toBe("");
  });

  it("keeps a machine name out of the sentence", () => {
    const out = previewLine("شغّلت system_health_check ولقيت مفيش خطر");
    expect(out).toBe("شغّلت ولقيت مفيش خطر");
  });

  it("keeps an address out of the sentence", () => {
    const out = previewLine("التقرير الكامل على https://azenith-living.vercel.app/admin/ops النهاردة");
    expect(out).toBe("التقرير الكامل على النهاردة");
  });

  it("never leaves a Latin letter or a Latin digit on the card", () => {
    const out = previewLine(
      "Quality Assurance Learnings\nتم فحص 42 عميل (metrics_realtime) والناس مستنية.",
    );
    expect(out.match(/[A-Za-z0-9]/g) ?? []).toEqual([]);
    expect(out).toBe("تم فحص ٤٢ عميل والناس مستنية.");
  });

  /**
   * The stored leader line measured on the published site is longer than the card, and the cut
   * landed inside «(٢٩ أداة + ١٦ أمر)» — so the card ended on an opened bracket and a plus sign.
   * A sentence that stops mid-clause is the truncation's fault, and the card can stop earlier.
   */
  it("does not end the line inside brackets or on a dangling operator", () => {
    const long = `الخطة: هرد عليك في المحادثة من غير ما أعمل حاجة في المتجر. طلبك: أقدر أنفّذ لك (${Array.from({ length: 29 }, (_, i) => `أداة${i}`).join(" ")} + 16 أمر) ونخلصها.`;
    const out = previewLine(long);
    expect(out).not.toMatch(/[A-Za-z0-9]/);
    expect(out.match(/\(/g)?.length ?? 0).toBe(out.match(/\)/g)?.length ?? 0);
    expect(out).not.toMatch(/[+\-،:؛(]\s*…$/);
  });
});
