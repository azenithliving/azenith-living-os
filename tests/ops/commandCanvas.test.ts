import { describe, it, expect } from "vitest";
import { pulseItems, PULSE_LABELS, type PulseSources } from "@/lib/ops/command-canvas";

/**
 * The command canvas is the first screen the owner opens on his phone. Its rule, written
 * in the page that carried it first: a number whose source does not exist yet is named in
 * words, never shown as a zero — because a zero is indistinguishable from a real
 * measurement, and that is exactly how a dead counter passes for a live one.
 */
const ALL: PulseSources = { customers: 21, needingReply: 4, decisions: 2, unread: 7, loaded: true };

describe("the store pulse reads four numbers and nothing else", () => {
  it("carries exactly the four measures", () => {
    expect(PULSE_LABELS).toEqual([
      "العملاء في الدفتر",
      "مستنيين رد",
      "قرارات مستنية كلمتك",
      "رسائل جديدة من الموظفين",
    ]);
    expect(pulseItems(ALL).map((i) => i.label)).toEqual(PULSE_LABELS);
  });

  it("writes every answered count in Arabic digits", () => {
    for (const item of pulseItems(ALL)) {
      expect(item.text).toMatch(/[\u0660-\u0669]/u);
      expect(item.text).not.toMatch(/[0-9]/);
    }
  });

  it("says so when a source has not answered, instead of showing a zero", () => {
    const cold = pulseItems({ ...ALL, customers: null, loaded: false });
    const waiting = cold.filter((i) => i.value === null);
    expect(waiting.map((i) => i.label)).toEqual(["العملاء في الدفتر", "رسائل جديدة من الموظفين"]);
    for (const item of waiting) {
      expect(item.text).not.toContain("٠");
      expect(item.text).not.toMatch(/[\u0660-\u06690-9]/u);
      expect(item.text).toMatch(/بستنى/u);
    }
  });

  it("still counts a real zero as a real measurement", () => {
    const empty = pulseItems({ customers: 0, needingReply: 0, decisions: 0, unread: 0, loaded: true });
    expect(empty.every((i) => i.text === "٠")).toBe(true);
  });

  it("ships Arabic labels only", () => {
    for (const item of pulseItems(ALL)) {
      expect(item.label).toMatch(/[\u0600-\u06FF]/u);
      expect(/[A-Za-z]/.test(item.label)).toBe(false);
    }
  });
});
