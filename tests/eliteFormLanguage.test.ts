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
    expect(brief).toContain("useSiteLanguage()");
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

/**
 * One owner for the language fact.
 *
 * Measured 2026-10-09: the elite flow copied the store's setting into its own state at mount, so
 * the header switcher changed the site and that page stayed behind; a browser guess could flip the
 * page without telling anyone; and `?lang=` moved only that one screen while every other page kept
 * the old value. The store is the owner now, and the address speaks to the store.
 */
describe("the language has one owner", () => {
  const hook = readFileSync("hooks/useSiteLanguage.ts", "utf8");
  const brief = readFileSync("app/elite-brief/page.tsx", "utf8");
  const flow = readFileSync("app/elite-intelligence/page.tsx", "utf8");

  it("both elite screens read the shared answer", () => {
    expect(brief).toContain("useSiteLanguage()");
    expect(flow).toContain("useSiteLanguage()");
    expect(flow).not.toContain("useState<Language>(sessionLanguage)");
  });

  it("the address is heard in one place only, and it speaks to the store", () => {
    expect(hook).toContain('get("lang")');
    expect(hook).toContain("setLanguage(wanted)");
    expect(brief).not.toContain('get("lang")');
    expect(flow).not.toContain('get("lang")');
  });

  it("nobody guesses the language from the browser", () => {
    const guesses = ["app/elite-brief/page.tsx", "app/elite-intelligence/page.tsx", "hooks/useSiteLanguage.ts"]
      .filter((path) => readFileSync(path, "utf8").includes("navigator.language"));
    expect(guesses, `تخمين للغة من المتصفح في: ${guesses.join(", ")}`).toEqual([]);
  });

  it("the on-page switcher writes the shared setting and nothing else", () => {
    expect(flow).toContain("setSessionLanguage(lang);");
    expect(flow).not.toContain("setLanguage(lang);");
  });

  it("turns the whole page with the language, not only a paragraph", () => {
    // The flow screen carried an `rtl`/`ltr` class that Tailwind treats as a variant, not a
    // style — measured on the built page: with English chosen, the text was English and the
    // direction stayed right-to-left. The direction has to be said where it is read.
    expect(flow).toContain('dir={isRTL ? "rtl" : "ltr"}');
    expect(brief).toContain('dir={ar ? "rtl" : "ltr"}');
  });

  it("keeps the security-service wording off the customer's screens", () => {
    // The flow screen opened with «الاستخبارات المتميزة» — an intelligence-agency reading of
    // "Elite Intelligence" on a furniture brand's page.
    for (const path of ["app/elite-brief/page.tsx", "app/elite-intelligence/page.tsx"]) {
      expect(readFileSync(path, "utf8"), path).not.toContain("الاستخبارات");
    }
    expect(flow).toContain("أزينث — تجربة النخبة");
  });

  it("is the store's own value, and it answers the last writer", async () => {
    const { default: useSessionStore } = await import("@/stores/useSessionStore");
    const set = (lang: "ar" | "en") => useSessionStore.getState().setLanguage(lang);
    set("ar");
    expect(useSessionStore.getState().language).toBe("ar");
    set("en");
    expect(useSessionStore.getState().language).toBe("en");
    set("ar");
  });
});
