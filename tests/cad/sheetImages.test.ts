// @vitest-environment node
import { describe, it, expect } from "vitest";
import { diversifyByStyle } from "@/lib/cad/sheet-images";

/**
 * Three suggestions that are the same room in three lights are one suggestion. The bank is
 * ordered by quality, and the highest-quality bedroom pictures measured on the live bank all
 * sit in the same style — so the pick has to walk the styles before it repeats one.
 */
const rows = [
  { url: "a", style: "classic" },
  { url: "b", style: "classic" },
  { url: "c", style: "modern" },
  { url: "d", style: null },
  { url: "e", style: "scandinavian" },
];

describe("the suggestions cover tastes, not one taste three times", () => {
  it("takes the best of each style first, in quality order", () => {
    expect(diversifyByStyle(rows, 3).map((r) => r.url)).toEqual(["a", "c", "d"]);
  });

  it("fills the rest from the same bank when styles run out", () => {
    expect(diversifyByStyle(rows, 5).map((r) => r.url)).toEqual(["a", "c", "d", "e", "b"]);
  });

  it("never returns more than was asked, and never invents one", () => {
    expect(diversifyByStyle(rows, 0)).toEqual([]);
    expect(diversifyByStyle([], 3)).toEqual([]);
    expect(diversifyByStyle(rows, 99)).toHaveLength(5);
  });
});
