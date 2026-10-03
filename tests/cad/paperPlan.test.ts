import { describe, expect, it } from "vitest";

import { DRAWABLE_SHAPES, planFromPaper, shapeFromSideCount } from "@/lib/cad/plan";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * The paper is stored as numbers; the sheet the customer signs has to be a drawing. This is the
 * step that decides, from what the store already holds, which template to walk — and when the
 * numbers alone do not decide, what to ask him instead of guessing a room.
 */
const dim = (meters: number, confirmed = true, label = "ضلع") => ({ label, meters, confirmed });

describe("the template the numbers point at", () => {
  it("reads four sides as a rectangle and six as an L", () => {
    expect(shapeFromSideCount(4)).toBe("rectangle");
    expect(shapeFromSideCount(6)).toBe("l-shape");
  });

  it("reads a room named by two numbers as the rectangle those two numbers are", () => {
    // Measured on the store's own papers (2026-10-03): all nineteen hold either no number or
    // exactly two — length and width. A drawing that waited for four numbers would never appear
    // on one real sheet, and the missing two are not invented: a rectangle's opposite walls are
    // its own pair by definition.
    expect(shapeFromSideCount(2)).toBe("rectangle");
  });

  it("does not decide a shape from a count that fits nothing", () => {
    expect(shapeFromSideCount(3)).toBeNull();
    expect(shapeFromSideCount(5)).toBeNull();
    expect(shapeFromSideCount(7)).toBeNull();
  });

  it("only offers shapes the store can actually walk", () => {
    expect(DRAWABLE_SHAPES).toEqual(["rectangle", "l-shape"]);
  });
});

describe("a rectangle named by its length and width", () => {
  const built = planFromPaper({ dimensions: [dim(4.5), dim(3.2)] });

  it("walks four walls out of the two the paper carried", () => {
    expect(built.plan?.walls.map((w) => w.meters)).toEqual([4.5, 3.2, 4.5, 3.2]);
    expect(built.plan?.complete).toBe(true);
    expect(built.plan?.areaSqm).toBeCloseTo(14.4, 2);
    expect(built.plan?.conflicts).toEqual([]);
  });

  it("says how many numbers the paper actually had", () => {
    expect(built.plan?.sidesOnPaper).toBe(2);
  });

  it("hands each implied wall the witness of the number it repeats", () => {
    const oneSided = planFromPaper({ dimensions: [dim(4.5), dim(3.2, false)] });
    expect(oneSided.plan?.walls.map((w) => w.confirmed)).toEqual([true, false, true, false]);
  });

  it("still refuses when the two numbers are not a room", () => {
    expect(planFromPaper({ dimensions: [dim(4.5)] }).plan).toBeNull();
  });
});

describe("a paper that says enough", () => {
  const built = planFromPaper({
    dimensions: [dim(4.5), dim(3.2), dim(4.5, false), dim(3.2)],
    openings: [{ kind: "door", widthMeters: 0.9 }],
  });

  it("draws the room from the paper's own order", () => {
    expect(built.plan).not.toBeNull();
    expect(built.question).toBeNull();
    expect(built.plan?.walls.map((w) => w.meters)).toEqual([4.5, 3.2, 4.5, 3.2]);
  });

  it("keeps a side no witness vouched for as indicative, not as fact", () => {
    expect(built.plan?.walls[2].confirmed).toBe(false);
    // The third wall is the 4.5 nobody agreed on, so the room still closes on paper: the
    // drawing shows it, dashed, and the phone call is what settles it.
    expect(built.plan?.complete).toBe(true);
  });

  it("hands the paper's opening to the drawing so it lands on a wall", () => {
    expect(built.plan?.openings).toHaveLength(1);
    expect(built.plan?.openings[0].kind).toBe("door");
    expect(built.plan?.openings[0].widthMeters).toBe(0.9);
  });

  it("reports the area the polygon holds, which the sheet prints in his digits", () => {
    expect(built.plan?.areaSqm).toBeCloseTo(14.4, 2);
  });
});

describe("a paper that does not say its shape", () => {
  const built = planFromPaper({ dimensions: [dim(4), dim(3), dim(1.5)] });

  it("draws nothing rather than a room it invented", () => {
    expect(built.plan).toBeNull();
  });

  it("asks him in his words, naming the shapes he can pick", () => {
    expect(built.question).toContain(arNum(3));
    expect(built.question).toContain("مستطيل");
    expect(built.question).toContain("حرف L");
    // The question is shown to a customer: a machine key must never reach it.
    expect(built.question).not.toMatch(/rectangle|l-shape|shape|jsonb/);
  });
});

describe("a paper with no usable number on it", () => {
  it("says the plain truth instead of drawing an empty sheet", () => {
    const empty = planFromPaper({ dimensions: [] });
    expect(empty.plan).toBeNull();
    expect(empty.question).toContain("مقاس");

    const junk = planFromPaper({ dimensions: [{ label: "ضلع", meters: Number.NaN, confirmed: true }] });
    expect(junk.plan).toBeNull();
  });
});

describe("the shape the customer chose himself", () => {
  it("wins over what the side count suggested", () => {
    const built = planFromPaper({
      shape: "l-shape",
      dimensions: [dim(4), dim(2), dim(1.5), dim(1), dim(2.5), dim(3)],
    });
    expect(built.plan?.shape).toBe("l-shape");

    // Four numbers do not have to be a rectangle — he says the fifth wall is a niche.
    const told = planFromPaper({ shape: "u-shape", dimensions: [dim(4), dim(3), dim(4), dim(3)] });
    expect(told.plan).toBeNull();
    expect(told.question).toContain("حرف U");
  });

  it("carries the drawing the moment the shape is chosen", () => {
    // Measured on the stored papers: three of the four numbers on a sheet can be a room whose
    // fourth wall nobody wrote down. The chooser is what turns that into a drawing.
    const built = planFromPaper({ shape: "rectangle", dimensions: [dim(4), dim(3), dim(4), dim(3)] });
    expect(built.plan?.complete).toBe(true);
    expect(built.plan?.areaSqm).toBe(12);
  });
});
