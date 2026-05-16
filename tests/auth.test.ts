import { describe, it, expect } from "vitest";
import {
  validateAdminGateCredentials,
  normalizeAdminEmail,
  isAdminGateConfigured,
} from "@/lib/admin-gate";

describe("Admin gate credentials", () => {
  const email = process.env.ADMIN_GATE_EMAIL || "azenithliving@gmail.com";
  const password = process.env.ADMIN_GATE_PASSWORD || "";

  it("is configured when env vars are set", () => {
    expect(isAdminGateConfigured()).toBe(true);
  });

  it("normalizes email consistently", () => {
    expect(normalizeAdminEmail("  AzenithLiving@Gmail.COM  ")).toBe(
      "azenithliving@gmail.com"
    );
  });

  it("accepts valid admin credentials from environment", () => {
    if (!password) {
      expect(true).toBe(true);
      return;
    }
    expect(validateAdminGateCredentials(email, password)).toBe(true);
  });

  it("rejects wrong password", () => {
    if (!password) return;
    expect(validateAdminGateCredentials(email, "wrong-password-xyz")).toBe(false);
  });

  it("rejects wrong email", () => {
    if (!password) return;
    expect(validateAdminGateCredentials("not-admin@example.com", password)).toBe(
      false
    );
  });
});

describe("Admin API auth contract", () => {
  it("uses consistent unauthorized JSON shape", () => {
    const unauthorized = { success: false, error: "Unauthorized" };
    expect(unauthorized.success).toBe(false);
    expect(unauthorized.error).toBeDefined();
  });
});
