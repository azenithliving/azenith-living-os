import { describe, it, expect } from "vitest";
import { buildPlan } from "@/lib/cad/plan";
import { arNum } from "@/lib/ops/metricLabels";

/**
 * The paper carries lengths, not places. This builder is the step that turns «٤٫٥ و ٣٫٢» into
 * a room a phone can draw: walls with coordinates, an area computed from the polygon rather
 * than guessed, and a verdict on whether the shape actually closes.
 *
 * Nothing here invents a measurement: a side that no witness agreed on stays indicative, and a
 * shape that does not close says so instead of being stretched to fit.
 */
const side = (meters: number, confirmed = true) => ({ meters, confirmed });

describe("a rectangle the customer agreed to", () => {
  const plan = buildPlan({
    shape: "rectangle",
    sides: [side(4.5), side(3.2), side(4.5), side(3.2)],
  });

  it("draws four walls that close", () => {
    expect(plan.walls).toHaveLength(4);
    expect(plan.walls.map((w) => w.meters)).toEqual([4.5, 3.2, 4.5, 3.2]);
    const last = plan.walls[3];
    expect([last.x2, last.y2]).toEqual([plan.walls[0].x1, plan.walls[0].y1]);
  });

  it("measures the area from the polygon, not from a mood", () => {
    expect(plan.areaSqm).toBeCloseTo(14.4, 2);
    expect(plan.complete).toBe(true);
    expect(plan.conflicts).toEqual([]);
  });

  it("keeps every wall it can vouch for", () => {
    expect(plan.walls.every((w) => w.confirmed)).toBe(true);
  });
});

describe("the openings the paper mentions", () => {
  const plan = buildPlan({
    shape: "rectangle",
    sides: [side(4.5), side(3.2), side(4.5), side(3.2)],
    openings: [{ kind: "door", widthMeters: 0.9 }],
  });

  it("puts an opening with no stated place on a wall it can fit on, at its middle", () => {
    expect(plan.openings).toHaveLength(1);
    const door = plan.openings[0];
    const wall = plan.walls[door.wallIndex];
    expect(wall.meters).toBeGreaterThanOrEqual(door.widthMeters ?? 0);
    expect(door.offsetMeters).toBeCloseTo((wall.meters - (door.widthMeters ?? 0)) / 2, 2);
  });

  it("keeps a place the customer moved it to", () => {
    const moved = buildPlan({
      shape: "rectangle",
      sides: [side(4.5), side(3.2), side(4.5), side(3.2)],
      openings: [{ kind: "window", widthMeters: 1.2, wallIndex: 1, offsetMeters: 0.4 }],
    });
    expect(moved.openings[0].wallIndex).toBe(1);
    expect(moved.openings[0].offsetMeters).toBe(0.4);
  });

  it("says so when an opening cannot fit any wall", () => {
    const wide = buildPlan({
      shape: "rectangle",
      sides: [side(2), side(1.5), side(2), side(1.5)],
      openings: [{ kind: "door", widthMeters: 3 }],
    });
    expect(wide.openings).toHaveLength(0);
    expect(wide.conflicts.join(" ")).toContain(arNum(3));
  });
});
describe("a template the store has never walked", () => {
  // The turn table knows two shapes. Walking a third with guessed turns would draw a room no
  // paper describes — and a customer can name a U-shaped place from the sheet — so the builder
  // has to stop and say which shape stopped it, in words he reads.
  const plan = buildPlan({
    shape: "u-shape",
    sides: [side(4), side(2), side(1), side(1), side(2), side(1), side(4)],
  });

  it("draws no walls instead of guessing the turns", () => {
    expect(plan.walls).toEqual([]);
    expect(plan.complete).toBe(false);
    expect(plan.areaSqm).toBeNull();
  });

  it("names the shape in his words, never its key", () => {
    const said = plan.conflicts.join(" ");
    expect(said).toContain("حرف U");
    expect(said).not.toContain("u-shape");
  });
});

