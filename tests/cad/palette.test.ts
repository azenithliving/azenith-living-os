import { describe, expect, it } from "vitest";

import { FAMILY_LABELS, FAMILY_ORDER, familyOf, hexToRgb, paletteFor, rankByPicks } from "@/lib/cad/palette";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * The colour matrix on a customer's sheet, and the ranking his picks drive.
 *
 * Every rule here was fitted to the store's own picture bank, measured 2026-10-03 over 5,909
 * pictures: neutrals and warm woods are the bank, blue and green together are about two percent.
 * So the matrix only ever offers a colour the room's pictures actually carry, the swatch is a real
 * stored colour rather than a drawn-up average, and a pick re-orders the bank's own pictures
 * instead of promising anything the bank cannot show.
 */
const rgb = (hex: string) => hexToRgb(hex);

describe("a colour read off the bank", () => {
  it("turns a hex into the three numbers the rule uses", () => {
    expect(rgb("#808080")).toEqual({ r: 128, g: 128, b: 128 });
    expect(rgb("F2EFE9")).toEqual({ r: 242, g: 239, b: 233 });
    expect(rgb("not-a-colour")).toBeNull();
  });

  it("names the families the bank actually holds", () => {
    expect(familyOf("#A7937D")).toBe("warmBeige"); // the living room's own average
    expect(familyOf("#583D26")).toBe("darkWood");
    expect(familyOf("#555148")).toBe("grey");
    expect(familyOf("#BFAF9F")).toBe("offWhite");
    expect(familyOf("#F2EFE9")).toBe("matteWhite");
    expect(familyOf("#2B2E33")).toBe("charcoal");
    expect(familyOf("#3E5A78")).toBe("blue");
    expect(familyOf("junk")).toBeNull();
  });

  it("keeps the order the bank falls in, and offers no family it cannot back", () => {
    // Shares measured on the whole bank: grey 36%, warm beige 23%, wood 13%, off white 12%.
    expect(FAMILY_ORDER.slice(0, 4)).toEqual(["grey", "warmBeige", "wood", "offWhite"]);
    for (const family of FAMILY_ORDER) expect(family).toMatch(/^[a-z][A-Za-z]+$/);
  });
});

describe("the matrix of one room's pictures", () => {
  const images = [
    { color: "#A7937D" },
    { color: "#9F8C7B" },
    { color: "#583D26" },
    { color: "#555148" },
    { color: null },
    { color: "#BFAF9F" },
  ];

  it("groups only the families a picture backs, in the bank's own order", () => {
    expect(paletteFor(images).map((f) => [f.family, f.count])).toEqual([
      ["grey", 1],
      ["warmBeige", 2],
      ["offWhite", 1],
      ["darkWood", 1],
    ]);
  });

  it("shows a colour that is really in one of his pictures", () => {
    const matrix = paletteFor(images);
    expect(matrix[1].hex).toBe("#A7937D");
    for (const entry of matrix) {
      expect(images.some((image) => image.color === entry.hex)).toBe(true);
    }
  });

  it("labels every family in Arabic, with no machine key inside the word", () => {
    for (const entry of paletteFor(images)) {
      expect(entry.label).toMatch(/\p{Script=Arabic}/u);
      expect(entry.label).not.toMatch(/[A-Za-z]{2,}/);
      expect(entry.label).toBe(FAMILY_LABELS[entry.family]);
    }
    expect(FAMILY_ORDER.every((family) => family in FAMILY_LABELS)).toBe(true);
  });

  it("never offers a colour the room has no picture for, and none at all for no pictures", () => {
    expect(paletteFor(images).some((f) => f.family === "blue")).toBe(false);
    expect(paletteFor([])).toEqual([]);
    expect(paletteFor([{ color: "#12345" }])).toEqual([]);
  });
});

describe("his picks re-rank his own pictures", () => {
  const images = [
    { id: 1, color: "#8D705E" },
    { id: 2, color: "#F2EFE9" },
    { id: 3, color: "#5B5348" },
    { id: 4, color: "#3E5A78" },
  ];

  it("puts the closest pictures first and marks which ones are close", () => {
    const ranked = rankByPicks(images, ["#8D705E"]);
    expect(ranked.map((r) => r.id)).toEqual([1, 3, 4, 2]);
    // Measured distances to his colour: 0, 62, 86, 209. The line the bank draws is 40, so only the
    // first is called close — a badge on everything is no badge at all.
    expect(ranked[0].near).toBe(true);
    expect(ranked[1].near).toBe(false);
    expect(ranked[3].near).toBe(false);
  });

  it("answers with the bank's own order while he has chosen nothing", () => {
    expect(rankByPicks(images, []).map((r) => r.id)).toEqual([1, 2, 3, 4]);
    expect(rankByPicks(images, []).every((r) => !r.near)).toBe(true);
  });

  it("is not fooled by a pick the room has no picture for", () => {
    const ranked = rankByPicks(images, ["#3E5A78"]);
    expect(ranked[0].id).toBe(4);
    expect(ranked[0].near).toBe(true);
  });

  it("keeps a picture with no stored colour at the end instead of ranking a guess", () => {
    const ranked = rankByPicks([{ id: 9, color: null }, { id: 1, color: "#8D705E" }], ["#8D705E"]);
    expect(ranked.map((r) => r.id)).toEqual([1, 9]);
    expect(ranked[1].near).toBe(false);
  });

  it("reads more than one pick as one palette, not as three separate lists", () => {
    const ranked = rankByPicks(images, ["#3E5A78", "#F2EFE9"]);
    // The two picked colours first, then the rest by how near they are to either one (57, then 86).
    expect(ranked.map((r) => r.id)).toEqual([2, 4, 3, 1]);
    expect(ranked.filter((r) => r.near).map((r) => r.id)).toEqual([2, 4]);
  });
});

describe("the digits a customer reads", () => {
  it("counts the bank in his own numerals", () => {
    // The store's own formatter groups thousands with an Arabic separator, so the assertion is
    // about which numerals appear — never Latin digits on a customer's sheet.
    const counted = arNum(1332);
    expect(counted).toMatch(/[٠-٩]/);
    expect(counted).not.toMatch(/[0-9]/);
  });
});
