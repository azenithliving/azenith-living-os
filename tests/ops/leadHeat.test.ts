// @vitest-environment node
import { describe, it, expect } from "vitest";
import { heatOf, pulseFor, shouldPulse, type HeatSignals } from "@/lib/ops/lead-heat";

/**
 * The golden moment (master-list item 16).
 *
 * The architecture names three proofs that a customer is ready — he raised his paper, he handed
 * the link to a second person, or he came back to the pictures more than three times — and says the
 * owner must be told on Telegram in the same minute. Measured before this file existed: no rule
 * anywhere raised a customer to «ساخن جداً» and no pulse was sent on any of the three.
 *
 * The votes desk is the one place a shared link proves itself: a second voter cannot exist unless
 * the sheet left the customer's hands.
 */
const base: HeatSignals = { voters: 0, hasSketch: false, returns: 0 };
const withReturns = { voters: 1, returns: 4 };

describe("the heat rule reads the three proofs", () => {
  it("is hot the moment the link reaches a second person", () => {
    expect(heatOf({ ...base, voters: 2 })).toBe("ساخن جداً");
  });

  it("is hot when the customer raised his paper", () => {
    expect(heatOf({ ...base, hasSketch: true })).toBe("ساخن جداً");
  });

  it("is hot only after the fourth return to the pictures", () => {
    expect(heatOf({ ...base, returns: 3 })).not.toBe("ساخن جداً");
    expect(heatOf({ ...base, returns: 4 })).toBe("ساخن جداً");
  });

  it("is not hot on nothing at all", () => {
    expect(heatOf(base)).toBe("بيتفرج");
  });

  it("ranks a single engaged visitor above a stranger", () => {
    expect(heatOf({ ...base, voters: 1 })).toBe("جدّي");
  });
});

describe("the pulse the owner receives", () => {
  it("is written in his Arabic, with his numerals", () => {
    const line = pulseFor({ room: "living-room", city: "التجمع", voters: 2, returns: 0, heat: "ساخن جداً" });
    expect(line.match(/[A-Za-z]/g) ?? []).toEqual([]);
    expect(line).toContain("٢");
    expect(line.match(/[0-9]/g) ?? []).toEqual([]);
  });

  /**
   * The pulse must say the room the way the owner's own golden file says it — whatever that
   * wording is — and never the bank slug. Asserting the exact phrase here would freeze one
   * module's wording while another module already calls the same room something else; that drift
   * is filed as its own item, not hidden in a test.
   */
  it("names the room the way he reads it, never the bank slug", async () => {
    const { roomLabel } = await import("@/lib/cad/dossier");
    const line = pulseFor({ room: "living-room", city: null, voters: 3, returns: 0, heat: "ساخن جداً" });
    expect(line).not.toContain("living-room");
    expect(line).toContain(String(roomLabel("living-room")));
    expect(line).toMatch(/\p{Script=Arabic}/u);
  });

  it("says what happened, and stays out of the forbidden domains", () => {
    const line = pulseFor({ room: "master-bedroom", city: "الشيخ زايد", voters: 2, returns: 0, heat: "ساخن جداً" });
    expect(line).toMatch(/شارك|صوّت|أهله/);
    expect(line).not.toMatch(/جنيه|سعر|تكلفة|ربح|مصنع|تصنيع/);
  });

  /**
   * The third proof, measured rather than hardcoded: before the visit counter existed the votes
   * desk passed a literal zero, so this line could never have been written from real data.
   */
  it("says he came back when coming back is the only proof there is", () => {
    const line = pulseFor({ room: "living-room", city: "التجمع", ...withReturns, heat: "ساخن جداً" });
    expect(line).toContain("٤");
    expect(line).toMatch(/رجع|راجعة/);
    expect(line.match(/[A-Za-z]/g) ?? []).toEqual([]);
    expect(line.match(/[0-9]/g) ?? []).toEqual([]);
  });

  it("still names the family first, because sharing the link is the stronger proof", () => {
    const line = pulseFor({ room: "living-room", city: null, voters: 2, returns: 9, heat: "ساخن جداً" });
    expect(line).toMatch(/شارك|صوّت|أهله/);
    expect(line).not.toContain("٩");
  });

  it("never invents a city the sheet does not carry", async () => {
    const { roomLabel } = await import("@/lib/cad/dossier");
    const line = pulseFor({ room: "kitchen", city: null, voters: 2, returns: 0, heat: "ساخن جداً" });
    expect(line).not.toContain("null");
    expect(line).toContain(String(roomLabel("kitchen")));
  });
});

describe("the pulse fires once per sheet", () => {
  const hot: HeatSignals = { voters: 2, hasSketch: false, returns: 0 };

  it("fires the first time, and never again", () => {
    expect(shouldPulse(hot, null)).toBe(true);
    expect(shouldPulse(hot, new Date("2026-10-06T00:00:00Z"))).toBe(false);
  });

  it("does not fire for a cold sheet that has already been notified", () => {
    expect(shouldPulse(base, new Date("2026-10-06T00:00:00Z"))).toBe(false);
    expect(shouldPulse(base, null)).toBe(false);
  });
});
