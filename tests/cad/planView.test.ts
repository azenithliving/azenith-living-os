import { describe, expect, it } from "vitest";

import { buildPlan, type Plan, type PlanSide } from "@/lib/cad/plan";
import {
  clampOpening,
  openingSpan,
  planBounds,
  planViewBox,
  pointerToMetres,
  projectPointerOnWall,
} from "@/lib/cad/plan-view";

/**
 * A phone draws in pixels going down; a room is measured in metres going up. This is the only
 * place those two are reconciled, so the sheet component can be about fingers and nothing else —
 * and so the owner's desk and the customer's page cannot each invent their own flip.
 */
const side = (meters: number, confirmed = true): PlanSide => ({ meters, confirmed });

const rectangle = (): Plan =>
  buildPlan({ shape: "rectangle", sides: [side(4.5), side(3.2), side(4.5), side(3.2)], openings: [{ kind: "door", widthMeters: 0.9 }] });

describe("the room's own frame", () => {
  it("measures the box the walls live in, in metres", () => {
    expect(planBounds(rectangle().walls)).toEqual({ minX: 0, minY: 0, maxX: 4.5, maxY: 3.2 });
  });

  it("gives the sheet a view box that fits with a margin, flipped so north is up", () => {
    const box = planViewBox(rectangle().walls, 0.4)!.split(" ").map(Number);
    expect(box[0]).toBeCloseTo(-0.4, 5);
    // SVG's y grows downward: the top of the view box is the room's highest wall.
    expect(box[1]).toBeCloseTo(-3.6, 5);
    expect(box[2]).toBeCloseTo(5.3, 5);
    expect(box[3]).toBeCloseTo(4.0, 5);
  });

  it("does not offer an empty frame for a room that was never walked", () => {
    expect(planViewBox([], 0.4)).toBeNull();
  });
});

describe("a door along its wall", () => {
  const plan = rectangle();
  const wall = plan.walls[0];

  it("starts where the wall starts and runs its own width along it", () => {
    const span = openingSpan(wall, { wallIndex: 0, offsetMeters: 1, kind: "door", widthMeters: 0.9 });
    expect(span).toEqual({ x1: 1, y1: 0, x2: 1.9, y2: 0 });
  });

  it("runs up a vertical wall too", () => {
    const up = plan.walls[1];
    const span = openingSpan(up, { wallIndex: 1, offsetMeters: 0.5, kind: "window", widthMeters: 1.2 });
    expect(span).toEqual({ x1: 4.5, y1: 0.5, x2: 4.5, y2: 1.7 });
  });

  it("keeps a thumb inside the wall it is dragging along", () => {
    expect(clampOpening(wall, 0.9, -0.3)).toBe(0);
    expect(clampOpening(wall, 0.9, 4.4)).toBe(3.6);
    expect(clampOpening(wall, null, 9)).toBe(4.5);
    expect(clampOpening(wall, 0.9, 2)).toBe(2);
  });

  it("projects a finger pressed anywhere near a wall onto that wall", () => {
    // Along the ground wall, with the finger a centimetre off the line and the jitter a thumb gives.
    expect(projectPointerOnWall(wall, { x: 3.2, y: -0.12 }).offsetMeters).toBeCloseTo(3.2, 5);
    // Past the end of the wall the finger still belongs to the wall — clamped, not lost.
    expect(projectPointerOnWall(wall, { x: 99, y: 0 }).offsetMeters).toBe(4.5);
    // A wall running the other way is measured from its own start, not from the screen edge.
    const back = plan.walls[2];
    expect(projectPointerOnWall(back, { x: 1, y: 3.2 }).offsetMeters).toBeCloseTo(3.5, 5);
  });

  it("holds the door's width inside the wall when the room is smaller than the opening", () => {
    const small = buildPlan({ shape: "rectangle", sides: [side(2), side(1.5), side(2), side(1.5)] });
    expect(clampOpening(small.walls[0], 0.9, 1.6)).toBe(1.1);
  });
});

describe("a finger on the glass read back as a metre in the room", () => {
  // The sheet is drawn in a viewBox with north up; the phone reports pixels with y downward.
  // Round trip: a point the renderer would put at ٢٫٦ on the ground wall has to come back as ٢٫٦.
  const box = planViewBox(rectangle().walls, 0.45)!; // "-0.45 -3.65 5.4 4.1"
  const laid = { left: 0, top: 0, width: 540, height: 410 };

  it("undoes the flip and the scale", () => {
    expect(pointerToMetres(box, laid, { x: 305, y: 365 })).toEqual({ x: 2.6, y: 0 });
  });

  it("subtracts the letterbox when the sheet is wider than the room", () => {
    expect(pointerToMetres(box, { ...laid, height: 820 }, { x: 305, y: 570 })).toEqual({ x: 2.6, y: 0 });
  });

  it("refuses a sheet that has not been laid out, instead of sending the door to the origin", () => {
    expect(pointerToMetres(box, { left: 0, top: 0, width: 0, height: 0 }, { x: 12, y: 40 })).toBeNull();
    expect(pointerToMetres(null, laid, { x: 12, y: 40 })).toBeNull();
  });

  it("lands the drag on the wall it started from", () => {
    const wall = rectangle().walls[0];
    const metres = pointerToMetres(box, laid, { x: 305, y: 365 })!;
    expect(projectPointerOnWall(wall, metres, 0.9).offsetMeters).toBeCloseTo(2.6, 5);
  });
});
