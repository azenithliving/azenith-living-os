/**
 * plan.ts — the room the paper describes, as geometry.
 *
 * The paper holds lengths; a drawing needs places. This module walks a chosen template with the
 * numbers the store has, and reports what it could close, what it could not, and what must be
 * asked on the phone. It never smooths a disagreement away: two opposite walls that do not match
 * are both kept, each marked with whatever vouched for it.
 */

import { arNum } from "../ops/metricLabels";

export type PlanShape = "rectangle" | "l-shape" | "u-shape" | "open";

export type PlanSide = { meters: number; confirmed: boolean };

export type PlanWall = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  meters: number;
  confirmed: boolean;
};

export type Plan = {
  shape: PlanShape;
  unit: "m";
  walls: PlanWall[];
  /** Doors and windows, each pinned to the wall it sits on and how far along it. */
  openings: PlanOpening[];
  /** Square metres from the polygon itself, or null when the shape does not close. */
  areaSqm: number | null;
  complete: boolean;
  /** What the phone call has to settle, in one line each. */
  conflicts: string[];
};

export type PlanOpening = {
  kind: "door" | "window";
  wallIndex: number;
  offsetMeters: number;
  widthMeters: number | null;
};

export type PlanOpeningInput = {
  kind: "door" | "window";
  widthMeters: number | null;
  wallIndex?: number;
  offsetMeters?: number;
};


/**
 * How each template turns between its walls: 1 turns left, -1 turns right. The walk starts
 * facing east from the room's own origin, so the first wall is always the one on the ground.
 * A shape is only drawn when its turns are known — an invented turn table would draw a room
 * that no template describes.
 */
const TURNS: Partial<Record<PlanShape, number[]>> = {
  rectangle: [1, 1, 1],
  // ٤ along the ground, up the right side, across, up the notch, across again, down the left.
  "l-shape": [1, 1, -1, 1, 1],
};

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildPlan(input: { shape: PlanShape; sides: PlanSide[]; openings?: PlanOpeningInput[] }): Plan {
  const sides = Array.isArray(input.sides) ? input.sides : [];
  const turns = TURNS[input.shape] ?? [];
  const walls: PlanWall[] = [];
  let x = 0;
  let y = 0;
  let heading: [number, number] = [1, 0];

  sides.forEach((side, index) => {
    if (index > 0) {
      const turn = turns[index - 1] ?? 1;
      heading = turn === 1 ? [-heading[1], heading[0]] : [heading[1], -heading[0]];
    }
    const nx = round(x + heading[0] * side.meters);
    const ny = round(y + heading[1] * side.meters);
    walls.push({ x1: round(x), y1: round(y), x2: nx, y2: ny, meters: side.meters, confirmed: side.confirmed });
    x = nx;
    y = ny;
  });

  const closes = walls.length > 2 && Math.abs(x) < 0.001 && Math.abs(y) < 0.001;
  const conflicts = oppositeDisagreements(input.shape, sides);
  const openings = pinOpenings(input.openings, walls, conflicts);
  return {
    shape: input.shape,
    unit: "m",
    walls,
    areaSqm: closes ? round(polygonArea(walls)) : null,
    complete: closes,
    openings,
    conflicts,
  };
}

/**
 * A door or a window has to sit on a wall. When the paper says only «باب ٩٠ سم» it goes on the
 * longest wall that can hold it, centred; when the customer has dragged it somewhere, that place
 * is kept. An opening wider than every wall is not squeezed onto one — it is named, because the
 * honest reading is that one of the two numbers is wrong.
 */
function pinOpenings(inputs: PlanOpeningInput[] | undefined, walls: PlanWall[], conflicts: string[]): PlanOpening[] {
  const pinned: PlanOpening[] = [];
  for (const opening of inputs ?? []) {
    const width = typeof opening.widthMeters === "number" && opening.widthMeters > 0 ? opening.widthMeters : null;
    const fits = (wall: PlanWall) => width === null || wall.meters + 0.001 >= width;

    let wallIndex =
      typeof opening.wallIndex === "number" && walls[opening.wallIndex] && fits(walls[opening.wallIndex]) ? opening.wallIndex : -1;
    if (wallIndex < 0) {
      walls.forEach((wall, index) => {
        if (fits(wall) && (wallIndex < 0 || wall.meters > walls[wallIndex].meters)) wallIndex = index;
      });
    }
    if (wallIndex < 0) {
      conflicts.push(`فتحة بعرض ${arNum(width ?? 0)} متر ما لقتش ضلع يستوعبها — قياس الباب ولا الضلع محتاج تأكيد.`);
      continue;
    }

    const wall = walls[wallIndex];
    const wanted = opening.offsetMeters;
    const staysOnWall =
      typeof wanted === "number" && wanted >= 0 && width !== null && wanted + width <= wall.meters + 0.001;
    pinned.push({
      kind: opening.kind === "window" ? "window" : "door",
      wallIndex,
      offsetMeters: staysOnWall ? round(wanted) : round(Math.max(0, (wall.meters - (width ?? 0)) / 2)),
      widthMeters: width,
    });
  }
  return pinned;
}

/** How far two opposite walls may differ before the room has to be asked about it. */
const OPPOSITE_TOLERANCE = 0.05;

/**
 * A four-sided room has its opposite walls in pairs. When a pair disagrees there is no honest
 * drawing to make — the average is a room nobody owns — so the disagreement is written down for
 * the phone call and the plan stays unclosed.
 */
function oppositeDisagreements(shape: PlanShape, sides: PlanSide[]): string[] {
  if (shape !== "rectangle" || sides.length !== 4) return [];
  const found: string[] = [];
  for (const [a, b] of [[0, 2], [1, 3]] as const) {
    if (Math.abs(sides[a].meters - sides[b].meters) > OPPOSITE_TOLERANCE) {
      found.push(`الضلع ومقابله مش متساويين: ${arNum(sides[a].meters)} مقابل ${arNum(sides[b].meters)} — أيهما صح؟`);
    }
  }
  return found;
}

/** The shoelace formula over the walked vertices — the area of what was actually drawn. */
function polygonArea(walls: PlanWall[]): number {
  let sum = 0;
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    const b = walls[(i + 1) % walls.length];
    sum += a.x1 * b.y1 - b.x1 * a.y1;
  }
  return Math.abs(sum) / 2;
}
