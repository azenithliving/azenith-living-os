// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CONTINUOUS_SILENCE_MS,
  createDictation,
  dueToSend,
  markSent,
  record,
  shouldRestart,
  speakableSummary,
  stopDictation,
  transcriptOf,
} from "@/lib/qayyim/voice-continuous";

/**
 * Continuous dictation for a shop owner who talks in whole sentences and does
 * not want to press a button between them. The recognizer is the noisy part: it
 * emits half-words, it ends on its own mid-thought, and it fires no event when
 * the room goes quiet. So the *decision* — what was said, and when a pause means
 * "send it" — lives here as data, where it can be tested against a clock instead
 * of a browser.
 */
const T0 = 1_000_000;

function say(finalText: string, interimText = "") {
  return { finalText, interimText };
}

describe("transcriptOf", () => {
  it("splits what is settled from what is still being heard", () => {
    const event = {
      results: [
        { isFinal: true, 0: { transcript: "افتح المسودات" } },
        { isFinal: false, 0: { transcript: " اللي" } },
      ],
    };
    expect(transcriptOf(event)).toEqual({ finalText: "افتح المسودات", interimText: " اللي" });
  });

  it("survives the shapes a real browser throws at it", () => {
    expect(transcriptOf(undefined)).toEqual({ finalText: "", interimText: "" });
    expect(transcriptOf({})).toEqual({ finalText: "", interimText: "" });
    expect(transcriptOf({ results: [] })).toEqual({ finalText: "", interimText: "" });
    expect(transcriptOf({ results: [{ isFinal: true, 0: {} }] })).toEqual({ finalText: "", interimText: "" });
  });
});

describe("the silence gate", () => {
  it("waits for a real pause before sending", () => {
    const d = record(createDictation(T0), say("قياس سرعة الصفحة"), T0);
    expect(dueToSend(d, T0 + 400)).toBeNull();
    expect(dueToSend(d, T0 + CONTINUOUS_SILENCE_MS - 1)).toBeNull();
    expect(dueToSend(d, T0 + CONTINUOUS_SILENCE_MS)).toBe("قياس سرعة الصفحة");
  });

  it("keeps collecting while the owner is still talking", () => {
    let d = record(createDictation(T0), say("قياس"), T0);
    d = record(d, say("", "السرعة بتاعة"), T0 + 500);
    // interim text means the microphone is mid-sentence: never cut him off
    expect(dueToSend(d, T0 + 5_000)).toBeNull();
    d = record(d, say("السرعة بتاعة الموقع"), T0 + 1_100);
    expect(dueToSend(d, T0 + 2_400)).toBe("قياس السرعة بتاعة الموقع");
  });

  it("sends a sentence once, not every tick after the pause", () => {
    let d = record(createDictation(T0), say("اعرض الأهداف"), T0);
    const due = dueToSend(d, T0 + 2_000);
    expect(due).toBe("اعرض الأهداف");
    d = markSent(d, T0 + 2_000);
    expect(dueToSend(d, T0 + 9_000)).toBeNull();
    expect(d.sentCount).toBe(1);
  });

  it("never sends an empty pause", () => {
    const d = createDictation(T0);
    expect(dueToSend(d, T0 + 60_000)).toBeNull();
    expect(dueToSend(record(d, say("   "), T0), T0 + 60_000)).toBeNull();
  });

  it("ignores input once the owner stopped it", () => {
    const stopped = stopDictation(record(createDictation(T0), say("كلام"), T0)).dictation;
    expect(dueToSend(stopped, T0 + 9_000)).toBeNull();
  });
});

describe("stopDictation", () => {
  it("hands back what was still pending so nothing is swallowed", () => {
    const d = record(createDictation(T0), say("فحص الأمان"), T0);
    const { leftover, dictation } = stopDictation(d);
    expect(leftover).toBe("فحص الأمان");
    expect(dictation.armed).toBe(false);
    expect(dictation.pending).toBe("");
  });

  it("says null when there was nothing left to send", () => {
    expect(stopDictation(createDictation(T0)).leftover).toBeNull();
  });
});

describe("restart rule", () => {
  it("restarts when the recognizer stopped on its own mid-session", () => {
    expect(shouldRestart({ armed: true, stoppedByOwner: false })).toBe(true);
  });

  it("does not restart after the owner pressed stop, nor in single-utterance mode", () => {
    expect(shouldRestart({ armed: true, stoppedByOwner: true })).toBe(false);
    expect(shouldRestart({ armed: false, stoppedByOwner: false })).toBe(false);
  });
});

/**
 * The plan asked for «نطق ملخص لا كامل»: a voice that reads a whole audit out
 * loud is a voice that gets switched off. So the summary is a decision with a
 * rule, not a `slice(0, 500)` — it stops at a sentence, says what it left out,
 * and never invents a shorter answer than the one on screen.
 */
describe("speakableSummary", () => {
  it("passes a short reply through untouched apart from markdown noise", () => {
    expect(speakableSummary("**الموقع شغال** تمام")).toBe("الموقع شغال تمام");
  });

  it("stops at a sentence boundary, not in the middle of a word", () => {
    const long = "الصفحة الرئيسية تفتح في ثانيتين. " + "باقى الكلام طويل جداً ومش لازم يتنطق كله. وشكراً";
    const out = speakableSummary(long, 40);
    // The sentence ends at 34 characters of a 40 budget, and it still says it
    // stopped: the owner must never hear a truncated reading as a complete one.
    expect(out).toBe("الصفحة الرئيسية تفتح في ثانيتين.… كمّل في الشاشة");
  });

  it("says what it left out, so a short reading is not mistaken for a short answer", () => {
    const long = "الأهداف المهددة: اتنين. " + "تفاصيل ".repeat(60);
    const out = speakableSummary(long, 60);
    expect(out).toContain("اتنين");
    expect(out).toContain("كمّل في الشاشة");
    expect(out.length).toBeLessThanOrEqual(60 + "… كمّل في الشاشة".length);
  });

  it("drops links to a word the owner can hear, and never returns silence for text", () => {
    expect(speakableSummary("شوف https://azenith-living.vercel.app/rooms")).toContain("رابط");
    expect(speakableSummary("   ")).toBe("");
    expect(speakableSummary("")).toBe("");
    expect(speakableSummary(null as unknown as string)).toBe("");
  });

  it("never reads Latin inline where an Arabic listener would hear noise", () => {
    const out = speakableSummary("الأداة qa_load_probe قاست ٣ صفحات");
    expect(out).not.toMatch(/[A-Za-z]{2,}/);
    expect(out).toContain("قاست");
  });
});
