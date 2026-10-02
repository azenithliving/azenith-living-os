// @vitest-environment node
/**
 * The store's advisor never denies the store.
 *
 * The corpus is the published site's own words, frozen: on 2026-10-02 a customer asking about a
 * modern corner sofa was told, on Azenith's page, «أنا ذكاء اصطناعي، يعني مش محل موبيليا حقيقي».
 * These checks are the control behind that sentence — the prompt asks, this guard enforces, and
 * the negatives below are what stop the guard from chewing up a reply that was fine.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { IDENTITY_DENIAL, IDENTITY_LINE, enforceStoreIdentity } from "@/lib/consultant/identity-voice";

/** Word for word what the live consultant said to a customer. */
const LIVE_REPLY =
  "أهلاً بك! أنا ذكاء اصطناعي، يعني مش محل موبيليا حقيقي، لكن أقدر أساعدك جداً بالمعلومات والأفكار في الركن المودرن. لو بتدور على ركنة مودرن، دي نصائح هتفيدك.";

/**
 * The same question, answered after the first guard shipped — measured 2026-10-02. Three
 * denials the original pattern did not carry, which is why the rule is two-part now.
 */
const AFTER_FIRST_FIX =
  'أنا مساعد ذكي (AI)، ولست معرض أثاث حقيقي، فليس لدي "محل" أو "مخزن" لبيع الركنات. ولكن، أقدر أساعدك بمعلومات ونصائح لو بتدور على ركنة مودرن.';

describe("the denial never reaches the customer", () => {
  it("cuts the denial measured after the first version of the guard shipped", () => {
    const { reply, repaired } = enforceStoreIdentity(AFTER_FIRST_FIX, "ar");
    expect(repaired).toBe(true);
    expect(IDENTITY_DENIAL.test(reply)).toBe(false);
    expect(reply).toContain("ركنة مودرن");
    expect(reply).toContain(IDENTITY_LINE.ar);
  });

  it("keeps the advice that stands away from the denial", () => {
    const { reply, repaired } = enforceStoreIdentity(LIVE_REPLY, "ar");
    expect(repaired).toBe(true);
    expect(IDENTITY_DENIAL.test(reply)).toBe(false);
    // Sentence-splitting is Arabic-comma blind, so a clause riding in the denial's own sentence
    // goes with it. What must survive is the advice in its own sentence.
    expect(reply).toContain("دي نصائح هتفيدك");
    expect(reply).toContain(IDENTITY_LINE.ar);
  });

  it("replaces a reply that was nothing but a denial", () => {
    const { reply, repaired } = enforceStoreIdentity("أنا نموذج لغوي ولست متجراً.", "ar");
    expect(repaired).toBe(true);
    expect(reply).toBe(IDENTITY_LINE.ar);
  });

  it("handles the English form the same way", () => {
    const { reply, repaired } = enforceStoreIdentity(
      "As an AI language model, I can suggest layouts for your reception. I am not a real store.",
      "en"
    );
    expect(repaired).toBe(true);
    expect(IDENTITY_DENIAL.test(reply)).toBe(false);
    expect(reply).toContain("I am the Azenith Living advisor");
  });
});

describe("the guard leaves a good reply alone", () => {
  it("does not rewrite an answer that never denied anything", () => {
    const clean = "الركن المودرن بيحتاج إضاءة مخفية ومساحة حركة ٩٠ سم. تحب أبدأ معاك بالمقاسات ولا بالستايل؟";
    const { reply, repaired } = enforceStoreIdentity(clean, "ar");
    expect(repaired).toBe(false);
    expect(reply).toBe(clean);
  });

  it("never lets its own repair sentence carry the denial back in", () => {
    for (const line of [IDENTITY_LINE.ar, IDENTITY_LINE.en]) {
      expect(IDENTITY_DENIAL.test(line), line).toBe(false);
    }
  });

  it("says the Arabic line in Arabic", () => {
    // A Latin run inside an Arabic line flips the rendering on a phone — the customer's phone.
    expect(/[A-Za-z]{2,}/.test(IDENTITY_LINE.ar)).toBe(false);
    expect(IDENTITY_LINE.ar).toMatch(/\p{Script=Arabic}/u);
  });
});

describe("the prompt asks for what the guard enforces", () => {
  it("tells both consultant personas they are the store's advisor", () => {
    const route = readFileSync("app/api/consultant/route.ts", "utf8");
    const rules = route.match(/Never (say or imply|describe yourself) [^\n]+/g) ?? [];
    expect(rules.length, "a persona lost its identity rule").toBeGreaterThanOrEqual(2);
  });

  it("routes every model reply through the guard", () => {
    const route = readFileSync("app/api/consultant/route.ts", "utf8");
    expect(route).toContain('from "@/lib/consultant/identity-voice"');
    expect(route).toContain("enforceStoreIdentity(polished, language)");
  });
});
