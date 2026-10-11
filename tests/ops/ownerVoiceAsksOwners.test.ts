// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ownerVoice } from "@/lib/ops/owner-voice";

/**
 * The boundary has owners it was not asking.
 *
 * A dry run over the stored rows (scratch/speak-stored-rows.cts, 2026-10-11) showed what he actually
 * gets for a drafts list: «• /#kitchens — — v1» — the machine kind dropped, because the boundary only
 * knows the capability palette, while `lib/ops/draft-labels.ts` has named those very kinds for a week
 * («تنظيم المعرض»). A word he cannot read and a word the shop already knows are the same bug wearing
 * different clothes.
 *
 * The same run showed two report headers translating half a phrase at a time — «تقرير اختبار الحمل
 * (Load Test تقرير)» — which is the mixed garbage this store said it would not do. Whole phrases go in
 * the phrase table, longest reading first, so the bracket either becomes Arabic or disappears behind
 * the Arabic that already stands in front of it.
 */
const latinOutsideLinks = (s: string) =>
  (s
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\/[A-Za-z0-9\-_./]{4,}/g, "")
    .match(/[A-Za-z]{3,}/g) ?? []);

describe("the boundary asks the owners that already exist", () => {
  it("names a draft kind with the drafts desk's own vocabulary", () => {
    const out = ownerVoice("المسودات المعلقة: • curate_gallery — v1 — منذ 3 يوم");
    expect(out).toContain("تنظيم المعرض");
    expect(out).toContain("منذ ٣ يوم");
    expect(latinOutsideLinks(out)).toEqual([]);
  });

  it("names the other kinds measured in the same list", () => {
    expect(ownerVoice("— image_fix —")).toContain("تصحيح الصورة");
    expect(ownerVoice("— identity_fix —")).toContain("تصحيح الهوية");
  });

  it("still says nothing about a kind the shop has never named", () => {
    expect(ownerVoice("— teleport_moons —")).not.toContain("teleport");
  });
});

describe("a whole English phrase is read whole, not word by word", () => {
  it("does not leave half a report header behind", () => {
    const out = ownerVoice("**تقرير اختبار الحمل (Load Test Report)**");
    expect(out).toBe("**تقرير اختبار الحمل**");
  });

  it("translates the sentence a tool answers with", () => {
    const out = ownerVoice("SEO analysis completed for https://azenith-living.vercel.app/ - Score: 97/100");
    expect(out).toContain("خلص تحليل الظهور");
    expect(out).toContain("الدرجة");
    expect(latinOutsideLinks(out)).toEqual([]);
  });
});
