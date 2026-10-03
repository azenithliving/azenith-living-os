/**
 * palette.ts — the colour matrix a customer's sheet offers, and the ranking his picks drive.
 *
 * The bank stores one measured colour per picture (`metadata.avg_color`), and the whole bank was
 * read before this file was written (2026-10-03, 5,909 pictures with a colour): grey 36%, warm
 * beige 23%, wood 13%, off-white 12%, dark wood and caramel 4% each, blue and green about 1% each.
 * The families below are that distribution named in words a person uses, with the thresholds the
 * measurement needed to reproduce it — not a mood board invented in a meeting.
 *
 * Two rules keep the surface honest: a family is only ever offered when one of the room's own
 * pictures carries it, and the swatch shown is a colour stored on a real picture, never a computed
 * average that no photograph holds.
 */

export type PaletteFamily =
  | "grey"
  | "warmBeige"
  | "wood"
  | "offWhite"
  | "darkWood"
  | "caramel"
  | "matteWhite"
  | "terracotta"
  | "charcoal"
  | "green"
  | "blue"
  | "other";

/** The bank's own order — the most of the bank first, so a sheet reads like the shop. */
export const FAMILY_ORDER: PaletteFamily[] = [
  "grey",
  "warmBeige",
  "wood",
  "offWhite",
  "darkWood",
  "caramel",
  "matteWhite",
  "terracotta",
  "charcoal",
  "green",
  "blue",
  "other",
];

export const FAMILY_LABELS: Record<PaletteFamily, string> = {
  grey: "رمادي",
  warmBeige: "بيج دافئ",
  wood: "بني خشبي",
  offWhite: "أوف وايت",
  darkWood: "بني غامق",
  caramel: "كاراميل",
  matteWhite: "أبيض مطفي",
  terracotta: "توبي",
  charcoal: "فحمي",
  green: "أخضر",
  blue: "أزرق",
  other: "لون تاني",
};

/**
 * How far (in 0-255 red-green-blue) a picture may sit from his pick and still be «قريب».
 *
 * Measured on the bank's own sheets (2026-10-03): inside one colour family the pictures sit 0-35
 * apart, a different family in the same room starts around 45 and runs past 100. Forty is the line
 * the data draws, not a comfortable round number — at 75 a grey pick lit up eighteen of twenty
 * pictures, which says nothing to anybody.
 */
const NEAR_DISTANCE = 40;

export type Rgb = { r: number; g: number; b: number };

/** `#A7937D` or `A7937D` → numbers. Anything else is not a colour the bank stored. */
export function hexToRgb(hex: string | null | undefined): Rgb | null {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(String(hex ?? "").trim());
  if (!match) return null;
  return { r: parseInt(match[1]!, 16), g: parseInt(match[2]!, 16), b: parseInt(match[3]!, 16) };
}

function lightness(rgb: Rgb): number {
  return (Math.max(rgb.r, rgb.g, rgb.b) + Math.min(rgb.r, rgb.g, rgb.b)) / 2 / 255;
}

/** How much colour is in it at all — the difference between a warm grey and a wood. */
function chroma(rgb: Rgb): number {
  return (Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)) / 255;
}

function hue(rgb: Rgb): number {
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  const span = max - min;
  if (!span) return 0;
  const raw =
    max === rgb.r ? ((rgb.g - rgb.b) / span) % 6 : max === rgb.g ? (rgb.b - rgb.r) / span + 2 : (rgb.r - rgb.g) / span + 4;
  return (raw * 60 + 360) % 360;
}

/** The family a stored colour belongs to, by the thresholds the bank's distribution needed. */
export function familyOf(hex: string | null | undefined): PaletteFamily | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const l = lightness(rgb);
  const c = chroma(rgb);
  const h = hue(rgb);

  if (c < 0.1) return l > 0.75 ? "matteWhite" : l < 0.28 ? "charcoal" : "grey";
  if (l > 0.62 && h >= 15 && h <= 50) return "offWhite";
  if (h >= 15 && h <= 45) {
    if (l < 0.3) return "darkWood";
    if (l < 0.45) return "wood";
    return c < 0.2 ? "warmBeige" : "caramel";
  }
  if (h < 15 || h >= 330) return "terracotta";
  if (h >= 60 && h <= 150) return "green";
  if (h > 150 && h < 260) return "blue";
  return "other";
}

export type PaletteEntry = { family: PaletteFamily; label: string; hex: string; count: number };

/**
 * The matrix for one sheet: the colour families his own pictures actually carry, with the picture
 * colour that best stands for each. Families with no picture in this room are not shown at all —
 * offering «أزرق» to a room whose pictures hold none would be a promise the bank cannot keep.
 */
export function paletteFor(images: Array<{ color: string | null }>): PaletteEntry[] {
  const groups = new Map<PaletteFamily, string[]>();
  for (const image of images) {
    const family = familyOf(image.color);
    if (!family || !image.color) continue;
    const list = groups.get(family) ?? [];
    list.push(image.color);
    groups.set(family, list);
  }

  const entries: PaletteEntry[] = [];
  for (const family of FAMILY_ORDER) {
    const hexes = groups.get(family);
    if (!hexes?.length) continue;
    entries.push({ family, label: FAMILY_LABELS[family], hex: closestToMean(hexes), count: hexes.length });
  }
  return entries;
}

/** The stored colour nearest the group's average — a real swatch, never a made-up one. */
function closestToMean(hexes: string[]): string {
  const rgbList = hexes.map((hex) => hexToRgb(hex)).filter((v): v is Rgb => v !== null);
  if (!rgbList.length) return hexes[0]!;
  const mean = {
    r: rgbList.reduce((sum, c) => sum + c.r, 0) / rgbList.length,
    g: rgbList.reduce((sum, c) => sum + c.g, 0) / rgbList.length,
    b: rgbList.reduce((sum, c) => sum + c.b, 0) / rgbList.length,
  };
  let best = hexes[0]!;
  let bestGap = Infinity;
  hexes.forEach((hex, index) => {
    const rgb = rgbList[index];
    if (!rgb) return;
    const gap = Math.hypot(rgb.r - mean.r, rgb.g - mean.g, rgb.b - mean.b);
    if (gap < bestGap) {
      bestGap = gap;
      best = hex;
    }
  });
  return best;
}

/**
 * His pictures, closest to his chosen colours first. A picture with no stored colour is not
 * ranked as if it matched — it goes to the end, because nothing about it was measured.
 */
export function rankByPicks<T extends { color: string | null }>(images: T[], picks: string[]): Array<T & { near: boolean }> {
  const wanted = picks.map((hex) => hexToRgb(hex)).filter((v): v is Rgb => v !== null);
  if (!wanted.length) return images.map((image) => ({ ...image, near: false }));

  return images
    .map((image) => {
      const rgb = hexToRgb(image.color);
      const distance = rgb ? Math.min(...wanted.map((c) => Math.hypot(c.r - rgb.r, c.g - rgb.g, c.b - rgb.b))) : Infinity;
      return { image, distance, near: distance <= NEAR_DISTANCE };
    })
    .sort((a, b) => a.distance - b.distance)
    .map(({ image, near }) => ({ ...image, near }));
}
