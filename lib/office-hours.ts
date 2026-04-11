"use client";

/**
 * Azenith Office Hours Utility
 * Working Hours: 10 AM - 6 PM (Cairo Time)
 * Friday: Strict Holiday
 */

const OFFICE_CONFIG = {
  openHour: 10,
  closeHour: 18,
  fridayHoliday: true,
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
 * Check if today is Friday
 */
export function isFriday(date: Date = getCairoTime()): boolean {
  return date.getDay() === 5; // 5 = Friday
}

/**
 * Check if current time is within working hours
 */
export function isWithinWorkingHours(date: Date = getCairoTime()): boolean {
  const hour = date.getHours();
  return hour >= OFFICE_CONFIG.openHour && hour < OFFICE_CONFIG.closeHour;
}

/**
 * Get next working day opening time
 */
export function getNextOpenTime(fromDate: Date = getCairoTime()): Date {
  const nextOpen = new Date(fromDate);
  
  // If currently Friday or weekend, move to Saturday/Sunday
  const dayOfWeek = nextOpen.getDay();
  
  if (dayOfWeek === 5) {
    // Friday - next open is Saturday 10 AM
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
  } else if (dayOfWeek === 6) {
    // Saturday - next open is Sunday 10 AM
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
  } else if (dayOfWeek === 0) {
    // Sunday - next open is Monday 10 AM
    nextOpen.setDate(nextOpen.getDate() + 1);
    nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
  } else {
    // Weekday - check if before or after hours
    const currentHour = nextOpen.getHours();
    
    if (currentHour < OFFICE_CONFIG.openHour) {
      // Before opening - open today
      nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
    } else {
      // After closing - next day
      nextOpen.setDate(nextOpen.getDate() + 1);
      
      // If next day is Friday, skip to Saturday
      if (nextOpen.getDay() === 5) {
        nextOpen.setDate(nextOpen.getDate() + 1);
      }
      
      nextOpen.setHours(OFFICE_CONFIG.openHour, 0, 0, 0);
    }
  }
  
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
    message = `Our consultants are observing Friday. We will review your brief as a priority at 10 AM on ${daysUntil}.`;
  } else if (!isOpen) {
    status = "closed";
    if (now.getHours() < OFFICE_CONFIG.openHour) {
      const timeUntil = formatTimeUntil(timeUntilOpen);
      message = `Our consultants are currently preparing masterpieces. We open in ${timeUntil}.`;
    } else {
      const daysUntil = nextOpenDate.toLocaleDateString("en-US", { weekday: "long" });
      message = `Our consultants have concluded for the day. We will review your brief as a priority at 10 AM on ${daysUntil}.`;
    }
  } else {
    status = "open";
    const hoursRemaining = OFFICE_CONFIG.closeHour - now.getHours();
    message = `Our consultants are available until 6 PM Cairo time (${hoursRemaining} hour${hoursRemaining > 1 ? "s" : ""} remaining).`;
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
