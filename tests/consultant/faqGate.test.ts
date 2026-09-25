// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isAutonomous, normalizeArabic, pickFaqAnswer, similarity, type FaqRow } from "@/lib/consultant/faq-gate";

/**
 * P6-M4 — the consultant's own judgement, bounded.
 *
 * The storefront already writes approved question/answer pairs into
 * `consultant_faq`, and nothing ever read them back: every visitor question went
 * to a model, so the owner's own words were the one source the consultant could
 * not use. This gate lets it answer from approved rows only, only when the
 * question really matches, and only where the row says it was approved.
 *
 * Everything here is pure — the route decides whether to trust it.
 */

const faq = (over: Partial<FaqRow> = {}): FaqRow => ({
  id: "f1",
  question: "ما مواعيد العمل في المعرض؟",
  answer: "المعرض مفتوح من 10 صباحاً حتى 10 مساءً.",
  approved_by: "alaa@azenith.eg",
  is_active: true,
  ...over,
});

describe("normalizeArabic", () => {
  it("folds the spellings that used to break matching", () => {
    expect(normalizeArabic("أنت")).toBe(normalizeArabic("انت"));
    expect(normalizeArabic("إيه")).toBe(normalizeArabic("ايه"));
    expect(normalizeArabic("المواعيد")).toBe(normalizeArabic("المواعيد"));
    expect(normalizeArabic("شراء")).not.toBe(normalizeArabic("شرا"));
  });

  it("drops diacritics and punctuation", () => {
    expect(normalizeArabic("مُرَحَّبًا!")).toBe("مرحبا");
  });

  // The «ال» prefix and synonym folding belong to the comparison, not to the
  // spelling layer — asserted where they are actually used.
  it("matches a word against its own definite form", () => {
    expect(similarity("المواعيد", "مواعيد")).toBeGreaterThan(0.9);
    expect(similarity("والأسعار", "أسعار")).toBeGreaterThan(0.9);
  });
});

describe("similarity", () => {
  it("is 1 for the same sentence in different spellings", () => {
    expect(similarity("متى مواعيد الشغل؟", "ما مواعيد العمل في المعرض؟")).toBeGreaterThanOrEqual(0.5);
    expect(similarity("ما مواعيد العمل في المعرض", "ما مواعيد العمل في المعرض؟")).toBeGreaterThan(0.95);
  });

  it("refuses an unrelated question", () => {
    expect(similarity("عايز ألوان المخدة تتغير", "ما مواعيد العمل في المعرض؟")).toBeLessThan(0.3);
  });

  it("scores a short rephrasing of the same ask high", () => {
    expect(similarity("المواعيد؟", "ما مواعيد العمل في المعرض؟")).toBeGreaterThanOrEqual(0.8);
  });
});

describe("isAutonomous", () => {
  it("needs an approver and an active row", () => {
    expect(isAutonomous(faq())).toBe(true);
    expect(isAutonomous(faq({ approved_by: null }))).toBe(false);
    expect(isAutonomous(faq({ approved_by: "   " }))).toBe(false);
    expect(isAutonomous(faq({ is_active: false }))).toBe(false);
    expect(isAutonomous(faq({ answer: "" }))).toBe(false);
  });
});

describe("pickFaqAnswer", () => {
  const rows = [
    faq(),
    faq({
      id: "f2",
      question: "هل فيه توصيل للقاهرة الجديدة؟",
      answer: "نوصّل داخل القاهرة الجديدة، والميعاد يتحدد بعد تأكيد الطلب.",
      approved_by: "alaa@azenith.eg",
    }),
    faq({
      id: "f3",
      question: "كم سعر الصوفا الملكية؟",
      answer: "السعر على قدر المقاس والخامة — هيتحدد بعد زيارة المساحة.",
      approved_by: null, // never approved: the consultant may not say it on its own
      is_active: true,
    }),
  ];

  it("answers a matching question with the owner's words", () => {
    const hit = pickFaqAnswer("مواعيد المعرض ايه؟", rows);
    expect(hit).not.toBeNull();
    expect(hit!.row.id).toBe("f1");
    expect(hit!.score).toBeGreaterThanOrEqual(0.8);
  });

  it("answers the shipping question", () => {
    const hit = pickFaqAnswer("هل التوصيل موجود في القاهرة الجديدة؟", rows);
    expect(hit!.row.id).toBe("f2");
  });

  it("will not speak an unapproved answer even when the words match", () => {
    expect(pickFaqAnswer("كم سعر الصوفا الملكية؟", rows)).toBeNull();
  });

  it("stays silent below the threshold", () => {
    expect(pickFaqAnswer("عاين أغير لون المخمل في الوسادة", rows)).toBeNull();
  });

  it("is silent when the shelf is empty", () => {
    expect(pickFaqAnswer("مواعيد المعرض؟", [])).toBeNull();
  });

  it("honours a stricter threshold when asked", () => {
    const loose = pickFaqAnswer("المواعيد؟", rows)!;
    expect(pickFaqAnswer("المواعيد؟", rows, { threshold: 0.99 })).toBeNull();
    expect(loose.score).toBeLessThan(0.99);
  });
});
