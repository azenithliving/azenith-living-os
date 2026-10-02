import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { buildCoverageReply, buildHoursReply, buildShowroomReply, cleanSectionName, storeFactsBlock } from "@/lib/consultant/store-facts";

/** The catalogue's own line names, read off the store's record on 2026-10-02. */
const LINES = ["الصالات المودرن", "كنب الزوايا", "غرف النوم الرئيسية", "المطابخ الحديثة", "غرف الملابس"];

describe("a catalogue line keeps its Arabic and drops the Latin gloss", () => {
  it("strips the bracketed Latin the record carries", () => {
    expect(cleanSectionName("غرف الملابس (Dressing)")).toBe("غرف الملابس");
    expect(cleanSectionName("كنب الزوايا (R)")).toBe("كنب الزوايا");
  });

  it("leaves a plain Arabic line exactly as it was", () => {
    expect(cleanSectionName("المجالس العربية")).toBe("المجالس العربية");
  });
});

describe("the facts block the advisor reads about its own store", () => {
  const block = storeFactsBlock({ whatsappLocal: "1090819584", lines: LINES });

  it("carries the catalogue, the WhatsApp and the team that executes", () => {
    expect(block).toContain("الصالات المودرن");
    expect(block).toContain("كنب الزوايا");
    expect(block).toContain("فريق الدار هو اللي بينفّذ الشغل");
  });

  it("writes the number in the digits this owner reads", () => {
    expect(block).toContain("١٠٩٠٨١٩٥٨٤");
    expect(block).not.toContain("1090819584");
  });

  it("states that there is no showroom, so no customer is invited to one", () => {
    expect(block).toContain("الدار ملهاش معرض");
    expect(block).toContain("ما تدعوش عميل يزور معرض");
    expect(block).toContain("بيتصنّع حسب الطلب");
  });

  it("names the unrecorded things so they are never invented", () => {
    expect(block).toContain("أي سعر جاهز");
    expect(block).toContain("متخترعش");
  });

  it("tells the advisor to answer coverage questions as the store", () => {
    expect(block).toContain("مين اللي بينفّذ الشغل");
    expect(block).toContain("متتكلمش عن شركات أو ورش أو سوق بشكل عام");
  });

  it("says nothing in Latin, because the customer's phone reads Arabic", () => {
    expect(/[A-Za-z]{2,}/.test(block)).toBe(false);
  });

  it("still stands when the record is empty, without inventing a number", () => {
    const empty = storeFactsBlock({ whatsappLocal: null, lines: [] });
    expect(empty).toContain("متخترعش");
    expect(empty).not.toContain("undefined");
    expect(empty).not.toContain("واتساب الدار على");
  });
});

describe("the advisor's door reads the record live and puts it in the persona", () => {
  const route = readFileSync("app/api/consultant/route.ts", "utf8");

  it("reads the facts on every question", () => {
    expect(route).toContain('from "@/lib/consultant/store-facts"');
    expect(route).toContain("storeFactsBlock(await readStoreFacts())");
    expect(route).toContain("weatherDateTime,\n      factsBlock");
  });

  it("seats the facts last in the prompt, after the geography and the learnings", () => {
    const at = route.indexOf("let systemContent = `${SALES_EXCELLENCE_PROMPT}");
    const facts = route.indexOf("systemContent += `\\n\\n${factsBlock}`;");
    const geo = route.indexOf("GEOGRAPHICAL AWARENESS");
    const learnings = route.indexOf("[Approved business learnings from management");
    expect(at).toBeGreaterThan(-1);
    expect(geo).toBeGreaterThan(at);
    expect(learnings).toBeGreaterThan(geo);
    expect(facts).toBeGreaterThan(learnings);
  });

  it("stops feeding chat-mined pairs to the advisor as management policy", () => {
    expect(route).toContain('.filter((instruction) => !instruction.trim().startsWith("سؤال:"))');
  });

  it("answers a coverage question from the record instead of from a model", () => {
    expect(route).toContain("asksCoverage(message) || asksExecution(message)");
    expect(route).toContain("asksShowroomVisit(message)");
    expect(route).toContain("buildCoverageReply(facts, language)");
    expect(route).toContain("buildShowroomReply(facts, language)");
    expect(route).toContain("asksApproximatePrice(latestUserMessage)");
    expect(route).toContain("asksWorkingHours(message)");
    expect(route).toContain("buildHoursReply(facts, language)");
  });
});

