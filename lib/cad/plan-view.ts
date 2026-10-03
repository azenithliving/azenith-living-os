/**
 * plan-view.ts — the room's metres turned into something a screen can paint and a thumb can move.
 *
 * A plan is measured in metres with north up; an SVG is measured in user units with y growing
 * downward. Only this module reconciles the two, so the customer's sheet and the owner's desk
 * cannot each invent their own flip and show the same room facing different ways.
 *
 * Nothing here decides a measurement. A dragged opening is clamped to the wall it sits on — that
 * is geometry, not a new number — and the store's own builder re-walks the room before any of it
 * is kept.
 */

import type { PlanOpening, PlanWall } from "./plan";

export type Point = { x: number; y: number };

/** The metre box the walls occupy. */
export function planBounds(walls: PlanWall[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (!walls.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const wall of walls) {
    for (const x of [wall.x1, wall.x2]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
    for (const y of [wall.y1, wall.y2]) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * The SVG `viewBox` for a room, with a margin so labels and a finger have somewhere to go. The y
 * axis is flipped here and nowhere else: the returned box's top edge is the room's highest wall.
 */
export function planViewBox(walls: PlanWall[] | null | undefined, pad = 0.4): string | null {
  const bounds = planBounds(walls ?? []);
  if (!bounds) return null;
  const width = bounds.maxX - bounds.minX + pad * 2;
  const height = bounds.maxY - bounds.minY + pad * 2;
  const x = bounds.minX - pad;
  const y = -(bounds.maxY + pad);
  return `${round(x)} ${round(y)} ${round(width)} ${round(height)}`;
}

/** Metres (north up) → user units (y down). Every draw call goes through this. */
export function toScreenY(metersY: number): number {
  return -metersY;
}

/** Where an opening sits along its wall, in the room's own metres. */
export function openingSpan(
  wall: PlanWall,
  opening: Pick<PlanOpening, "offsetMeters" | "widthMeters"> & { wallIndex?: number; kind?: string }
): { x1: number; y1: number; x2: number; y2: number } {
  const length = wall.meters > 0 ? wall.meters : 0;
  const width = typeof opening.widthMeters === "number" && opening.widthMeters > 0 ? opening.widthMeters : 0;
  const start = clamp(opening.offsetMeters, 0, length);
  const end = clamp(start + width, 0, length);
  const ux = length > 0 ? (wall.x2 - wall.x1) / length : 0;
  const uy = length > 0 ? (wall.y2 - wall.y1) / length : 0;
  return {
    x1: round(wall.x1 + ux * start),
    y1: round(wall.y1 + uy * start),
    x2: round(wall.x1 + ux * end),
    y2: round(wall.y1 + uy * end),
  };
}

/** The furthest along its wall an opening of this width can be put. */
export function clampOpening(wall: PlanWall, widthMeters: number | null, offsetMeters: number): number {
  const width = typeof widthMeters === "number" && widthMeters > 0 ? widthMeters : 0;
  const room = Math.max(0, wall.meters - width);
  return round(clamp(offsetMeters, 0, room));
}

/**
 * A finger's position, read as a place along a wall.
 *
 * The projection is the dot product on the wall's own direction, so a wall running west measures
 * from its western end, and a thumb a centimetre off the line still lands on it. The result is
 * clamped to the wall: a drag that leaves the sheet does not put a door in the corridor.
 */
export function projectPointerOnWall(wall: PlanWall, point: Point, widthMeters: number | null = null): { offsetMeters: number } {
  const length = wall.meters > 0 ? wall.meters : 0;
  const ux = length > 0 ? (wall.x2 - wall.x1) / length : 0;
  const uy = length > 0 ? (wall.y2 - wall.y1) / length : 0;
  const along = (point.x - wall.x1) * ux + (point.y - wall.y1) * uy;
  return { offsetMeters: clampOpening(wall, widthMeters, along) };
}

/**
 * A finger on the glass → the metre it is pointing at.
 *
 * The drawing keeps its proportions and centres itself in its element, so it can be letterboxed
 * inside the box it was given. Both are undone here — the tighter scale wins, the letterbox is
 * subtracted, and the y flip this module owns is reversed. A zero-sized element (a sheet that has
 * not been laid out yet) answers with null rather than a place in the room.
 */
export function pointerToMetres(
  viewBox: string | null | undefined,
  rect: { left: number; top: number; width: number; height: number },
  client: Point
): Point | null {
  const parts = String(viewBox ?? "")
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (parts.length !== 4 || !rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const [x, y, width, height] = parts;
  if (!(width > 0) || !(height > 0)) return null;
  const scale = Math.min(rect.width / width, rect.height / height);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  const offsetX = (rect.width - width * scale) / 2;
  const offsetY = (rect.height - height * scale) / 2;
  const at = { x: round(x + (client.x - rect.left - offsetX) / scale), y: round(-(y + (client.y - rect.top - offsetY) / scale)) };
  if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return null;
  // A point exactly on the ground wall must not come back as «-0»: the sheet writes it, and a
  // negative zero in a coordinate is the kind of thing a later comparison trips over.
  return { x: at.x === 0 ? 0 : at.x, y: at.y === 0 ? 0 : at.y };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
