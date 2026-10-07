import { foldArabic, latinDigits } from "@/lib/arabic";

/**
 * The store's own sentence about its hours, turned into a schedule.
 *
 * The owner writes his hours as a sentence in the store's knowledge (`consultant_learnings`), and the
 * advisor quotes that sentence. The surfaces that must compute — «is the office open, and when does
 * it next open?» — had their own numbers instead, and drifted (measured 2026-10-07: the record says
 * nine to eight, the code said ten to six and closed a weekend this store does not have). This is the
 * one translation between the two, so the sentence is the owner and the arithmetic obeys it.
 *
 * It refuses rather than guesses: an unreadable or self-contradicting sentence returns null, and the
 * caller keeps its documented default rather than inventing an opening time.
 */
export type HoursSchedule = { openHour: number; closeHour: number; holidayDay: number | null };

/** Folded Arabic day names, so the lookup matches whatever spelling the owner typed. */
const DAY_NUMBERS: Array<[string, number]> = [
  ["السبت", 6],
  ["الاحد", 0],
  ["الاثنين", 1],
  ["الثلاثاء", 2],
  ["الاربعاء", 3],
  ["الخميس", 4],
  ["الجمعه", 5],
];

/** 12-hour Arabic speech: «٩ صباحا» is 9, «٦ مساء» is 18. */
function to24(hour: number, marker: string | undefined): number | null {
  if (hour < 1 || hour > 12) return null;
  if (/مساء|ليل/.test(marker ?? "")) return hour === 12 ? 12 : hour + 12;
  if (/صباح|ظهر/.test(marker ?? "")) return hour === 12 ? 12 : hour;
  return null;
}

export function parseHoursSentence(sentence: string | null | undefined): HoursSchedule | null {
  const text = latinDigits(foldArabic(String(sentence ?? "")));
  if (!text.trim()) return null;

  // Each number must carry its own half of the day: borrowing the other one's marker would turn
  // «من ٩ حتى ٦ مساء» into a store that opens at nine at night.
  const pairs = [...text.matchAll(/(\d{1,2})\s*(صباح|مساء|ليل|ظهر)/g)];
  if (pairs.length < 2) return null;

  const openHour = to24(Number(pairs[0][1]), pairs[0][2]);
  const closeHour = to24(Number(pairs[1][1]), pairs[1][2]);
  if (openHour === null || closeHour === null) return null;
  if (closeHour <= openHour) return null;

  const excludes = /عدا|باستثناء|غير/.test(text);
  const named = excludes ? DAY_NUMBERS.find(([name]) => text.includes(name)) : undefined;
  const holidayDay = named ? named[1] : null;

  return { openHour, closeHour, holidayDay };
}

/** What this schedule says, back in the owner's words — so a screen can name its source. */
export function describeSchedule(schedule: HoursSchedule): string {
  const day = schedule.holidayDay === null
    ? null
    : DAY_NUMBERS.find(([, number]) => number === schedule.holidayDay)?.[0];
  return `من ${schedule.openHour} إلى ${schedule.closeHour}${day ? `، ما عدا ${day}` : ""}`;
}
