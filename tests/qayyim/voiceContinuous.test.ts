// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CONTINUOUS_SILENCE_MS,
  createDictation,
  dueToSend,
  markSent,
  record,
  shouldRestart,
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
  /** Chrome's recognizer ends by itself after a pause. In continuous mode that is
   * a restart, not the end of the session — but only while the owner is armed, or
   * the button would be lighting itself back up after he let go. */
  it("restarts when the recognizer stopped on its own mid-session", () => {
    expect(shouldRestart({ armed: true, stoppedByOwner: false })).toBe(true);
  });

  it("does not restart after the owner pressed stop, nor in single-utterance mode", () => {
    expect(shouldRestart({ armed: true, stoppedByOwner: true })).toBe(false);
    expect(shouldRestart({ armed: false, stoppedByOwner: false })).toBe(false);
  });
});
