// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { roomNameAr } from "@/lib/rooms-catalog";
import { ALL_FURNITURE_SCOPES, TIMELINE_OPTIONS } from "@/lib/constants/furniture-data";
import { formatNextOpeningAr, type OfficeStatus } from "@/lib/office-hours";

/**
 * The qualification form's Arabic layer, measured without a browser.
 *
 * The form took a `language` prop and never read it, so every scope chip, budget line and button
 * reached an Arabic customer in English. The labels now come from one room-naming module and from
 * `labelAr` on the store's own timeline options — these tests fail the day either grows a member
 * without its Arabic half, which is how the defect was born in the first place.
 */
describe("the elite form's Arabic layer", () => {
  it("names every scope the form offers", () => {
    expect(ALL_FURNITURE_SCOPES.length).toBeGreaterThan(5);
    const nameless = ALL_FURNITURE_SCOPES.filter((scope) => !roomNameAr(scope));
    expect(nameless, `بلا اسم عربي: ${nameless.join(", ")}`).toEqual([]);
  });

  it("keeps the Arabic name free of Latin letters, and the unknown one silent", () => {
    expect(roomNameAr("Living Room")).toMatch(/[\u0600-\u06FF]/);
    expect(roomNameAr("Living Room")).not.toMatch(/[A-Za-z]/);
    expect(roomNameAr("Nothing We Have Ever Sold")).toBe("");
    expect(roomNameAr(null)).toBe("");
  });

  it("carries an Arabic answer for every timeline the form offers", () => {
    expect(TIMELINE_OPTIONS.length).toBeGreaterThan(2);
    const nameless = TIMELINE_OPTIONS.filter((option) => !option.labelAr).map((o) => o.value);
    expect(nameless, `بلا تسمية عربية: ${nameless.join(", ")}`).toEqual([]);
    for (const option of TIMELINE_OPTIONS) expect(option.labelAr).not.toMatch(/[A-Za-z]/);
  });

  it("tells the next opening in his words and his digits", () => {
    const status = {
      isOpen: false,
      status: "closed",
      message: "",
      nextOpenDate: new Date(2026, 9, 12, 10, 0, 0),
      timeUntilOpen: 0,
    } satisfies OfficeStatus;
    const line = formatNextOpeningAr(status);
    expect(line).toContain("الساعة");
    expect(line).toMatch(/[\u0660-\u0669]/);
    expect(line).not.toMatch(/[A-Za-z]/);
  });
});

/**
 * The screens that mount the form.
 *
 * Measured 2026-10-09 on the published store: the brief screen never passed a language, so its
 * Arabic customer read an English page — and the page's own headings, success card and buttons were
 * English literals with no Arabic half at all. The form's floor was English too, so any future
 * screen that forgets the prop repeats the mistake instead of failing toward his language.
 */
describe("the elite screens obey the store's language", () => {
  const brief = readFileSync("app/elite-brief/page.tsx", "utf8");

  it("takes the language from the store and hands it to the form", () => {
    expect(brief).toContain("useSessionStore((state) => state.language)");
    expect(brief).toContain("language={language}");
  });

  it("keeps the page's English words inside its English half", () => {
    const beforeEn = brief.slice(0, brief.indexOf("  en: {"));
    for (const english of ["Design Your Vision", "Brief Submitted Successfully", "Back to Home", "Explore More Designs"]) {
      expect(beforeEn, `«${english}» بره النص الإنجليزي`).not.toContain(english);
    }
    expect(brief).toContain("صمم رؤيتك");
    expect(brief).toContain("تم استلام طلبك بنجاح");
  });

  it("counts the pictures he saw in his digits, not Latin ones", () => {
    expect(brief).toContain("arabicNumerals(count)");
  });

  it("opens in Arabic when a screen forgets to say otherwise", () => {
    const form = readFileSync("components/elite/EliteIntelligenceForm.tsx", "utf8");
    expect(form).toContain('language = "ar"');
    expect(form).not.toContain('language = "en"');
  });
});
