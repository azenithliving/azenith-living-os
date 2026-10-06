// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  BRIEF_BUDGET,
  VOICE_CHOICE_KEY,
  VOICE_SAMPLE,
  arabicVoices,
  chosenVoice,
  morningBrief,
  nextVoiceStep,
  pickArabicVoice,
  speakableSummary,
  voiceShortfallLine,
} from "@/lib/ops/voice-continuous";

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

/**
 * Why his phone said «مفيش صوت عربي» (measured from his screenshot 2026-10-06): Chrome returns an
 * empty voice list on the first call and fills it a moment later through `voiceschanged`. Refusing
 * before that list exists is the button's bug, not the phone's.
 */
describe("the button waits for the phone's voices", () => {
  it("speaks when an Arabic voice is there", () => {
    expect(nextVoiceStep({ voicesTotal: 4, arabicFound: true })).toBe("speak");
  });

  it("waits when the list has not been handed over yet", () => {
    expect(nextVoiceStep({ voicesTotal: 0, arabicFound: false })).toBe("wait");
  });

  it("only admits defeat on a loaded list with no Arabic voice", () => {
    expect(nextVoiceStep({ voicesTotal: 4, arabicFound: false })).toBe("unavailable");
  });
});

describe("the reason names what the phone has", () => {
  it("counts the voices it looked at, in his numerals", () => {
    const line = voiceShortfallLine(4);
    expect(line).toContain("٤");
    expect(line).toContain("عربي");
    expect(line.match(/[A-Za-z0-9]/g) ?? []).toEqual([]);
  });

  it("says plainly when the device has no voice at all", () => {
    expect(voiceShortfallLine(0)).toContain("مفيش صوت");
  });
});

describe("the reason line does not live inside the button row", () => {
  it("is its own note, so it cannot squeeze the buttons into a column", () => {
    // His screenshot showed the sentence stacked one word per line: it was a flex child of the
    // button row, and the row gave it the width left over from five buttons.
    const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");
    const row = panel.slice(panel.indexOf("data-voice-brief"), panel.indexOf("</div>", panel.indexOf("data-voice-brief")));
    expect(row).not.toContain("data-voice-note");
    expect(panel).toContain("data-voice-note");
  });
});

/**
 * What the engine is handed. Measured on his Windows machine 2026-10-06: the only Arabic voice the
 * browser exposes is «Microsoft Hoda - Arabic (Egypt)», a legacy machine voice — and he called the
 * result bad. Two of the causes are inside our control: a voice like that reads fully-vowelled
 * Arabic word by word instead of in phrases, and it is far likelier to skip or mangle Arabic-Indic
 * digits than the Latin ones it was trained on. The screen keeps his numerals; the mouth gets what
 * it pronounces.
 */
describe("the words handed to the voice", () => {
  it("takes the vowel marks off, so it reads phrases and not letters", () => {
    expect(speakableSummary("قرارًا مستني، وسجّلنا حفظًا جيدًا")).toBe("قرارا مستني، وسجلنا حفظا جيدا");
  });

  it("gives the engine digits it can say, while the screen keeps his", () => {
    const spoken = speakableSummary(morningBrief({ decisions: 29, unread: 4 }));
    expect(spoken).toContain("29");
    expect(spoken).toContain("4");
    expect(spoken.match(/[٠-٩]/g) ?? []).toEqual([]);
    expect(morningBrief({ decisions: 29, unread: 4 })).toContain("٢");
  });

  it("leaves the hamza and the letters alone while doing it", () => {
    expect(speakableSummary("أبدأ بالقرارات الأول؟")).toContain("أبدأ");
  });
});

/**
 * His ear decides which machine voice is good — so the cockpit must let him hear them and keep the
 * one he picked, on that device. Measured on his Windows browser: exactly one Arabic voice exists
 * («Microsoft Hoda»), which is why he called the reading bad; on his phone and on Chrome with the
 * network voices there is usually a better one to choose.
 */
describe("the voice he chose is kept", () => {
  const list = [
    { lang: "ar-EG", name: "Microsoft Hoda" },
    { lang: "ar-EG", name: "Google العربية" },
    { lang: "en-US", name: "Zira" },
  ];

  it("lists only the Arabic ones for him to try", () => {
    expect(arabicVoices(list).map((v) => v.name)).toEqual(["Microsoft Hoda", "Google العربية"]);
  });

  it("prefers his saved pick over any default ranking", () => {
    expect(pickArabicVoice(list, "Microsoft Hoda")?.name).toBe("Microsoft Hoda");
    expect(pickArabicVoice(list, "Google العربية")?.name).toBe("Google العربية");
  });

  it("falls back to the ranking when the saved voice is gone from the device", () => {
    expect(chosenVoice(list, "صوت مسحوب")).toBeNull();
    expect(pickArabicVoice(list, "صوت مسحوب")?.name).toBe("Microsoft Hoda");
    expect(pickArabicVoice(list, null)?.name).toBe("Microsoft Hoda");
  });

  it("offers a sample with no digits and no vowel marks, so voices are compared fairly", () => {
    expect(VOICE_SAMPLE.match(/[0-9٠-٩]/g) ?? []).toEqual([]);
    expect(VOICE_SAMPLE.match(/[\u064B-\u0652]/g) ?? []).toEqual([]);
    expect(VOICE_SAMPLE).toMatch(/\p{Script=Arabic}/u);
  });
});

describe("the picker is on the cockpit", () => {
  const panel = readFileSync("components/admin/agents/ChatPanel.tsx", "utf8");

  it("lets him try each voice and keep one", () => {
    expect(panel).toContain("data-voice-picker");
    expect(panel).toContain("data-voice-option");
    expect(panel).toContain("VOICE_CHOICE_KEY");
    expect(panel).toContain("VOICE_SAMPLE");
  });
});
