import { describe, expect, it } from "vitest";

import {
  AREA_CHIPS,
  coverageSentence,
  normalizeArea,
  areaFromWords,
  areaLabel,
  nearLabel,
  tasteLine,
  tasteOfArea,
  type AreaPaper,
} from "@/lib/regions";

/**
 * The region station's whole promise in one rule: an area's taste may be claimed only from papers
 * that really carry it, and the customer is told which of the three sources ordered his pictures —
 * including when the honest answer is «nothing measured yet».
 */
const PAPER = (id: number, city: string | null, hexes: string[] = []): AreaPaper => ({
  id,
  city,
  picks: hexes.map((hex) => ({ hex })),
});

describe("his words become the store's area", () => {
  it("gathers a short form and a sentence into the one area the map holds", () => {
    expect(normalizeArea("التجمع")).toBe("التجمع");
    expect(normalizeArea("التجمع الخامس")).toBe("التجمع");
    expect(normalizeArea("عايز شغل في زايد")).toBe("الشيخ زايد");
    expect(normalizeArea("اسكندرية")).toBe("الإسكندرية");
    expect(normalizeArea("ساكن في المعادي وعايز ركنة")).toBe("المعادي");
  });

  it("invents no area when his words are off the map", () => {
    expect(normalizeArea("")).toBeNull();
    expect(normalizeArea("منطقة تانية")).toBeNull();
    expect(normalizeArea(null)).toBeNull();
  });

  it("keeps his own spelling when the map has no match", () => {
    expect(areaLabel("منطقة تانية")).toBe("منطقة تانية");
    expect(areaLabel("  زايد  ")).toBe("الشيخ زايد");
  });

  it("offers no chip that the map cannot read back", () => {
    // A chip that did not normalize would silently file a customer under a word nothing counts.
    for (const chip of AREA_CHIPS) expect(normalizeArea(chip), chip).toBe(chip);
  });
});

describe("an area's taste is counted, never assumed", () => {
  it("takes only his area's papers, and only the ones that carry a colour", () => {
    const rows = [
      PAPER(1, "التجمع", ["#8C7D73"]),
      PAPER(2, "التجمع", ["#C7AC91"]),
      PAPER(3, "الشيخ زايد", ["#4B3A2F"]),
      PAPER(4, "التجمع"),
      PAPER(5, null, ["#000000"]),
    ];
    const taste = tasteOfArea(rows, "التجمع", 99);
    expect(taste.papers).toBe(2);
    expect(taste.hexes).toEqual(["#8C7D73", "#C7AC91"]);
  });

  it("refuses to make a customer his own area's evidence", () => {
    const rows = [PAPER(7, "التجمع", ["#8C7D73"])];
    expect(tasteOfArea(rows, "التجمع", 7)).toEqual({ area: "التجمع", papers: 0, hexes: [], colours: [] });
  });

  it("names the colours in words he reads, not as a code", () => {
    const taste = tasteOfArea([PAPER(1, "التجمع", ["#8C7D73"])], "التجمع", null);
    expect(taste.colours).toEqual(["رمادي"]);
    expect(taste.hexes.join()).not.toContain("undefined");
  });

  it("counts the colour the area chose most, first", () => {
    const rows = [
      PAPER(1, "التجمع", ["#4B3A2F"]),
      PAPER(2, "التجمع", ["#8C7D73", "#8C7D73"]),
      PAPER(3, "التجمع", ["#8C7D73"]),
    ];
    expect(tasteOfArea(rows, "التجمع", null).hexes[0]).toBe("#8C7D73");
  });

  it("says nothing is measured when he never named an area", () => {
    expect(tasteOfArea([PAPER(1, "التجمع", ["#8C7D73"])], null, null).papers).toBe(0);
  });
});

describe("the line says which source ordered his pictures", () => {
  const evidence = tasteOfArea([PAPER(1, "التجمع", ["#8C7D73"]), PAPER(2, "التجمع", ["#8C7D73"])], "التجمع", null);

  it("puts his own picks above a neighbourhood's average", () => {
    expect(tasteLine("own", evidence)).toContain("اللي إنت اختارته");
  });

  it("prints the evidence count in Arabic shape, never a Latin digit or a colour code", () => {
    const two = tasteLine("area", tasteOfArea([PAPER(1, "التجمع", ["#8C7D73"]), PAPER(2, "التجمع", ["#8C7D73"])], "التجمع", null));
    expect(two).toContain("ذوق التجمع");
    expect(two).toContain("ورقتين");
    expect(two).not.toMatch(/[0-9A-Za-z]/);
    expect(two).not.toContain("#");
  });

  it("does not announce one paper as a plural trend", () => {
    const one = tasteLine("area", tasteOfArea([PAPER(1, "التجمع", ["#8C7D73"])], "التجمع", null));
    expect(one).toContain("ورقة عميل واحد");
    const three = tasteLine("area", { area: "التجمع", papers: 3, hexes: [], colours: [] });
    expect(three).toContain("٣ ورقات عملاء");
    expect(three).not.toMatch(/[0-9]/);
  });

  it("admits an empty area by name instead of dressing up the quality order", () => {
    const line = tasteLine("quality", { area: "الإسكندرية", papers: 0, hexes: [], colours: [] });
    expect(line).toContain("الإسكندرية");
    expect(line).toContain("على جودتها");
  });

  it("keeps a silent record separate from an empty one", () => {
    const line = tasteLine("unreadable", { area: "الإسكندرية", papers: 0, hexes: [], colours: [] });
    expect(line).toContain("ما ردّش");
    expect(line).not.toContain("مفيش ورق");
  });

  it("tells a customer with no area recorded what he can still do", () => {
    const line = tasteLine("quality", { area: null, papers: 0, hexes: [], colours: [] });
    expect(line).toContain("اختارها فوق");
  });

  it("speaks no English to him", () => {
    for (const source of ["own", "area", "quality", "unreadable"] as const) {
      expect(tasteLine(source, evidence)).not.toMatch(/[A-Za-z]/);
    }
  });

  it("names on the badge the taste the picture really matched", () => {
    expect(nearLabel("own")).toBe("قريبة من اختيارك");
    expect(nearLabel("area")).toBe("قريبة من ذوق منطقتك");
    // A customer who chose nothing is not told a picture matched a choice he never made.
    expect(nearLabel("area")).not.toContain("اختيارك");
    for (const source of ["own", "area", "quality", "unreadable"] as const) {
      expect(nearLabel(source)).not.toMatch(/[A-Za-z]/);
    }
  });
});

describe("his own words name his area", () => {
  it("takes the newest area he said, not the first", () => {
    expect(areaFromWords(["اسكن في التجمع", "لأ بصراحة أقصد زايد"])).toBe("الشيخ زايد");
  });

  it("hears nothing when he named no area", () => {
    expect(areaFromWords([])).toBeNull();
    expect(areaFromWords(["عايز ركنة مودرن للصة", ""])).toBeNull();
  });

  it("reads only his lines — the store's own answer would name an area in every conversation", () => {
    // This is the reason the capture door is handed the customer's messages and nothing else.
    expect(areaFromWords([coverageSentence()])).toBe("التجمع");
  });
});

describe("the store's coverage has one owner", () => {  it("speaks the same areas the chips offer", () => {
    const sentence = coverageSentence();
    expect(sentence).toContain("القاهرة الكبرى");
    expect(sentence).toContain("الشيخ زايد");
    expect(sentence).toContain("الإسكندرية");
    // Nothing outside the map can appear, because the sentence is built from it.
    expect(sentence).not.toMatch(/[A-Za-z]/);
  });
});
