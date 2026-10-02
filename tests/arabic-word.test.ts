import { describe, expect, it } from "vitest";
import { arabicAny, arabicWord, foldArabic } from "@/lib/arabic";

/** The way the nets build their patterns: folded words, matched against folded messages. */
const word = (arabic: string) => new RegExp(arabicWord(foldArabic(arabic)), "i");
const hit = (arabic: string, text: string) => word(arabic).test(foldArabic(text));

describe("why Arabic needs its own word boundary", () => {
  it("shows that \\b never matches an Arabic word, so a guard written with it guards nothing", () => {
    expect(/\bأكل\b/.test("أكل")).toBe(false);
    expect(/\bسعر\b/.test("السعر كام")).toBe(false);
  });

  it("shows that no boundary at all matches inside a longer word", () => {
    expect(/أكل/.test("من أول ما أكلمكم لحد ما الأثاث يوصل")).toBe(true);
    expect(/كام/.test("كاميرا المراقبة في المعرض")).toBe(true);
  });
});

describe("arabicWord", () => {
  it("matches the word standing on its own", () => {
    expect(hit("اكل", "عايز آكل حاجة قريبة")).toBe(true);
    expect(hit("وحش", "الرد وحش")).toBe(true);
  });

  it("refuses the same letters inside a longer word", () => {
    // The live sentence: a customer asking how the work is done, read as a food order.
    expect(hit("اكل", "من أول ما أكلمكم لحد ما الأثاث يوصل")).toBe(false);
    expect(hit("كام", "كاميرا المراقبة في المعرض")).toBe(false);
  });

  it("still matches through the letters Arabic glues to the front of a word", () => {
    expect(hit("سعر", "السعر كام")).toBe(true);
    expect(hit("كام", "بكام الركنة")).toBe(true);
    expect(hit("مطعم", "والمطعم اللي جنبكم")).toBe(true);
  });

  it("still matches through the endings Arabic glues to the back of a word", () => {
    expect(hit("سعر", "سعرها غالي")).toBe(true);
    expect(hit("تكلفة", "التكلفة كام")).toBe(true);
    expect(hit("موقعي", "موقعي ظاهر عندك")).toBe(true);
  });

  it("reads a dictated word with its vowel marks", () => {
    expect(hit("لست", "لستُ بشراً")).toBe(true);
  });

  it("keeps the shape when the customer types the other hamza or the other ta", () => {
    expect(hit("أسعار", "الاسعار عندكم")).toBe(true);
    expect(hit("الخدمة", "الخدمه وحشه")).toBe(true);
  });
});

describe("arabicAny", () => {
  it("joins words without letting one swallow the next", () => {
    const any = arabicAny("مطعم", "مطاعم");
    expect(any.test(foldArabic("أقرب مطعم مني"))).toBe(true);
    expect(any.test(foldArabic("مطاعم القاهرة"))).toBe(true);
    expect(any.test(foldArabic("مطاعمي المفضلة"))).toBe(true);
  });

  it("refuses the same letters buried in an unrelated word", () => {
    const any = arabicAny("عشا", "عشاء");
    expect(any.test(foldArabic("معاشات الموظفين"))).toBe(false);
    expect(any.test(foldArabic("عايز عشاء"))).toBe(true);
  });
});
