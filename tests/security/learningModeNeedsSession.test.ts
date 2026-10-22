// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Learning mode answers to a session, never to a name typed into the request body.
 *
 * Measured 2026-10-23 on the published link (`scratch/prove-learning-mode-hole.mjs`): an anonymous
 * POST to the customer advisor door, carrying an admin email in its JSON body, was accepted as the
 * owner and wrote a rule into `consultant_learnings` — 51 rows before the probe, 52 after — answering
 * «Knowledge saved successfully». The door writes with the service-role client, so the body field was
 * the only thing standing between a stranger and the manager's memory.
 */
const doorPath = "app/api/consultant/route.ts";

describe("the advisor door cannot be told who the owner is", () => {
  const door = readFileSync(doorPath, "utf8");

  it("asks the admin session before it lets anyone teach the manager", () => {
    expect(door).toContain('import { requireAdminApi } from "@/lib/admin-api-guard"');
    expect(door).toMatch(/const adminMode = isAdmin\(sessionId, adminSessionUser\?\.email\)/);
  });

  it("never reads an identity out of the request body", () => {
    // The body still carries the customer's email for his own record; what it may not decide is privilege.
    // Only call sites count — the helper's own parameter name is not a decision.
    const calls = door.split("\n").filter((l) => /\bisAdmin\(/.test(l) && !/function\s+isAdmin\(/.test(l));
    expect(calls.length).toBeGreaterThan(0);
    for (const line of calls) {
      expect(line, `a call still passes a body email: ${line.trim()}`).not.toMatch(/\buserEmail\b/);
    }
  });

  it("answers the owner in his language when a rule lands", () => {
    expect(door).toContain("القاعدة اتحفظت عند مدير المبيعات");
    expect(door).toContain("القاعدة ما اتحفظتش");
    expect(door).not.toMatch(/reply\s*=\s*[\s\S]{0,120}Knowledge saved/);
  });
});
