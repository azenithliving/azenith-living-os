// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  isFriday,
  isWithinWorkingHours,
  getNextOpenTime,
  formatNextOpeningAr,
  type OfficeStatus,
} from "@/lib/office-hours";
import { parseHoursSentence } from "@/lib/hours-sentence";

/**
 * The owner's ordered hours, pinned: every day from 9 in the morning to 8 at night, Friday closed.
 *
 * Measured 2026-10-07 that this module said 10 to 6 and closed Saturday and Sunday too — a weekend
 * this store does not have — while the advisor was already quoting the owner's own row correctly.
 * A customer who asked «what time do you open?» on the qualification form got a different store
 * than the one who asked in chat. These are the numbers the sentences are built from now.
 */
const at = (year: number, month: number, day: number, hour: number) => new Date(year, month - 1, day, hour, 0, 0);
// Read off a calendar, not assumed: 2026-10-08 is a Thursday, so 9 is Friday and 10 is Saturday.
const THURSDAY = at(2026, 10, 8, 12);
const FRIDAY = at(2026, 10, 9, 12);
const SATURDAY = at(2026, 10, 10, 12);
const SUNDAY = at(2026, 10, 11, 12);

describe("the store's working hours as the owner ordered them", () => {
  it("opens at nine and closes at eight", () => {
    expect(THURSDAY.getDay()).toBe(4);
    expect(FRIDAY.getDay()).toBe(5);
    expect(isWithinWorkingHours(at(2026, 10, 8, 9))).toBe(true);
    expect(isWithinWorkingHours(at(2026, 10, 8, 8))).toBe(false);
    expect(isWithinWorkingHours(at(2026, 10, 8, 19))).toBe(true);
    expect(isWithinWorkingHours(at(2026, 10, 8, 20))).toBe(false);
  });

  it("closes Friday and only Friday", () => {
    expect(isFriday(FRIDAY)).toBe(true);
    expect(isFriday(SATURDAY)).toBe(false);
    expect(isFriday(SUNDAY)).toBe(false);
    // `isWithinWorkingHours` is the hour window only; the day is the other half of the answer,
    // and the status composes them — as it does here, so a Friday noon is not "open".
    const open = (d: Date) => !isFriday(d) && isWithinWorkingHours(d);
    expect(open(FRIDAY)).toBe(false);
    // The old code closed the whole weekend; this store works it.
    expect(open(SATURDAY)).toBe(true);
    expect(open(SUNDAY)).toBe(true);
  });

  it("points at the next real opening, skipping only Friday", () => {
    const beforeNine = getNextOpenTime(at(2026, 10, 8, 7));
    expect(beforeNine.getDate()).toBe(8);
    expect(beforeNine.getHours()).toBe(9);

    const thursdayNight = getNextOpenTime(at(2026, 10, 8, 21));
    expect(thursdayNight.getDay()).toBe(6); // Saturday, because Friday is closed
    expect(thursdayNight.getHours()).toBe(9);

    const fridayNoon = getNextOpenTime(FRIDAY);
    expect(fridayNoon.getDay()).toBe(6);
    expect(fridayNoon.getHours()).toBe(9);

    const saturdayMorning = getNextOpenTime(at(2026, 10, 10, 6));
    expect(saturdayMorning.getDate()).toBe(10);
    expect(saturdayMorning.getHours()).toBe(9);
  });

  it("tells the opening hour in his digits, and it is nine", () => {
    const status = {
      isOpen: false,
      status: "closed",
      message: "",
      nextOpenDate: at(2026, 10, 10, 9),
      timeUntilOpen: 0,
    } satisfies OfficeStatus;
    const line = formatNextOpeningAr(status);
    expect(line).toContain(`الساعة ${String.fromCodePoint(0x0660 + 9)}`);
    expect(line).toContain("صباحاً");
    expect(line).not.toMatch(/[A-Za-z]/);
  });

  it("lets the store's own record drive the arithmetic", () => {
    // Same moment, two sentences: the answer must follow the record, not the constant in this file.
    const tenToSix = parseHoursSentence("مواعيد العمل: كل أيام الأسبوع من ١٠ صباحًا حتى ٦ مساءً، ما عدا الجمعة.");
    const nineToEight = parseHoursSentence("مواعيد العمل: كل أيام الأسبوع من ٩ صباحًا حتى ٨ مساءً، ما عدا الجمعة.");
    expect(tenToSix).not.toBeNull();
    expect(nineToEight).not.toBeNull();

    const earlyMorning = at(2026, 10, 8, 9); // a Thursday at nine
    expect(isWithinWorkingHours(earlyMorning, nineToEight)).toBe(true);
    expect(isWithinWorkingHours(earlyMorning, tenToSix)).toBe(false);
    expect(isWithinWorkingHours(earlyMorning)).toBe(true); // no record → the ordered default

    const lateEvening = at(2026, 10, 8, 19);
    expect(isWithinWorkingHours(lateEvening, nineToEight)).toBe(true);
    expect(isWithinWorkingHours(lateEvening, tenToSix)).toBe(false);

    // A record that closes Saturday moves the next opening; the default does not know that day.
    const saturdayClosed = parseHoursSentence("من ٩ صباحًا حتى ٨ مساءً، ما عدا السبت.");
    const saturdayDawn = at(2026, 10, 10, 6); // before the store opens, so the answer is the same day
    expect(getNextOpenTime(saturdayDawn, saturdayClosed).getDay()).toBe(0); // Sunday
    expect(getNextOpenTime(saturdayDawn, saturdayClosed).getHours()).toBe(9);
    expect(getNextOpenTime(saturdayDawn).getDay()).toBe(6); // Saturday is a working day by default
    expect(getNextOpenTime(saturdayDawn).getHours()).toBe(9);

    // While the store is standing open, «the next opening» means tomorrow — both readings agree.
    expect(getNextOpenTime(at(2026, 10, 10, 12)).getDay()).toBe(0);
    expect(getNextOpenTime(at(2026, 10, 10, 12)).getHours()).toBe(9);
  });
});
