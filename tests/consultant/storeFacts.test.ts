import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { cleanSectionName, storeFactsBlock } from "@/lib/consultant/store-facts";

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

  it("names the unrecorded things so they are never invented", () => {
    expect(block).toContain("عنوان معرض");
    expect(block).toContain("مواعيد عمل");
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
});
