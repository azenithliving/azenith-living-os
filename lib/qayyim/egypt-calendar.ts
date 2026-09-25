/**
 * موسمية الدار — the commercial calendar the swarm plans against.
 *
 * Hijri anchors (رمضان / عيد الفطر / عيد الأضحى) for Gregorian 2026–2030 were
 * resolved with Node's built-in ICU `islamic-umalqura` calendar and every date
 * was then re-checked one by one against api.aladhan.com `gToH` on 2026-09-25 —
 * all sixteen agreed, so they are recorded here as data instead of being
 * recomputed at runtime (no new dependency, no network on the request path).
 *
 * Two honest caveats, both deliberate:
 *  • Egyptian public holidays follow local moon sighting and can shift one day
 *    either way; these windows are retail-planning windows, not legal dates.
 *  • `summer` and `schools` are fixed commercial conventions (June heat /
 *    wedding season, then back-to-school), NOT Ministry-of-Education dates,
 *    which are announced year by year and cannot be known for 2029–2030.
 *
 * Windows never overlap, so `currentSeason` has at most one answer.
 * Comparison is on the UTC calendar day (ISO dates sort lexicographically).
 */

export type SeasonKey = "ramadan" | "eid_fitr" | "eid_adha" | "summer" | "schools";

export interface Season {
  key: SeasonKey;
  name: string;
  /** inclusive, YYYY-MM-DD */
  start: string;
  /** inclusive, YYYY-MM-DD */
  end: string;
  origin: "hijri" | "commercial";
}

const SEASON_NAMES: Record<SeasonKey, string> = {
  ramadan: "رمضان",
  eid_fitr: "عيد الفطر",
  eid_adha: "عيد الأضحى",
  summer: "موسم الصيف",
  schools: "موسم المدارس",
};

const hijri = (key: SeasonKey, start: string, end: string): Season => ({ key, name: SEASON_NAMES[key], start, end, origin: "hijri" });
const commercial = (key: SeasonKey, year: number): Season => ({
  key,
  name: SEASON_NAMES[key],
  start: `${year}-${key === "summer" ? "06-01" : "08-15"}`,
  end: `${year}-${key === "summer" ? "08-14" : "10-15"}`,
  origin: "commercial",
});

/** Sorted ascending by start — `nextSeason` relies on this order. */
export const SEASONS: Season[] = [
  hijri("ramadan", "2026-02-18", "2026-03-19"),
  hijri("eid_fitr", "2026-03-20", "2026-03-22"),
  hijri("eid_adha", "2026-05-27", "2026-05-30"),
  commercial("summer", 2026),
  commercial("schools", 2026),
  hijri("ramadan", "2027-02-08", "2027-03-08"),
  hijri("eid_fitr", "2027-03-09", "2027-03-11"),
  hijri("eid_adha", "2027-05-16", "2027-05-19"),
  commercial("summer", 2027),
  commercial("schools", 2027),
  hijri("ramadan", "2028-01-28", "2028-02-25"),
  hijri("eid_fitr", "2028-02-26", "2028-02-28"),
  hijri("eid_adha", "2028-05-05", "2028-05-08"),
  commercial("summer", 2028),
  commercial("schools", 2028),
  hijri("ramadan", "2029-01-16", "2029-02-13"),
  hijri("eid_fitr", "2029-02-14", "2029-02-16"),
  hijri("eid_adha", "2029-04-24", "2029-04-27"),
  commercial("summer", 2029),
  commercial("schools", 2029),
  hijri("ramadan", "2030-01-05", "2030-02-03"),
  hijri("eid_fitr", "2030-02-04", "2030-02-06"),
  hijri("eid_adha", "2030-04-13", "2030-04-16"),
  commercial("summer", 2030),
  commercial("schools", 2030),
  // Ramadan returns inside the same Gregorian year (1 Ramadan 1452).
  hijri("ramadan", "2030-12-26", "2031-01-23"),
];

const dayOf = (date: Date | string): string =>
  typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);

export function seasonLabel(key: SeasonKey): string {
  return SEASON_NAMES[key];
}

export function currentSeason(date: Date | string = new Date()): Season | undefined {
  const day = dayOf(date);
  return SEASONS.find((s) => s.start <= day && day <= s.end);
}

export function nextSeason(from: Date | string = new Date()): Season | undefined {
  const day = dayOf(from);
  return SEASONS.find((s) => s.start > day);
}
