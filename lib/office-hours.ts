"use client";

import { arabicNumerals } from "@/lib/arabic";
import { parseHoursSentence, type HoursSchedule } from "@/lib/hours-sentence";
/**
 * When the store is open, for the surfaces that must say it out loud (the qualification form and
 * the elite page).
 *
 * The owner's ordered fact: every day 9 AM to 8 PM Cairo, Friday closed. Measured 2026-10-07 this
 * module said 10 to 6 AND treated Saturday and Sunday as closed — a weekend this store does not
 * have — while the advisor was already answering the same question correctly from the row the
 * owner wrote in `consultant_learnings`. One fact, two owners, and the newer surface read the
 * wrong one. The numbers are now stated once here and every sentence is built from them; the row
 * remains the record the advisor quotes.
 */

const OFFICE_CONFIG = {
  openHour: 9,
  closeHour: 20,
  /** 5 = Friday, the only day this store does not work. */
  holidayDay: 5,
  timezone: "Africa/Cairo",
};

/**
 * The schedule a caller was given by the store's own record. Every function here takes it as an
 * optional last argument and falls back to `OFFICE_CONFIG` when the record is silent — a page that
 * could not read the row still has to say something, and it says the ordered default.
 * It is the same shape the sentence parser produces, so one type owns it.
 */
export type OfficeHours = HoursSchedule;

const resolveHours = (override?: OfficeHours | null): Required<OfficeHours> => ({
  openHour: override?.openHour ?? OFFICE_CONFIG.openHour,
  closeHour: override?.closeHour ?? OFFICE_CONFIG.closeHour,
  holidayDay: override && override.holidayDay !== undefined ? override.holidayDay : OFFICE_CONFIG.holidayDay,
});

export type OfficeStatus = {
  isOpen: boolean;
  status: "open" | "closed" | "holiday";
  message: string;
  nextOpenDate: Date;
  timeUntilOpen: number; // milliseconds
};

/**
 * Get current time in Cairo timezone
 */
export function getCairoTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: OFFICE_CONFIG.timezone }));
}

/**
 * The day the store does not work — Friday unless the record names another.
 */
export function isClosedDay(date: Date = getCairoTime(), override?: OfficeHours | null): boolean {
  return date.getDay() === resolveHours(override).holidayDay;
}

/** Kept because callers and guards speak of it by name. */
export function isFriday(date: Date = getCairoTime(), override?: OfficeHours | null): boolean {
  return isClosedDay(date, override);
}

/**
 * Is this moment inside the working window?
 */
export function isWithinWorkingHours(date: Date = getCairoTime(), override?: OfficeHours | null): boolean {
  const { openHour, closeHour } = resolveHours(override);
  const hour = date.getHours();
  return hour >= openHour && hour < closeHour;
}

/**
 * The next moment the store opens: today when that hour is still ahead, otherwise the next
 * working day. Every day works except the one the record closes — Friday by default.
 */
export function getNextOpenTime(fromDate: Date = getCairoTime(), override?: OfficeHours | null): Date {
  const { openHour } = resolveHours(override);
  const nextOpen = new Date(fromDate);

  if (isClosedDay(nextOpen, override)) {
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(openHour, 0, 0, 0);
    return nextOpen;
  }

  if (nextOpen.getHours() < openHour) {
    nextOpen.setHours(openHour, 0, 0, 0);
    return nextOpen;
  }

  nextOpen.setDate(nextOpen.getDate() + 1);
  if (isClosedDay(nextOpen, override)) nextOpen.setDate(nextOpen.getDate() + 1);
  nextOpen.setHours(openHour, 0, 0, 0);
  return nextOpen;
}

/**
 * Format time until opening
 */
