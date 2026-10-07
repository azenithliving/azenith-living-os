"use client";

import { arabicNumerals } from "@/lib/arabic";

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
 * The one day this store does not work.
 */
export function isFriday(date: Date = getCairoTime()): boolean {
  return date.getDay() === OFFICE_CONFIG.holidayDay; // 5 = Friday
}

/**
 * Check if current time is within working hours
 */
export function isWithinWorkingHours(date: Date = getCairoTime()): boolean {
  const hour = date.getHours();
  return hour >= OFFICE_CONFIG.openHour && hour < OFFICE_CONFIG.closeHour;
}

/**
 * The next moment the store opens: today when that hour is still ahead, otherwise the next
 * working day. Every day works — Friday is the only one this store closes.
 */
export function getNextOpenTime(fromDate: Date = getCairoTime()): Date {
  const nextOpen = new Date(fromDate);

  if (isFriday(nextOpen)) {
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
    return nextOpen;
  }

  if (nextOpen.getHours() < OFFICE_CONFIG.openHour) {
    nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
    return nextOpen;
  }

  nextOpen.setDate(nextOpen.getDate() + 1);
  if (isFriday(nextOpen)) nextOpen.setDate(nextOpen.getDate() + 1);
  nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
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
function openHourLabel(): string {
  return clockLabel(OFFICE_CONFIG.openHour);
}

/** The hour the store closes, in the words its own sentences quote. */
function closeHourLabel(): string {
  return clockLabel(OFFICE_CONFIG.closeHour);
}

function clockLabel(hour24: number): string {
  const clock = ((hour24 + 11) % 12) + 1;
  return `${clock} ${hour24 < 12 ? "AM" : "PM"}`;
}

export function getOfficeStatus(): OfficeStatus {
  const now = getCairoTime();
  const isHoliday = isFriday(now);
  const isOpen = !isHoliday && isWithinWorkingHours(now);
  
  const nextOpenDate = getNextOpenTime(now);
  const timeUntilOpen = nextOpenDate.getTime() - now.getTime();
  
  let message: string;
  let status: OfficeStatus["status"];
  
  if (isHoliday) {
    status = "holiday";
    const daysUntil = nextOpenDate.getDay() === 6 ? "Saturday" : 
                      nextOpenDate.getDay() === 0 ? "Sunday" : "Monday";
    message = `Our consultants are observing Friday. We will review your brief as a priority at ${openHourLabel()} on ${daysUntil}.`;
  } else if (!isOpen) {
    status = "closed";
    if (now.getHours() < OFFICE_CONFIG.openHour) {
      const timeUntil = formatTimeUntil(timeUntilOpen);
      message = `Our consultants are currently preparing masterpieces. We open in ${timeUntil}.`;
    } else {
      const daysUntil = nextOpenDate.toLocaleDateString("en-US", { weekday: "long" });
      message = `Our consultants have concluded for the day. We will review your brief as a priority at ${openHourLabel()} on ${daysUntil}.`;
    }
  } else {
    status = "open";
    const hoursRemaining = OFFICE_CONFIG.closeHour - now.getHours();
    message = `Our consultants are available until ${closeHourLabel()} Cairo time (${hoursRemaining} hour${hoursRemaining > 1 ? "s" : ""} remaining).`;
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
export function useOfficeStatus(): OfficeStatus {
  if (typeof window === "undefined") {
    return getOfficeStatus();
  }
  
  // For SSR compatibility, return initial status
  return getOfficeStatus();
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
