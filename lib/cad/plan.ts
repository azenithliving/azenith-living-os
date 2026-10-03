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
  /** How many numbers the paper itself carried. Two of them describe a whole rectangle. */
  sidesOnPaper: number;
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

/** What each template is called on a surface a person reads. A key never reaches the customer. */
export const SHAPE_LABELS: Record<PlanShape, string> = {
  rectangle: "مستطيل",
  "l-shape": "حرف L",
  "u-shape": "حرف U",
  open: "مكان مفتوح",
};

/** The templates that can be walked today — so this is also the only list a chooser may offer. */
export const DRAWABLE_SHAPES: PlanShape[] = ["rectangle", "l-shape"];

/**
 * The shape the count of a paper's sides points at.
 *
 * Two numbers are a room's length and width, and a rectangle's opposite walls are its own pair by
 * definition. Measured on the store's whole paper corpus (2026-10-03, nineteen papers): every one
 * holds either no number or exactly two — so a drawing that waited for four would never appear on
 * a real sheet. Four numbers are that same rectangle written wall by wall, six are the L. Three,
 * five or seven decide nothing: they ask rather than guess.
 */
export function shapeFromSideCount(count: number): PlanShape | null {
  if (count === 2 || count === 4) return "rectangle";
  if (count === 6) return "l-shape";
  return null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function buildPlan(input: { shape: PlanShape; sides: PlanSide[]; openings?: PlanOpeningInput[] }): Plan {
  const stated = Array.isArray(input.sides) ? input.sides : [];
  const turns = TURNS[input.shape];
  const walls: PlanWall[] = [];

  // A rectangle named by its length and width has its other two walls written in the same numbers:
  // that is the template, not a measurement nobody gave. Each implied wall carries the witness of
  // the number it repeats, so a proposed width stays proposed all the way round the room.
  const sides = input.shape === "rectangle" && stated.length === 2 ? [stated[0], stated[1], stated[0], stated[1]] : stated;

  // A template with no turn table, or a paper with more numbers than the template holds, is not a
  // drawing waiting for a guess: walking it anyway would invent the corner nobody wrote down.
  if (!turns || sides.length !== turns.length + 1) {
    const reason = !turns
      ? [`شكل «${SHAPE_LABELS[input.shape] ?? input.shape}» لسه مفيش طريقة مرسومة ليه — كلّمنا نحدد شكل المكان.`]
      : [`عدد الأضلاع مش مطابق: «${SHAPE_LABELS[input.shape]}» ب${arNum(turns.length + 1)} أضلاع والورقة فيها ${arNum(stated.length)} — ضلع زايد ولا الشكل غلط؟`];
    return {
      shape: input.shape,
      unit: "m",
      walls: [],
      sidesOnPaper: stated.length,
      // No wall to pin a door to. Saying the shape is the honest line; saying «the door is too
      // wide» would blame a measurement for a gap that is not about size.
      openings: [],
      areaSqm: null,
      complete: false,
      conflicts: reason,
    };
  }

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
    sidesOnPaper: stated.length,
    areaSqm: closes ? round(polygonArea(walls)) : null,
    complete: closes,
    openings,
    conflicts,
  };
}

/**
 * A door or a window has to sit on a wall, and two openings cannot share a stretch of one. When
 * the paper says only «باب ٩٠ سم» it goes on the longest wall that has room, at its middle; when
 * the customer has dragged it somewhere, that place is kept unless it lands inside another
 * opening, in which case it slides to the nearest free stretch. An opening wider than every wall
 * is not squeezed onto one — it is named, because the honest reading is that one of the two
 * numbers is wrong.
 */
function pinOpenings(inputs: PlanOpeningInput[] | undefined, walls: PlanWall[], conflicts: string[]): PlanOpening[] {
  const pinned: PlanOpening[] = [];
  const taken = new Map<number, Array<[number, number]>>();

  for (const opening of inputs ?? []) {
    const width = typeof opening.widthMeters === "number" && opening.widthMeters > 0 ? opening.widthMeters : null;
    const span = width ?? 0;
    const fits = (wall: PlanWall) => wall.meters + 0.001 >= span;

    const wanted = opening.offsetMeters;
    const candidates: number[] = [];
    if (typeof opening.wallIndex === "number" && fits(walls[opening.wallIndex] as PlanWall)) candidates.push(opening.wallIndex);
    walls
      .map((wall, index) => ({ wall, index }))
      .filter(({ wall }) => fits(wall))
      .sort((a, b) => b.wall.meters - a.wall.meters)
      .forEach(({ index }) => {
        if (!candidates.includes(index)) candidates.push(index);
      });

    let placed = false;
    for (const wallIndex of candidates) {
      const wall = walls[wallIndex];
      const offsetMeters = freeStart(wall.meters, span, wanted, taken.get(wallIndex) ?? []);
      if (offsetMeters === null) continue;
      const list = taken.get(wallIndex) ?? [];
      list.push([offsetMeters, offsetMeters + span]);
      taken.set(wallIndex, list);
      pinned.push({
        kind: opening.kind === "window" ? "window" : "door",
        wallIndex,
        offsetMeters,
        widthMeters: width,
      });
      placed = true;
      break;
    }
    if (!placed) {
      conflicts.push(`فتحة بعرض ${arNum(span)} متر ما لقتش ضلع يستوعبها — قياس الباب ولا الضلع محتاج تأكيد.`);
    }
  }
  return pinned;
}

