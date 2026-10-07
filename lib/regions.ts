/**
 * regions.ts — the areas this store works in, held once, in the customer's own words.
 *
 * Measured 2026-10-07: the store's advisor carried its coverage as one prose sentence inside a
 * reply builder, while the customer's sheet asked for «منطقتك» in a free-text box that nothing
 * read. So the same fact had two owners and neither could answer «what does a customer in زايد
 * actually pick?». This file is the one owner: the areas as data, the words a customer uses for
 * them, and the sentence that says — with its evidence count printed — which taste a ranking is
 * standing on.
 *
 * The brake that shapes it: an area taste is never invented. A ranking may claim «ذوق منطقتك» only
 * while real papers from that area carry real picks; with nothing measured the line says so and the
 * pictures fall back to the bank's own quality order.
 */
import { arabicAny, arabicNumerals, foldArabic } from "@/lib/arabic";
import { FAMILY_LABELS, familyOf, type PaletteFamily } from "@/lib/cad/palette";

export type AreaGroup = { group: string; areas: string[] };

/** The store's shipped coverage, opened into the areas it names. */
export const AREA_GROUPS: AreaGroup[] = [
  {
    group: "القاهرة الكبرى",
    areas: ["التجمع", "الرحاب", "مدينتي", "الشروق", "مدينة نصر", "مصر الجديدة", "المعادي", "الزمالك"],
  },
  { group: "الجيزة", areas: ["الشيخ زايد", "أكتوبر", "الهرم", "المهندسين"] },
  { group: "الساحل والسخنة", areas: ["الساحل الشمالي", "العين السخنة"] },
  { group: "الإسكندرية", areas: ["الإسكندرية"] },
];

/**
 * The short forms a customer actually writes, keyed by the area name the store records.
 * «التجمع» and «زايد» are this store's own words — the sheet already invites him with
 * «زي التجمع أو زايد أو الإسكندرية» — so the aliases come from what he is offered, not from a map.
 */
const AREA_ALIASES: Record<string, string[]> = {
  التجمع: ["التجمع", "التجمع الخامس", "القاهرة الجديدة"],
  الرحاب: ["الرحاب"],
  مدينتي: ["مدينتي"],
  الشروق: ["الشروق"],
  "مدينة نصر": ["مدينة نصر"],
  "مصر الجديدة": ["مصر الجديدة", "مصر الجديده"],
  المعادي: ["المعادي"],
  الزمالك: ["الزمالك"],
  "الشيخ زايد": ["الشيخ زايد", "زايد"],
  أكتوبر: ["أكتوبر", "حدائق أكتوبر"],
  الهرم: ["الهرم"],
  المهندسين: ["المهندسين"],
  "الساحل الشمالي": ["الساحل", "الساحل الشمالي"],
  "العين السخنة": ["العين السخنة", "السخنة"],
  الإسكندرية: ["الإسكندرية", "اسكندرية", "السكندرية"],
};

/** What the customer is offered before he types a single letter, in his reading order. */
export const AREA_CHIPS: string[] = [
  "التجمع",
  "الرحاب",
  "مدينتي",
  "الشروق",
  "مدينة نصر",
  "مصر الجديدة",
  "المعادي",
  "الشيخ زايد",
  "أكتوبر",
  "الإسكندرية",
  "الساحل الشمالي",
];

/** The coverage sentence the advisor speaks, built from the areas above so the two cannot drift. */
export function coverageSentence(): string {
  return AREA_GROUPS.map((g) => (g.areas.length > 1 ? `${g.group} (${g.areas.join(" و")})` : g.areas.join(" و"))).join("، ");
}

const AREA_MATCHERS: [string, RegExp][] = Object.entries(AREA_ALIASES).map(
  ([area, words]) => [area, arabicAny(...words.map(foldArabic))] as [string, RegExp],
);

/**
 * His words → the area the store records, or null when he named something off the map.
 *
 * A null is not a refusal: his own spelling is still worth keeping in the record, and forcing a
 * pick would invent an area he never said.
 */
export function normalizeArea(raw: unknown): string | null {
  const text = foldArabic(String(raw ?? ""));
  if (!text) return null;
  for (const [area, matcher] of AREA_MATCHERS) if (matcher.test(text)) return area;
  return null;
}

