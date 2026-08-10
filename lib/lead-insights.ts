/**
 * Lead interest analysis helpers.
 *
 * Translates raw telemetry tags (often English image alts / slugs) into Arabic,
 * dedupes and ranks them, and infers a likely interior-design style preference.
 */

const TRANSLATIONS: Array<{ re: RegExp; ar: string }> = [
  // Room types
  { re: /\bliving\s*room\b/gi, ar: "غرفة معيشة" },
  { re: /\bbedroom\b/gi, ar: "غرفة نوم" },
  { re: /\bmaster\s*bedroom\b/gi, ar: "غرفة النوم الرئيسية" },
  { re: /\bkids?\s*(bed)?room\b/gi, ar: "غرفة أطفال" },
  { re: /\bkitchen\b/gi, ar: "مطبخ" },
  { re: /\bbathroom\b/gi, ar: "حمام" },
  { re: /\bdining\s*room\b/gi, ar: "غرفة سفرة" },
  { re: /\boffice\b/gi, ar: "مكتب" },
  { re: /\bstudy\b/gi, ar: "مكتبة/دراسة" },
  { re: /\blounge\b/gi, ar: "لونج" },
  { re: /\bbalcony\b/gi, ar: "بلكونة" },
  { re: /\bhall\b/gi, ar: "بهو/ريسبشن" },
  { re: /\bcorridor\b/gi, ar: "ممر" },
  { re: /\binterior\s*design\b/gi, ar: "تصميم داخلي" },
  // Styles
  { re: /\bmodern\b/gi, ar: "مودرن" },
  { re: /\bclassic\b/gi, ar: "كلاسيك" },
  { re: /\bcontemporary\b/gi, ar: "كونتمبوراري" },
  { re: /\bminimalist\b/gi, ar: "مينيمال" },
  { re: /\bminimal\b/gi, ar: "مينيمال" },
  { re: /\bindustrial\b/gi, ar: "إندستريال" },
  { re: /\bscandinavian\b/gi, ar: "اسكندنافي" },
  { re: /\bneoclassical\b/gi, ar: "نيوكلاسيك" },
  { re: /\bart\s*deco\b/gi, ar: "آرت ديكو" },
  { re: /\bmoroccan\b/gi, ar: "مغربي" },
  { re: /\bbohemian\b/gi, ar: "بوهيمي" },
  { re: /\bjapandi\b/gi, ar: "جاباندي" },
  { re: /\bmid[- ]?century\b/gi, ar: "ميد سنشري" },
  { re: /\bfarmhouse\b/gi, ar: "فارمهاوس" },
  { re: /\bcoastal\b/gi, ar: "كوستال" },
  { re: /\btraditional\b/gi, ar: "تقليدي" },
  { re: /\bneoclassic\b/gi, ar: "نيوكلاسيك" },
  { re: /\bcontemporary\b/gi, ar: "كونتمبوراري" },
  { re: /\beclectic\b/gi, ar: "إكليكتيك" },
  { re: /\btransitional\b/gi, ar: "ترانزشنال" },
  { re: /\bmidcentury\b/gi, ar: "ميد سنشري" },
  // Furniture / finishes
  { re: /\bsofa\b/gi, ar: "كنب" },
  { re: /\bsectional\b/gi, ar: "كنب موديولار" },
  { re: /\bwardrobe\b/gi, ar: "غرفة ملابس/دولاب" },
  { re: /\bdresser\b/gi, ar: "كومود" },
  { re: /\bdining\s*table\b/gi, ar: "ترابيزة سفرة" },
  { re: /\bconsole\b/gi, ar: "كونسول" },
  { re: /\bcoffee\s*table\b/gi, ar: "ترابيزة وسط" },
  { re: /\bbed\b/gi, ar: "سرير" },
  { re: /\bchair\b/gi, ar: "كرسي" },
  { re: /\bTV\s*unit\b/gi, ar: "وحدة تلفزيون" },
  { re: /\bcabinets?\b/gi, ar: "خزائن" },
  { re: /\bkitchen\s*island\b/gi, ar: "جزيرة مطبخ" },
  { re: /\bmarble\b/gi, ar: "رخام" },
  { re: /\bwood\b/gi, ar: "خشب" },
  { re: /\bgold\b/gi, ar: "ذهبي" },
  { re: /\bvelvet\b/gi, ar: "مخمل" },
];

const STYLE_HINTS = [
  "كلاسيك", "مودرن", "نيوكلاسيك", "مينيمال", "إندستريال", "اسكندنافي",
  "مغربي", "بوهيمي", "آرت ديكو", "جاباندي", "ميد سنشري", "فارمهاوس", "كوستال",
];

/** Translate a single raw telemetry tag into Arabic. */
export function translateTag(raw: string): string {
  let out = raw || "";
  for (const { re, ar } of TRANSLATIONS) {
    out = out.replace(re, ar);
  }
  // Clean leftovers like file names, digits-only tokens.
  out = out
    .replace(/\b(style|room|design|image|photo|gallery)\b/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out || "عنصر";
}

/** Dedupe preserving order of first appearance (most relevant = most recently hovered). */
export function dedupeTags(tags: string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags || []) {
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

export interface InterestSummary {
  /** Top items, most significant first (most recently hovered). */
  top: string[];
  /** All translated items (deduped). */
  all: string[];
  /** Inferred style, or null. */
  styleGuess: string | null;
}

/**
 * Build a ranked, Arabic, human-readable interest summary from raw telemetry tags.
 * Raw tags appear in first-seen order; the newest hover is the strongest signal,
 * so we reverse for display (most recent = most interesting).
 */
export function summarizeInterest(rawTags: string[] | null | undefined): InterestSummary {
  const deduped = dedupeTags(rawTags);
  const translated = deduped.map(translateTag);
  // Most recent hover is the strongest signal → reverse order for ranking.
  const ranked = [...translated].reverse();
  const top = ranked.slice(0, 3);

  const styleCounts = new Map<string, number>();
  for (const t of translated) {
    for (const s of STYLE_HINTS) {
      if (t.includes(s)) {
        styleCounts.set(s, (styleCounts.get(s) || 0) + 1);
      }
    }
  }
  const styleGuess = styleCounts.size > 0
    ? [...styleCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;

  return { top, all: translated, styleGuess };
}
