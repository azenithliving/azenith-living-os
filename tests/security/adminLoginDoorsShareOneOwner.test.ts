// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ADMIN_LOGIN_PATHS, isAdminLoginPath } from "@/lib/admin-login-paths";
import { shouldRateLimit } from "@/lib/rate-limit";

/**
 * The passkey login door is the first admin door a stranger may knock on, so the outer gate has to
 * know it — and the two rules that used to be written separately ( «let it through» and «limit it
 * like a login» ) now have ONE owner. Written twice, they drift: the door gets exposed and the ceiling
 * is forgotten, or the ceiling exists and the door answers 401 before the ceremony starts.
 *
 * These guards read the source of both files on purpose. The fact they protect is a list of
 * addresses, and a list that lives in prose is a list nobody can diff.
 */
const proxySource = readFileSync("proxy.ts", "utf8");
const rateLimitSource = readFileSync("lib/rate-limit.ts", "utf8");

describe("the one owner of the openable admin doors", () => {
  it("names the four password doors and the two passkey login doors", () => {
    expect(ADMIN_LOGIN_PATHS).toContain("/api/admin/gate/validate");
    expect(ADMIN_LOGIN_PATHS).toContain("/api/admin/verify-2fa");
    expect(ADMIN_LOGIN_PATHS).toContain("/api/admin/passkeys/authenticate/options");
    expect(ADMIN_LOGIN_PATHS).toContain("/api/admin/passkeys/authenticate/verify");
  });

  it("answers the exact address, never a prefix that would expose the whole office", () => {
    expect(isAdminLoginPath("/api/admin/passkeys/authenticate/verify")).toBe(true);
    expect(isAdminLoginPath("/api/admin/passkeys/authenticate/verify/anything")).toBe(false);
    expect(isAdminLoginPath("/api/admin/passkeys/enroll")).toBe(false);
    expect(isAdminLoginPath("/api/admin/settings")).toBe(false);
  });

  it("the outer gate asks that owner instead of keeping its own list", () => {
    expect(proxySource).toContain("isAdminLoginPath(pathname)");
    expect(proxySource).not.toContain('pathname === "/api/admin/gate/validate"');
  });

  it("the rate limiter asks the same owner instead of keeping its own list", () => {
    expect(rateLimitSource).toContain("isAdminLoginPath");
    expect(rateLimitSource).not.toContain('"/api/admin/verify-2fa"');
  });
});

describe("every openable admin door is also a limited door", () => {
  it("caps every address in the list, and caps a write strictly", () => {
    for (const path of ADMIN_LOGIN_PATHS) {
      for (const verb of ["POST", "GET", "PUT"]) {
        const verdict = shouldRateLimit(path, verb);
        // An unlisted door is an uncounted door: whoever finds the address decides how fast it is
        // hammered. Every login address must be counted for every verb.
        expect(verdict.shouldLimit, `${path} ${verb}`).toBe(true);
      }
      // The verb that answers the device is the one an attacker repeats, so it keeps the strict
      // ceiling. A read stays in the general tier — the dashboard polls the gate's health.
      expect(shouldRateLimit(path, "POST").isSensitive, `${path} POST`).toBe(true);
    }
  });
});
