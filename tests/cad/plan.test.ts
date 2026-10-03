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
