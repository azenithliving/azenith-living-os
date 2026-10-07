// @vitest-environment node
import { describe, it, expect } from "vitest";
import { phoneForms } from "@/lib/customers/identity";
import { rollLineLabel } from "@/lib/customers/match";

/**
 * The mobile number as this owner uses it: what he reads must be what he dials.
 *
 * Measured on the pre-call file 2026-10-07: the headline printed «١٠٩٩٩٩٩١» — the store's internal
 * key, missing the leading zero — and the call button was built as `tel:+20` + whatever the row
 * held, so a lead stored as «01005554444» would have dialled +2001005554444. Both shapes come from
 * one rule now, and a number that is not an Egyptian mobile yields nothing rather than a dead button.
 */
const AR = (digits: string) => digits.replace(/[0-9]/g, (d) => String.fromCodePoint(0x0660 + Number(d)));

describe("a mobile number in the shapes he actually uses", () => {
  it("reads the same number however the table spelled it", () => {
    const wanted = { display: "01099999991", dial: "+201099999991", whatsapp: "201099999991" };
    for (const raw of ["01099999991", "1099999991", "+20 109 999 9991", "0020 109 999 9991", "tel: +20 109 999 9991"]) {
      expect(phoneForms(raw), raw).toEqual(wanted);
    }
  });

  it("says nothing instead of offering a dead button", () => {
    expect(phoneForms("12345")).toBeNull();
    expect(phoneForms("")).toBeNull();
    expect(phoneForms(null)).toBeNull();
    expect(phoneForms("0109999999")).toBeNull(); // nine digits is not a mobile
    expect(phoneForms("30123456789")).toBeNull(); // not this country's numbering
  });

  it("labels a customer with no name by the number he can dial", () => {
    expect(rollLineLabel({ key: "phone:1099999991", name: null, phone: "1099999991" })).toBe(AR("01099999991"));
    expect(rollLineLabel({ key: "phone:1099999991", name: null, phone: "01099999991" })).toBe(AR("01099999991"));
  });

  it("keeps showing only the last four when there is a name to recognise him by", () => {
    const label = rollLineLabel({ key: "phone:1099999991", name: "علي سيد", phone: "1099999991" });
    expect(label).toContain("علي سيد");
    expect(label).toContain(AR("9991"));
    expect(label).not.toContain(AR("1099999991"));
  });
});
