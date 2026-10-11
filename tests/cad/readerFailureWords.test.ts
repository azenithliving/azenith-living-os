// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readerFailureWords } from "@/lib/cad/paper-sketch-parser";

/**
 * What the paper desk says when a reader refuses.
 *
 * Three sentences were measured on his paper desk on 2026-10-11, each carrying the provider's own
 * English prose inside an Arabic line: «google API error: 503 - This model is currently experiencing»,
 * «google API error: 403 - Your project has been denied access.», «anthropic API error: 400 - Your
 * credit balance is too low to». He cannot read any of them, and each is one of a few facts he can act
 * on — a busy model, a refused key, an empty balance, a quota. The raw sentence is not kept: a code he
 * cannot read is not a clue, and the class is what changes what he does next.
 */
const latin = (s: string) => s.match(/[A-Za-z]{2,}/g) ?? [];

describe("the paper desk's refusal", () => {
  it("names a busy model, a refused key and an empty balance in his words", () => {
    expect(readerFailureWords("google API error: 503 - This model is currently experiencing")).toBe("الموديل مشغول دلوقتي (٥٠٣)");
    expect(readerFailureWords("google API error: 403 - Your project has been denied access.")).toBe("المفتاح مرفوض من المزود (٤٠٣)");
    expect(readerFailureWords("anthropic API error: 400 - Your credit balance is too low to")).toBe("رصيد المفتاح خلص (٤٠٠)");
  });

  it("says a quota, because that is the one case the desk already knew", () => {
    expect(readerFailureWords("429 Too Many Requests")).toContain("سقف الدقايق خلص");
  });

  it("admits it does not know, rather than pasting a sentence he cannot read", () => {
    expect(readerFailureWords("something nobody has ever seen")).toBe("سبب غير معروف");
    expect(readerFailureWords(null)).toBe("سبب غير معروف");
  });

  it("carries no Latin and no Latin digits in any of them", () => {
    for (const raw of [
      "google API error: 503 - This model is currently experiencing",
      "openai error: 401 - Incorrect API key provided",
      "500 internal server error",
      "something nobody has ever seen",
    ]) {
      expect(latin(readerFailureWords(raw)), raw).toEqual([]);
    }
  });
});