/** The area to store: the map's spelling when his words reach it, his own words when they don't. */
export function areaLabel(raw: unknown): string {
  const value = String(raw ?? "").trim();
  return normalizeArea(value) ?? value;
}

export type TasteSource = "own" | "area" | "quality" | "unreadable";

export type AreaEvidence = {
  /** The area the ranking was measured for, in the store's spelling. */
  area: string | null;
  /** How many of his area's papers carry a real colour pick — himself excluded. */
  papers: number;
  /** The colours his area's customers actually chose, most-chosen first, capped to three. */
  hexes: string[];
  /** Those same colours named in words a person reads, because a `#` code is not his language. */
  colours: string[];
};

/** One row of the papers table, as far as this file needs it. */
export type AreaPaper = {
  id: number | string | null;
  city?: string | null;
  picks?: { hex?: string | null }[] | null;
};

/**
 * The taste of one area, counted from its customers' own colour picks.
 *
 * `ownId` is dropped because a customer cannot be his own area's evidence: a sheet that ranked
 * itself would say «ذوق منطقتك» while the only paper in the area is the one being ranked.
 */
export function tasteOfArea(
  papers: AreaPaper[],
  area: string | null,
  ownId?: number | string | null,
): AreaEvidence {
  if (!area) return { area: null, papers: 0, hexes: [], colours: [] };
  const counts = new Map<string, number>();
  let holders = 0;
  for (const paper of papers) {
    if (ownId != null && paper.id != null && String(paper.id) === String(ownId)) continue;
    if (normalizeArea(paper.city ?? "") !== area) continue;
    const colours = (paper.picks ?? [])
      .map((pick) => String(pick?.hex ?? "").trim())
      .filter((hex) => /^#?[\da-f]{6}$/i.test(hex));
    if (!colours.length) continue;
    holders++;
    for (const hex of colours) {
      const key = hex.startsWith("#") ? hex : `#${hex}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const hexes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([hex]) => hex);
  // Each colour is named by the family the bank itself files it under, so the customer reads
  // «رمادي» and not a code he cannot say out loud.
  const seen = new Set<PaletteFamily>();
  const colours: string[] = [];
  for (const hex of hexes) {
    const family = familyOf(hex);
    if (!family || seen.has(family)) continue;
    seen.add(family);
    colours.push(FAMILY_LABELS[family]);
  }
  return { area, papers: holders, hexes, colours };
}

/** The count in the shape Arabic pluralises it, so one paper is not announced as «١ ورقات». */
function papersPhrase(count: number): string {
  if (count === 1) return "من ورقة عميل واحد";
  if (count === 2) return "من ورقتين لعميلين";
  return `من ${arabicNumerals(count)} ورقات عملاء`;
}

/**
 * What the customer is told the ranking is standing on — including when it stands on nothing.
 *
 * Four tiers, named out loud: his own picks beat his area's taste, his area's taste beats the
 * bank's quality order, an area with no measured papers says so instead of dressing a quality list
 * up as a personal one, and a record that did not answer admits that rather than calling the area
 * empty when it may be full. The evidence count is printed with the claim, so a taste measured from
 * one neighbour reads like the thin thing it is.
 */
export function tasteLine(source: TasteSource, evidence: AreaEvidence): string {
  if (source === "own") return "الصور المرتّبة دي على اللي إنت اختارته من ألوان، مش على ذوق منطقة.";
  if (source === "area") {
    const colours = evidence.colours.length ? `، وألوانها ${evidence.colours.join(" و")}` : "";
    return `دي على ذوق ${evidence.area}: محسوب ${papersPhrase(evidence.papers)} في منطقتك${colours}.`;
  }
  if (source === "unreadable") return "السجل ما ردّش دلوقتي — الصور المرتّبة دي على جودتها، ومحكّتهاش على منطقتك.";
  return evidence.area
    ? `لسه مفيش ورق مسجّل لمنطقة ${evidence.area} — الصور المرتّبة دي على جودتها، مش على ذوق منطقتك.`
    : "لسه ما عرفت منطقتك — الصور المرتّبة دي على جودتها. اختارها فوق والاقتراحات تبقى أقربلك.";
}