describe("a paper with more sides than its template holds", () => {
  // Five numbers under a rectangle is not a room with five walls: one number belongs to a
  // niche the template never describes. Walking it anyway would silently invent the turn.
  const plan = buildPlan({ shape: "rectangle", sides: [side(4), side(3), side(4), side(3), side(1)] });

  it("refuses to walk the extra wall and counts it for the phone", () => {
    expect(plan.walls).toHaveLength(0);
    const said = plan.conflicts.join(" ");
    expect(said).toContain(arNum(5));
    expect(said).toContain(arNum(4));
  });
});
describe("two openings the paper did not place", () => {
  // A sheet that says «باب ٩٠ وشباك ١٤٠» and nothing else. Pinning both to the middle of the
  // longest wall stacks one inside the other, and on the phone the second handle sits on the
  // first — a thumb then drags the wrong thing. Measured live 2026-10-03.
  const plan = buildPlan({
    shape: "rectangle",
    sides: [side(4.5), side(3.2), side(4.5), side(3.2)],
    openings: [
      { kind: "door", widthMeters: 0.9 },
      { kind: "window", widthMeters: 1.4 },
    ],
  });

  it("gives each of them a stretch of wall nobody else is using", () => {
    expect(plan.openings).toHaveLength(2);
    const [a, b] = plan.openings;
    if (a.wallIndex === b.wallIndex) {
      const overlap = Math.min(a.offsetMeters + (a.widthMeters ?? 0), b.offsetMeters + (b.widthMeters ?? 0)) - Math.max(a.offsetMeters, b.offsetMeters);
      expect(overlap).toBeLessThanOrEqual(0);
    }
  });

  it("keeps both inside the walls they were put on", () => {
    for (const opening of plan.openings) {
      const wall = plan.walls[opening.wallIndex];
      expect(opening.offsetMeters).toBeGreaterThanOrEqual(0);
      expect(opening.offsetMeters + (opening.widthMeters ?? 0)).toBeLessThanOrEqual(wall.meters + 0.001);
    }
  });

  it("moves on to another wall when the long one is full", () => {
    const crowded = buildPlan({
      shape: "rectangle",
      sides: [side(4), side(3), side(4), side(3)],
      openings: [
        { kind: "door", widthMeters: 1.8 },
        { kind: "window", widthMeters: 1.8 },
        { kind: "window", widthMeters: 1.6 },
      ],
    });
    expect(crowded.openings).toHaveLength(3);
    expect(new Set(crowded.openings.map((o) => o.wallIndex)).size).toBeGreaterThan(1);
  });
});
describe("an L-shaped room", () => {
  // ٤ على الأرض، ٣ على اليسار، والزاوية الداخلية مقطوعة: ١٫٥ و ١. The plan must walk six walls
  // and find the notch area itself rather than multiplying two numbers.
  const plan = buildPlan({
    shape: "l-shape",
    sides: [side(4), side(2), side(1.5), side(1), side(2.5), side(3)],
  });

  it("walks six walls back to where it started", () => {
    expect(plan.walls).toHaveLength(6);
    expect(plan.complete).toBe(true);
    const last = plan.walls[5];
    expect([last.x2, last.y2]).toEqual([0, 0]);
  });

  it("measures the L, not the box it was cut from", () => {
    expect(plan.areaSqm).toBeCloseTo(10.5, 2);
  });
});
describe("a rectangle whose opposite walls disagree", () => {
  // ٤٫٥ opposite ٦: the room cannot be both. Averaging would draw a room nobody owns.
  const plan = buildPlan({
    shape: "rectangle",
    sides: [side(4.5), side(3.2), side(6), side(3.2)],
  });

  it("refuses to call it a closed room", () => {
    expect(plan.complete).toBe(false);
    expect(plan.areaSqm).toBeNull();
  });

  it("names the two numbers it cannot reconcile, in his digits", () => {
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]).toContain(arNum(4.5));
    expect(plan.conflicts[0]).toContain(arNum(6));
  });

  it("still draws what it was given", () => {
    expect(plan.walls).toHaveLength(4);
    expect(plan.walls[2].meters).toBe(6);
  });
});
