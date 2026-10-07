// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { linkFromPhone } from "@/lib/cad/sketch-link";
import { SENSITIVE_PATHS } from "@/lib/rate-limit";

/**
 * The customer's own door to his sheet.
 *
 * Measured 2026-10-07 walking the journey: the only door that minted a passport token was the
 * owner's sketch desk, and /request carried zero links to /passport/* — so a customer could never
 * start his own journey. This guards the door that replaces that, and in particular the lie it must
 * never tell: it stores his paper, it does not read it.
 */
const door = readFileSync("app/api/sheet/route.ts", "utf8");

describe("the phone is the only owner key a stranger may supply", () => {
  it("takes an Egyptian number in any shape he types it", () => {
    expect(linkFromPhone("01099999992")?.key).toBe("phone:1099999992");
    expect(linkFromPhone("+20 109 999 9992")?.key).toBe("phone:1099999992");
  });

  it("refuses anything that is not a valid Egyptian mobile", () => {
    expect(linkFromPhone("555-1234")).toBeNull();
    expect(linkFromPhone("")).toBeNull();
    expect(linkFromPhone(null)).toBeNull();
  });
});

describe("the door claims no reading it did not do", () => {
  it("asks no model and no pixel engine inside the request", () => {
    expect(door).not.toContain("readPaperSketch");
    expect(door).not.toContain("askVisionAny");
    expect(door).toContain("model_reader: null");
    expect(door).toContain('offline: { ran: false');
  });

  it("says on the sheet, in his language, what is still waiting", () => {
    expect(door).toContain("الورقة مستنية");
    expect(door).toContain("ok: false");
  });

  it("keeps the same picture ceiling the store's other doors carry", () => {
    expect(door).toContain("4 * 1024 * 1024");
  });
});

describe("the door is reachable by a customer and still rate-limited", () => {
  it("is not behind the admin gate", () => {
    expect(door).not.toContain("requireAdminApi");
    expect(door).not.toContain("/api/admin");
  });

  it("is counted as a sensitive write path", () => {
    expect(SENSITIVE_PATHS).toContain("/api/sheet");
  });
});

describe("the card on the customer's page is his own", () => {
  const card = readFileSync("components/cad/OwnSheetCard.tsx", "utf8");

  it("carries its own number field and posts to the customer door", () => {
    expect(card).toContain('data-own-sheet-phone=""');
    expect(card).toContain('data-own-sheet-send=""');
    expect(card).toContain('fetch("/api/sheet"');
  });

  it("shows the address as a link with the number he typed, not a machine token in prose", () => {
    expect(card).toContain("data-own-sheet-link");
    expect(card).toContain('dir="ltr"');
  });
});