/**
 * The place along a wall, nearest the one asked for, where an opening of this width fits without
 * lying on top of one already pinned. Null when the wall has no such stretch left.
 */
function freeStart(length: number, width: number, wanted: number | undefined, taken: Array<[number, number]>): number | null {
  const highest = Math.round((length - width) * 1000) / 1000;
  if (highest < -0.001) return null;
  const ceiling = Math.max(0, highest);
  const target = typeof wanted === "number" && Number.isFinite(wanted) ? Math.min(Math.max(wanted, 0), ceiling) : ceiling / 2;

  const blocked = taken
    .map(([start, end]) => [Math.max(0, start - width), Math.min(ceiling, end)] as [number, number])
    .filter(([from, to]) => to > 0 && from < ceiling)
    .sort((a, b) => a[0] - b[0]);

  let best: number | null = null;
  let bestGap = Infinity;
  let cursor = 0;
  const consider = (from: number, to: number) => {
    // A stretch of zero length is not a place to put anything: the blocked range around an
    // opening already includes the starts that would make it overlap.
    if (to - from < 0.001) return;
    const at = Math.min(Math.max(target, from), to);
    const gap = Math.abs(at - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = round(at);
    }
  };
  for (const [from, to] of blocked) {
    consider(cursor, Math.min(from, ceiling));
    cursor = Math.max(cursor, to);
  }
  consider(cursor, ceiling);
  return best;
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

/** What the store's record holds for one paper, before any of it becomes geometry. */
export type PaperShapeSource = PlanShape | null | undefined;
export type PaperDimension = { label?: string; meters: number | string; confirmed?: boolean };
export type PaperOpening = { kind: string; widthMeters: number | string | null; wallIndex?: number; offsetMeters?: number };

/**
 * The paper as stored → the drawing as stored, or the one question that has to be asked first.
 *
 * Three surfaces need this same step (the owner's upload, the customer's confirmation, the
 * customer's choice of shape), and a fourth would invent a fourth reading of «is this a room».
 * Numbers outside the range a room can hold are dropped rather than drawn, because a 450 m wall
 * is a mis-read pencil mark, and the sheet must not make it look intended.
 */
export function planFromPaper(paper: {
  dimensions: PaperDimension[] | null | undefined;
  openings?: PaperOpening[] | null;
  shape?: PaperShapeSource;
}): { plan: Plan | null; question: string | null } {
  const sides = (Array.isArray(paper.dimensions) ? paper.dimensions : [])
    .map((d) => ({ meters: Number(d?.meters), confirmed: Boolean(d?.confirmed) }))
    .filter((s) => Number.isFinite(s.meters) && s.meters > 0 && s.meters < 200);

  const shape = paper.shape ?? shapeFromSideCount(sides.length);
  if (!shape) {
    return {
      plan: null,
      question: sides.length
        ? `عدد الأضلاع ${arNum(sides.length)} ما بيقولش شكل المكان — اختار مستطيل ولا حرف L.`
        : "الورقة مفيهاش مقاس يتُرسم — اكتب مقاساتك تحت ونرسمها مع بعض.",
    };
  }

  const plan = buildPlan({
    shape,
    sides,
    openings: (Array.isArray(paper.openings) ? paper.openings : [])
      .filter((o) => o && (o.kind === "door" || o.kind === "window"))
      .map((o) => ({
        kind: o.kind as "door" | "window",
        widthMeters: Number.isFinite(Number(o.widthMeters)) && Number(o.widthMeters) > 0 ? Number(o.widthMeters) : null,
        wallIndex: Number.isInteger(o.wallIndex) ? o.wallIndex : undefined,
        offsetMeters: Number.isFinite(Number(o.offsetMeters)) ? Number(o.offsetMeters) : undefined,
      })),
  });

  // A refused template is a question, not a drawing. Storing zero walls as a plan would give the
  // next surface an empty box to paint.
  if (plan.walls.length === 0) return { plan: null, question: plan.conflicts[0] ?? null };
  return { plan, question: null };
}
