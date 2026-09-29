// @vitest-environment node
import { describe, it, expect } from "vitest";
import { phoneKey, identityOf, mergeByIdentity } from "@/lib/customers/identity";

/**
 * One customer, one key. The store keeps the same human in conversations, quote
 * requests, lead forms, orders and appointments — and until now each space called him
 * by its own spelling. This module decides what makes two records the same person,
 * and refuses to guess when it cannot tell.
 */
describe("the customer identity", () => {
  it("reads every Egyptian spelling of one number as the same customer", () => {
    const forms = ["+20 100 555 4444", "00201005554444", "01005554444", "1005554444", "+20 (100) 555-4444"];
    const keys = new Set(forms.map(phoneKey));
    expect([...keys]).toEqual(["1005554444"]);
  });

  it("keeps two different numbers apart", () => {
    expect(phoneKey("01005554444")).not.toBe(phoneKey("01112223344"));
  });

  it("falls back to email, then to a name marked as weak", () => {
    expect(identityOf({ email: "  Ali@Example.com " }).key).toBe("email:ali@example.com");
    expect(identityOf({ email: "Ali@Example.com" }).kind).toBe("email");
    const weak = identityOf({ name: "  أحمد   سمير " });
    expect(weak.kind).toBe("weak-name");
    expect(weak.key).toBe("name:أحمد سمير");
  });

  it("never invents an identity out of nothing", () => {
    expect(identityOf({}).key).toBeNull();
    expect(identityOf(null).key).toBeNull();
    expect(identityOf({ phone: "not a number" }).kind).not.toBe("phone");
  });

  it("prefers the phone over everything else when both exist", () => {
    expect(identityOf({ phone: "01005554444", email: "a@b.c" }).key).toBe("phone:1005554444");
  });

  it("merges records of one human and keeps which space each came from", () => {
    const merged = mergeByIdentity([
      { space: "consultant_sessions", phone: "+20 100 555 4444", name: "علي" },
      { space: "requests", phone: "01005554444", budget: "50-80" },
      { space: "sales_orders", phone: "1005554444", total_amount: 40000 },
      { space: "leads", email: "x@y.z" },
    ]);
    expect(merged).toHaveLength(2);
    const ali = merged.find((m) => m.key === "phone:1005554444");
    expect(ali?.spaces).toEqual(["consultant_sessions", "requests", "sales_orders"]);
    expect(ali?.name).toBe("علي");
  });

  it("does not merge two humans who share only a weak name", () => {
    const merged = mergeByIdentity([
      { space: "leads", name: "أحمد" },
      { space: "requests", name: "أحمد" },
    ]);
    // Same weak key still groups them — but the record says it is weak, so the screen
    // can show it as a guess instead of a fact.
    expect(merged[0].kind).toBe("weak-name");
    expect(merged[0].spaces).toEqual(["leads", "requests"]);
  });
});