export function formatTimeUntil(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} min`;
  }
  return `${minutes} minutes`;
}

/**
 * Get full office status with message
 */

/** The hour the store opens, in the words its own sentences quote. */
function clockLabel(hour24: number): string {
  const clock = ((hour24 + 11) % 12) + 1;
  return `${clock} ${hour24 < 12 ? "AM" : "PM"}`;
}

const DAY_NAMES_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function getOfficeStatus(override?: OfficeHours | null): OfficeStatus {
  const { openHour, closeHour, holidayDay } = resolveHours(override);
  const now = getCairoTime();
  const isHoliday = holidayDay !== null && now.getDay() === holidayDay;
  const isOpen = !isHoliday && isWithinWorkingHours(now, override);

  const nextOpenDate = getNextOpenTime(now, override);
  const timeUntilOpen = nextOpenDate.getTime() - now.getTime();
  const nextDay = DAY_NAMES_EN[nextOpenDate.getDay()] ?? "the next working day";

  let message: string;
  let status: OfficeStatus["status"];

  if (isHoliday) {
    status = "holiday";
    message = `Our consultants are observing ${DAY_NAMES_EN[holidayDay ?? 5]}. We will review your brief as a priority at ${clockLabel(openHour)} on ${nextDay}.`;
  } else if (!isOpen) {
    status = "closed";
    if (now.getHours() < openHour) {
      const timeUntil = formatTimeUntil(timeUntilOpen);
      message = `Our consultants are currently preparing masterpieces. We open in ${timeUntil}.`;
    } else {
      message = `Our consultants have concluded for the day. We will review your brief as a priority at ${clockLabel(openHour)} on ${nextDay}.`;
    }
  } else {
    status = "open";
    const hoursRemaining = closeHour - now.getHours();
    message = `Our consultants are available until ${clockLabel(closeHour)} Cairo time (${hoursRemaining} hour${hoursRemaining > 1 ? "s" : ""} remaining).`;
  }

  return {
    isOpen,
    status,
    message,
    nextOpenDate,
    timeUntilOpen,
  };
}

/**
 * React hook for real-time office status
 */
export function useOfficeStatus(override?: OfficeHours | null): OfficeStatus {
  return getOfficeStatus(override);
}

/**
 * The schedule as the store's own record states it, read once by a surface that has to compute one.
 *
 * Null is an honest answer, not a failure to handle: no row, an unreadable door, or a sentence this
 * parser refuses to guess at, and the caller keeps the ordered default. The reason is logged, because
 * a silent null is how two owners of one fact disagree without anyone noticing.
 */
export async function fetchRecordedHours(): Promise<OfficeHours | null> {
  try {
    const res = await fetch("/api/cms/public-config", { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[OfficeHours] الباب رد بـ ${res.status} — بفضّل للرقم المأمور`);
      return null;
    }
    const body = (await res.json()) as { config?: { workingHours?: string | null } | null };
    const sentence = body?.config?.workingHours;
    const parsed = parseHoursSentence(sentence);
    if (!parsed) console.warn("[OfficeHours] سطر المواعيد مقروءش أو مش مفهوم — بفضّل للرقم المأمور");
    return parsed;
  } catch (err) {
    console.warn("[OfficeHours] الميعاد المسجل مقروءش:", String(err).slice(0, 80));
    return null;
  }
}

/**
 * Format next opening time for display
 */
export function formatNextOpening(status: OfficeStatus): string {
  const { nextOpenDate } = status;
  const now = getCairoTime();
  const isToday = now.toDateString() === nextOpenDate.toDateString();
  const isTomorrow = new Date(now.setDate(now.getDate() + 1)).toDateString() === nextOpenDate.toDateString();
  
  if (isToday) {
    return `Today at ${nextOpenDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  } else if (isTomorrow) {
    return `Tomorrow at ${nextOpenDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  } else {
    return `${nextOpenDate.toLocaleDateString("en-US", { weekday: "long" })} at ${nextOpenDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;
  }
}

const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/**
 * The same sentence in the customer's words, with his digits: «النهاردة الساعة ١٠ صباحاً».
 *
 * The office opens on the hour, so a minute is only printed when the store itself has one — a
 * trailing «:٠٠» on an Arabic screen is a machine habit, not information.
 */
export function formatNextOpeningAr(status: OfficeStatus): string {
  const { nextOpenDate } = status;
  const now = getCairoTime();
  const isToday = now.toDateString() === nextOpenDate.toDateString();
  const isTomorrow = new Date(now.setDate(now.getDate() + 1)).toDateString() === nextOpenDate.toDateString();
  const when = isToday ? "النهاردة" : isTomorrow ? "بكرة" : `يوم ${DAY_NAMES_AR[nextOpenDate.getDay()]}`;
  const hour24 = nextOpenDate.getHours();
  const clock = ((hour24 + 11) % 12) + 1;
  const half = hour24 < 12 ? "صباحاً" : "مساءً";
  const minutes = nextOpenDate.getMinutes();
  const clockText = minutes
    ? `${arabicNumerals(clock)}:${arabicNumerals(String(minutes).padStart(2, "0"))}`
    : arabicNumerals(clock);
  return `${when} الساعة ${clockText} ${half}`;
}
