// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { orderStatusLabel } from "@/lib/ops/order-status";
import { draftTargetLabel, draftTypeLabel } from "@/lib/ops/draft-labels";
import { ownerVoice } from "@/lib/ops/owner-voice";

/**
 * The data itself gets an Arabic name, so the model has nothing English to echo.
 *
 * Attributed live 2026-10-07 (scratch/census-residue.mjs): of the 40 Latin words still reaching his
 * prose, every one sat inside a message that was echoing a tool — «الحالات: confirmed 2» from the
 * world digest (the raw status column), «image_fix — curate_gallery — hero_text» from the drafts
 * desk (the raw draft_type column), and axe's rule names from the accessibility audit.
 */
describe("order statuses in his words", () => {
  it("reads the three statuses his ledger actually holds", () => {
    expect(orderStatusLabel("confirmed")).toBe("متأكّد");
    expect(orderStatusLabel("processing")).toBe("قيد التجهيز");
    expect(orderStatusLabel("completed")).toBe("مكتمل");
  });

  it("reads the rest of the shop's states too", () => {
    expect(orderStatusLabel("pending")).toBe("في انتظار التأكيد");
    expect(orderStatusLabel("cancelled")).toBe("ملغي");
    expect(orderStatusLabel("refunded")).toBe("ارجعت الفلوس");
  });

  it("never prints a state it does not know", () => {
    expect(orderStatusLabel("teleported")).toBe("حالة غير معروفة");
    expect(orderStatusLabel(null)).toBe("غير محدد");
    expect(orderStatusLabel("")).toBe("غير محدد");
  });

  it("is not fooled by casing or spaces around the stored value", () => {
    expect(orderStatusLabel("  CONFIRMED ")).toBe("متأكّد");
  });
});

describe("draft kinds in his words", () => {
  it("names the four kinds his drafts table actually holds", () => {
    expect(draftTypeLabel("image_fix")).toBe("تصحيح الصورة");
    expect(draftTypeLabel("identity_fix")).toBe("تصحيح الهوية");
    expect(draftTypeLabel("curate_gallery")).toBe("تنظيم المعرض");
    expect(draftTypeLabel("hero_text")).toBe("نص الواجهة");
  });

  it("says nothing about a kind it cannot name, instead of printing the key", () => {
    expect(draftTypeLabel("quantum_leap")).toBeNull();
    expect(draftTypeLabel(null)).toBeNull();
  });
});

describe("a draft's place, not its path", () => {
  it("names the pages his drafts actually point at", () => {
    expect(draftTargetLabel("/")).toBe("الصفحة الرئيسية");
    expect(draftTargetLabel("/#kitchens")).toBe("قسم المطابخ");
    expect(draftTargetLabel("/products/sofa-malaki-1790214163150")).toBe("صفحة منتج");
    expect(draftTargetLabel("/rooms")).toBe("صفحة الغرف");
  });

  it("calls an unknown address unnamed rather than reciting a slug", () => {
    expect(draftTargetLabel("/x9-zz/secret")).toBe("مكان من غير اسم");
    expect(draftTargetLabel(null)).toBe("مكان من غير اسم");
  });
});

describe("the audit's own vocabulary", () => {
  it("reads the accessibility findings line in Arabic", () => {
    const out = ownerVoice("من سجلات الفحص الآلي: Keyboard Navigation: Verified - Contrast Ratio: Verified (> 4.5:1 for normal)");
    expect(out).not.toMatch(/Keyboard|Navigation|Verified|Contrast|Ratio|normal/);
    expect(out).toContain("التنقل بلوحة المفاتيح");
    expect(out).toContain("نسبة التباين");
  });
});

describe("the prompts stop asking for Latin in prose", () => {
  const base = readFileSync("lib/ops/QayyimAgentBase.ts", "utf8");
  const mastermind = readFileSync("lib/mastermind-ai.ts", "utf8");

  it("every employee is told to answer in his language", () => {
    expect(base).toContain("ما تكتبش حرف أو رقم لاتيني");
  });

  it("the evidence rule asks for a link, not for a field name to be typed", () => {
    const evidence = base.slice(base.indexOf("متطلبات الأدلة"), base.indexOf("متطلبات الأدلة") + 700);
    expect(evidence).toContain("رابط الدليل");
    expect(evidence).not.toContain("evidenceUrl");
  });

  it("the command brain is told too", () => {
    expect(mastermind).toContain("ما تكتبش حرف أو رقم لاتيني");
  });
});

describe("the tools are wired to the labels", () => {
  const world = readFileSync("lib/ops/world-model.ts", "utf8");
  const bridge = readFileSync("lib/admin-tool-bridge.ts", "utf8");

  it("the world digest names an order status", () => {
    expect(world).toContain("orderStatusLabel(");
  });

  it("the drafts desk names the kind of draft and the place it lands", () => {
    expect(bridge).toContain("draftTypeLabel(");
    expect(bridge).toContain("draftTargetLabel(");
    expect(bridge).not.toContain("${r.draft_type ||");
  });
});
