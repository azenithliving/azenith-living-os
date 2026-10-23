// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * One owner for «which company is this store».
 *
 * Measured 2026-10-23: twelve writers read `process.env.MASTER_COMPANY_ID`, which is not set in
 * this deployment, while the resolver that answers the question from the store's own recorded
 * decision was called by only five other places. Every row the first group wrote landed with no
 * company — which is how 52 of the 56 papers waiting for the owner became rows his decision door
 * could not see, and why the badge counted ٥٦ while his dashboard counted ٤.
 */

import { withOwnerPapers } from "@/lib/ops/approval-intake";

function sourceOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(full)) acc.push(full.replace(/\\/g, "/"));
  }
  return acc;
}

describe("the paper scope both surfaces share", () => {
  it("asks the record for the store's rows and the ones written before the stamp", () => {
    let seen = "";
    const builder = {
      or(filter: string) {
        seen = filter;
        return this;
      },
    };
    const out = withOwnerPapers(builder, "company-1");
    expect(seen).toBe("company_id.eq.company-1,company_id.is.null");
    expect(out).toBe(builder);
  });
});

describe("the company has one answer-giver", () => {
  it("is read from the resolver, not from the environment, anywhere but the resolver", () => {
    const readers: string[] = [];
    for (const dir of ["app", "lib", "services", "components"]) {
      for (const file of walk(dir)) {
        if (file === "lib/admin-env-resolver.ts") continue;
        if (sourceOf(file).includes("process.env.MASTER_COMPANY_ID")) readers.push(file);
      }
    }
    expect(readers).toEqual([]);
  });

  it("keeps the assistant's writer from inventing an owner-less paper", () => {
    const writer = sourceOf("lib/admin-sovereign-mind.ts");
    expect(writer).not.toMatch(/delete\s+\w+\.company_id/);
    expect(writer).toContain("شركة المتجر ما اتحلّتش");
    expect(writer).toContain("resolveMasterCompanyId");
  });

  it("lets the owner decide exactly the pile the desk shows him", () => {
    const decide = sourceOf("app/api/admin/owner/approval/decision/route.ts");
    const queue = sourceOf("app/api/admin/agents/approval-queue/route.ts");
    expect(decide).toContain("withOwnerPapers");
    expect(queue).toContain("withOwnerPapers");
    // One filter, owned by the intake module — no hand-written copy in either door.
    expect(decide).not.toMatch(/company_id\.eq\./);
    expect(queue).not.toMatch(/company_id\.eq\./);
  });

  it("adopts an old paper the moment he decides it", () => {
    expect(sourceOf("app/api/admin/owner/approval/decision/route.ts")).toMatch(/company_id:\s*companyId/);
  });

  it("counts the same pile on the dashboard as on the badge", () => {
    const dashboard = sourceOf("app/api/admin/owner/dashboard/route.ts");
    // Both paper reads — the list and the "waited a day" count — go through the shared scope.
    expect((dashboard.match(/withOwnerPapers\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(dashboard).not.toMatch(/\.from\(['"]approval_requests['"]\)\s*\.select\([^)]*\)\s*\.eq\(['"]company_id/);
  });
});
