// @vitest-environment node
import { describe, it, expect } from "vitest";
import { roomNameAr } from "@/lib/rooms-catalog";
import { ALL_FURNITURE_SCOPES, TIMELINE_OPTIONS } from "@/lib/constants/furniture-data";
import { formatNextOpeningAr, type OfficeStatus } from "@/lib/office-hours";

/**
 * The qualification form's Arabic layer, measured without a browser.
 *
 * The form took a `language` prop and never read it, so every scope chip, budget line and button
 * reached an Arabic customer in English. The labels now come from one room-naming module and from
 * `labelAr` on the store's own timeline options — these tests fail the day either grows a member
 * without its Arabic half, which is how the defect was born in the first place.
 */
describe("the elite form's Arabic layer", () => {
  it("names every scope the form offers", () => {
    expect(ALL_FURNITURE_SCOPES.length).toBeGreaterThan(5);
    const nameless = ALL_FURNITURE_SCOPES.filter((scope) => !roomNameAr(scope));
    expect(nameless, `بلا اسم عربي: ${nameless.join(", ")}`).toEqual([]);
  });

  it("keeps the Arabic name free of Latin letters, and the unknown one silent", () => {
    expect(roomNameAr("Living Room")).toMatch(/[\u0600-\u06FF]/);
    expect(roomNameAr("Living Room")).not.toMatch(/[A-Za-z]/);
    expect(roomNameAr("Nothing We Have Ever Sold")).toBe("");
    expect(roomNameAr(null)).toBe("");
  });

  it("carries an Arabic answer for every timeline the form offers", () => {
    expect(TIMELINE_OPTIONS.length).toBeGreaterThan(2);
    const nameless = TIMELINE_OPTIONS.filter((option) => !option.labelAr).map((o) => o.value);
    expect(nameless, `بلا تسمية عربية: ${nameless.join(", ")}`).toEqual([]);
    for (const option of TIMELINE_OPTIONS) expect(option.labelAr).not.toMatch(/[A-Za-z]/);
  });

  it("tells the next opening in his words and his digits", () => {
    const status = {
      isOpen: false,
      status: "closed",
      message: "",
      nextOpenDate: new Date(2026, 9, 12, 10, 0, 0),
      timeUntilOpen: 0,
    } satisfies OfficeStatus;
    const line = formatNextOpeningAr(status);
    expect(line).toContain("الساعة");
    expect(line).toMatch(/[\u0660-\u0669]/);
    expect(line).not.toMatch(/[A-Za-z]/);
  });
});