describe("the store's own answer about visiting it", () => {
  const reply = buildShowroomReply({ whatsappLocal: "1090819584", lines: LINES }, "ar");

  it("says there is no showroom, and offers the real process instead", () => {
    expect(reply).toContain("ملناش معرض");
    expect(reply).toContain("بتتصمّم وبتتصنّع حسب الطلب");
    expect(reply).toContain("مقاسات المكان والستايل");
    expect(reply).toContain("١٠٩٠٨١٩٥٨٤");
  });

  it("never points the customer at a map or another shop", () => {
    expect(reply).not.toMatch(/خرائط|جوجل|شوروم تاني|معرض تاني|أي معرض/);
    expect(/[A-Za-z]{2,}/.test(reply)).toBe(false);
  });

  it("answers an English visitor in English", () => {
    const en = buildShowroomReply({ whatsappLocal: "1090819584", lines: [] }, "en");
    expect(en).toContain("keeps no showroom");
    expect(en).toContain("to your measurements");
  });
});

describe("the store's own answer about its hours", () => {
  const HOURS = "مواعيد العمل: كل أيام الأسبوع من ٩ صباحًا حتى ٨ مساءً، ما عدا الجمعة.";

  it("quotes the row the owner wrote, in his words, without the label", () => {
    const reply = buildHoursReply({ whatsappLocal: "1090819584", lines: [], workingHours: HOURS }, "ar");
    expect(reply).toContain("كل أيام الأسبوع من ٩ صباحًا حتى ٨ مساءً، ما عدا الجمعة.");
    expect(reply).not.toMatch(/^مواعيد العمل\s*:/);
    expect(reply).toContain("واتساب الدار ١٠٩٠٨١٩٥٨٤");
  });

  it("never answers with a chatbot's uptime", () => {
    const reply = buildHoursReply({ whatsappLocal: null, lines: [], workingHours: HOURS }, "ar") ?? "";
    expect(reply).not.toMatch(/24|٢٤|دائمًا|على مدار/);
  });

  it("leaves the question to the advisor when nothing is recorded, and for an English visitor", () => {
    expect(buildHoursReply({ whatsappLocal: "1090819584", lines: [], workingHours: null }, "ar")).toBeNull();
    expect(buildHoursReply({ whatsappLocal: "1090819584", lines: [], workingHours: HOURS }, "en")).toBeNull();
  });
});

describe("the store's own coverage answer", () => {
  const reply = buildCoverageReply({ whatsappLocal: "1090819584", lines: LINES }, "ar");

  it("names the regions, the team that executes, and the way to reach a human", () => {
    expect(reply).toContain("القاهرة الكبرى");
    expect(reply).toContain("التجمع");
    expect(reply).toContain("فريق الدار نفسه");
    expect(reply).toContain("وملناش معرض");
    expect(reply).toContain("١٠٩٠٨١٩٥٨٤");
  });

  it("says nothing about other companies and nothing in Latin", () => {
    // «ورشتها» is the store's own workshop; what must not appear is a guide to somebody else's.
    expect(reply).not.toMatch(/شركات|مقاولات|ورش تانية|معظم|أغلب/);
    expect(/[A-Za-z]{2,}/.test(reply)).toBe(false);
  });

  it("stands without a recorded number, and answers an English visitor in English", () => {
    const bare = buildCoverageReply({ whatsappLocal: null, lines: [] }, "ar");
    expect(bare).toContain("فريق الدار نفسه");
    expect(bare).not.toContain("واتساب");
    const en = buildCoverageReply({ whatsappLocal: "1090819584", lines: [] }, "en");
    expect(en).toContain("Greater Cairo");
    expect(en).toMatch(/\p{Script=Latin}/u);
  });
});
