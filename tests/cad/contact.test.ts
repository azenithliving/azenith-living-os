import { describe, it, expect } from "vitest";
import { cleanCity, offerLine, planClaim } from "@/lib/cad/contact";

/**
 * The contact moment decides two things at once: what the store learns about a stranger, and
 * what it may promise him. Both are cheap to get wrong — a half-typed number becomes a
 * phantom customer in the roll, and a copy line that says «cut to your measurements» over a
 * picture bank that holds no measurements is the exact lie this store banned.
 */
const EMPTY = { customer_key: null, customer_city: null, room: null };

describe("the claim decides what may be written", () => {
  it("takes a real mobile, in his digits or mine", () => {
    const western = planClaim({ phone: "0100 123 4567" }, EMPTY);
    expect(western.refusal).toBe(null);
    // The roll's own key shape: national digits without the trunk 0 (`lib/customers/identity`).
    expect(western.write.customer_key).toBe("phone:1001234567");

    const arabic = planClaim({ phone: "٠١٠٠١٢٣٤٥٦٧" }, EMPTY);
    expect(arabic.write.customer_key).toBe(western.write.customer_key);
  });

  it("refuses a number that is not an Egyptian mobile, in words he reads", () => {
    for (const bad of ["", null, undefined, "12345", "021234567", "abcdefgh"]) {
      const claim = planClaim({ phone: bad, city: "التجمع" }, EMPTY);
      expect(claim.refusal, String(bad)).toBe("الرقم ده مش موبايل مصري. سيبه فاضي لو مش عايز تسيب رقم.");
      expect(claim.write).toEqual({});
    }
  });

  it("never lets a second phone steal a claimed paper", () => {
    const owned = { ...EMPTY, customer_key: "phone:01000000000" };
    const claim = planClaim({ phone: "01001234567", city: "زايد" }, owned);
    expect(claim.refusal).toBe(null);
    expect(claim.write.customer_key).toBeUndefined();
    // «زايد» is his short form; the record keeps the store's own spelling so the two are one area.
    expect(claim.write.customer_city).toBe("الشيخ زايد");
  });

  it("lets a claimed paper add its area without repeating the number", () => {
    const owned = { ...EMPTY, customer_key: "phone:1001234567" };
    const claim = planClaim({ city: "الشيخ زايد" }, owned);
    expect(claim.refusal).toBe(null);
    expect(claim.write).toEqual({ customer_city: "الشيخ زايد" });
  });

  it("writes an area only when the paper has none", () => {
    expect(planClaim({ phone: "01001234567", city: "الإسكندرية" }, EMPTY).write.customer_city).toBe("الإسكندرية");
    const known = { ...EMPTY, customer_city: "القاهرة" };
    expect(planClaim({ phone: "01001234567", city: "الإسكندرية" }, known).write.customer_city).toBeUndefined();
  });

  it("keeps the room the reader already wrote over the one he names later", () => {
    const named = planClaim({ phone: "01001234567", room: "نوم" }, EMPTY);
    expect(named.write.room).toBe("نوم");
    expect(named.roomFor).toBe("نوم");

    const written = planClaim({ phone: "01001234567", room: "نوم" }, { ...EMPTY, room: "صالة" });
    expect(written.write.room).toBeUndefined();
    expect(written.roomFor).toBe("صالة");
  });
});

describe("the area he types stays his own words", () => {
  it("collapses lines and caps the length", () => {
    expect(cleanCity("  التجمع\r\n الخامس  ")).toBe("التجمع الخامس");
    expect(cleanCity("م".repeat(200))).toHaveLength(60);
    expect(cleanCity(undefined)).toBe("");
  });
});

describe("the offer says what the bank can actually do", () => {
  it("names a matched room type without inventing a measurement claim", () => {
    const line = offerLine(3, true);
    expect(line).toBe("تلاتة اقتراحات لغرفة زي غرفتك");
    expect(line).not.toMatch("مقاسك");
  });

  it("admits when the room type is unknown", () => {
    expect(offerLine(3, false)).toContain("لسع ما عرفناش نوع غرفتك");
  });

  it("says so when the bank did not answer at all", () => {
    expect(offerLine(0, true)).toContain("ما جاوبش");
  });
});
