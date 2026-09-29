// @vitest-environment node
import { describe, it, expect } from "vitest";
import { rollCustomers, type RawRow } from "@/lib/customers/roll";

/**
 * The customers roll: one human, one line, assembled from the seven spaces that
 * currently describe him separately — profile, conversation, quote, form, order,
 * appointment, conversion. The screen and the chat must not be able to disagree about
 * how many customers there are, so the counting rule lives here and is tested here.
 */
const NOW = new Date("2026-09-29T12:00:00.000Z");

describe("the customers roll", () => {
  it("folds one human's four appearances into one line", () => {
    const rows: RawRow[] = [
      { space: "profile", phone: "01005554444", name: "علي سيد", tier: "silver", at: "2026-09-20T10:00:00.000Z" },
      { space: "conversation", phone: "01005554444", at: "2026-09-25T17:00:00.000Z" },
      { space: "quote", phone: "+20 100 555 4444", price: 60000, paid: 15000, at: "2026-09-25T07:00:00.000Z" },
      { space: "appointment", phone: "1005554444", at: "2026-09-26T09:00:00.000Z" },
    ];
    const roll = rollCustomers(rows, NOW);
    expect(roll).toHaveLength(1);
    const c = roll[0];
    expect(c.name).toBe("علي سيد");
    expect(c.spaces).toEqual(["profile", "conversation", "quote", "appointment"]);
    expect(c.money.quoted).toBe(60000);
    expect(c.money.paid).toBe(15000);
    expect(c.lastTouch).toBe("2026-09-26T09:00:00.000Z");
  });

  it("keeps two humans apart when only one of them left a number", () => {
    const roll = rollCustomers([
      { space: "form", phone: "01112223344", name: "أحمد سمير" },
      { space: "form", email: "hala@example.com", name: "هلا" },
    ], NOW);
    expect(roll).toHaveLength(2);
    expect(roll.map((r) => r.kind).sort()).toEqual(["email", "phone"]);
  });

  it("does not invent a customer out of a row with no contact at all", () => {
    const roll = rollCustomers([
      { space: "conversation", at: "2026-09-25T10:00:00.000Z" },
      { space: "order", name: "عميل", at: "2026-09-25T10:00:00.000Z" },
    ], NOW);
    expect(roll.filter((r) => r.kind !== "none")).toHaveLength(1);
    expect(roll.find((r) => r.kind === "none")?.anonymous).toBe(1);
  });

  it("takes the strongest tier a human ever earned, not the last row read", () => {
    const roll = rollCustomers([
      { space: "order", phone: "01005554444", tier: "bronze" },
      { space: "profile", phone: "01005554444", tier: "gold" },
      { space: "quote", phone: "01005554444", tier: "silver" },
    ], NOW);
    expect(roll[0].tier).toBe("gold");
  });

  it("carries the cold clock onto the line it belongs to", () => {
    const roll = rollCustomers([
      { space: "profile", phone: "01005554444", name: "هلا", at: "2026-09-27T12:00:00.000Z" },
    ], NOW);
    expect(roll[0].freshness.label).toBe("دافئ");
    expect(roll[0].needsReply).toBe(true);
  });

  it("sorts the longest-silenced customer first, and the unknown last", () => {
    const roll = rollCustomers([
      { space: "profile", phone: "01000000001", name: "حديث", at: "2026-09-29T11:00:00.000Z" },
      { space: "profile", phone: "01000000002", name: "قديم", at: "2026-04-01T11:00:00.000Z" },
      { space: "profile", email: "x@y.z", name: "بلا تاريخ" },
    ], NOW);
    expect(roll.map((r) => r.name)).toEqual(["قديم", "حديث", "بلا تاريخ"]);
  });

  it("reports the roll's totals so a screen cannot quietly lose a row", () => {
    const roll = rollCustomers([
      { space: "profile", phone: "01005554444", name: "علي" },
      { space: "conversation", at: "2026-09-25T10:00:00.000Z" },
    ], NOW);
    const totals = { customers: roll.filter((r) => r.kind !== "none").length, anonymous: roll.find((r) => r.kind === "none")?.anonymous ?? 0 };
    expect(totals).toEqual({ customers: 1, anonymous: 1 });
  });
});
