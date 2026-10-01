// @vitest-environment node
import { describe, expect, it } from "vitest";

import { digitSignature, numberSignatures } from "@/lib/cad/paper-sketch-parser";

/**
 * The folding rule the two witnesses compare through. «٤٫٥٠», "4.50", "4,50" and the
 * offline engine's own mis-reading "450m" must all land on the same signature, or a
 * real number on paper looks unconfirmed and the whole reading is thrown away.
 */
describe("the digit folding both readers compare through", () => {
  it("folds Arabic, separators and units to one form", () => {
    expect(digitSignature("٤٫٥٠")).toBe("450");
    expect(digitSignature("4.50")).toBe("450");
    expect(digitSignature("4,5")).toBe("45");
    expect(digitSignature(4.5)).toBe("45");
    expect(digitSignature("450m")).toBe("450");
  });

  it("returns empty for text with no digits", () => {
    expect(digitSignature("لا يوجد")).toBe("");
    expect(digitSignature(undefined as unknown as string)).toBe("");
  });
});

/**
 * The forms a single measurement has to answer to. The dotless one is not
 * hypothetical: measured on a clean fixture, the offline engine returned "450m" for a
 * printed "4.50 m", and a rule that cannot meet that form throws away a real number.
 */
describe("the forms one measurement is written in", () => {
  it("carries the plain, one-decimal and two-decimal shapes", () => {
    const forms = numberSignatures(4.5);
    expect(forms.has("45")).toBe(true);
    expect(forms.has("450")).toBe(true);
    expect(digitSignature("450m")).toBe("450");
  });

  it("does not let a longer number match a shorter one", () => {
    const ten = numberSignatures(10);
    expect(ten.has(digitSignature("1"))).toBe(false);
    expect(ten.has(digitSignature("1.0"))).toBe(true);
  });

  it("maps every arabic digit, not a skipped few", () => {
    // Generated, never typed: a hand-written digit row is exactly where a skipped
    // digit hides, and it would silently mis-read a customer's measurement.
    const arabic = Array.from({ length: 10 }, (_, i) => String.fromCharCode(0x0660 + i)).join("");
    expect(digitSignature(arabic)).toBe("0123456789");
  });
});
