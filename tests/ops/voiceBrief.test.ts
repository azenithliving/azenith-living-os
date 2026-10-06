// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { morningBrief, pickArabicVoice, BRIEF_BUDGET } from "@/lib/ops/voice-continuous";

/**
 * Ten seconds of the store, out loud.
 *
 * The owner reads his phone, he does not scroll it. The architecture asked for a short spoken brief;
 * measured before this file, the cockpit could speak an agent's reply but had nothing to say about
 * the morning — no count of what waits, and no sentence at all when nothing waited.
 *
 * Two rules from the way the rest of his surfaces are built: the numbers are his numerals, and a
 * brief that recites a whole audit is a brief he switches off after one morning.
 */
describe("the morning brief", () => {
  it("says what waits, in his Arabic and his numerals", () => {
    const line = morningBrief({ decisions: 3, unread: 2 });
    expect(line).toContain("٣ قرارات");
    expect(line).toContain("٢ رسالتين");
    expect(line.match(/[A-Za-z]/g) ?? []).toEqual([]);
    expect(line.match(/[0-9]/g) ?? []).toEqual([]);
  });

  it("agrees every count with its Arabic noun", () => {
    expect(morningBrief({ decisions: 1, unread: 0 })).toContain("قرار واحد");
    expect(morningBrief({ decisions: 2, unread: 0 })).toContain("قراران");
    expect(morningBrief({ decisions: 11, unread: 0 })).toContain("١١ قرار");
    expect(morningBrief({ decisions: 0, unread: 1 })).toContain("رسالة جديدة");
  });

  it("says the morning is quiet, instead of reading zeros at him", () => {
    const line = morningBrief({ decisions: 0, unread: 0 });
    expect(line).toContain("مفيش");
    expect(line.match(/[٠-٩]/g) ?? []).toEqual([]);
  });

  it("stays inside the ten seconds it promised", () => {
    expect(morningBrief({ decisions: 29, unread: 14 }).length).toBeLessThanOrEqual(BRIEF_BUDGET);
    expect(BRIEF_BUDGET).toBeLessThanOrEqual(170);
  });

  it("never invents a number it was not given", () => {
    expect(morningBrief({ decisions: null as any, unread: 4 })).not.toMatch(/قرار/);
    expect(morningBrief({ decisions: 4, unread: undefined as any })).not.toMatch(/رسال/);
  });
});

describe("the voice it reads with", () => {
  const voices = [
    { lang: "en-US", name: "Google US English" },
    { lang: "ar", name: "mike" },
    { lang: "ar-EG", name: "Salma" },
    { lang: "ar-SA", name: "Maged" },
  ];

  it("prefers the Egyptian voice", () => {
    expect(pickArabicVoice(voices)?.name).toBe("Salma");
  });

  it("prefers a named Arabic voice over an unnamed one, and any Arabic over none", () => {
    // Amended while writing the guard: my first version expected the unnamed `mike` here, which is
    // the wrong rule — a real named Arabic voice is the better reading, and `mike` is what is left
    // when nothing better exists.
    expect(pickArabicVoice(voices.filter((v) => v.lang !== "ar-EG"))?.name).toBe("Maged");
    expect(pickArabicVoice([{ lang: "en-US", name: "Google US English" }, { lang: "ar", name: "mike" }])?.name).toBe("mike");
    expect(pickArabicVoice([voices[0]])).toBeNull();
  });

  it("answers a voice list that has not loaded yet", () => {
    expect(pickArabicVoice([])).toBeNull();
    expect(pickArabicVoice(undefined as any)).toBeNull();
  });
});

describe("the cockpit button that plays it", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("is pressed by him, never fired on page load", () => {
    expect(panel).toContain("data-voice-brief");
    expect(panel).toContain("morningBrief");
    // An autoplay of speech on mount is both a browser-policy failure and rude.
    expect(panel).not.toMatch(/useEffect\([^)]*speakBrief/s);
  });

  it("says why it cannot speak when the phone has no Arabic voice", () => {
    expect(panel).toContain("مفيش صوت عربي");
  });

  it("stops the previous reading before starting a new one", () => {
    expect(panel).toMatch(/speechSynthesis\.cancel\(\)/);
  });
});
