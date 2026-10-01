// @vitest-environment node
import { describe, expect, it } from "vitest";

import { digitSignature } from "@/lib/cad/paper-sketch-parser";

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
