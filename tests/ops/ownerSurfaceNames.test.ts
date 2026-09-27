// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * P7-M4 moved the agents' names into `lib/ops/identity.ts`, and the retired keys
 * survived in one place the guards did not cover: prose written for the owner.
 * «حدّد هدفاً ليقيس QAYYIM-UX التقدم نحوه» is Arabic copy on the owner's screen
 * carrying a key that no longer exists — the exact mistake `AGENTS.md` says this
 * map exists to prevent, and `noRetiredName.test.ts` missed because it only looks
 * for «قيّم الدار».
 *
 * The owner's surfaces are `app/` and `components/`. `lib/ops/Qayyim*Agent.ts` and
 * the internal log prefixes deliberately keep the old word, and each has its reason
 * written in AGENTS.md — so this guard scans the two shipped trees only.
 */
function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes(".test.") ? [full] : [];
  });
}

const RETIRED_KEY = /QAYYIM[-_](CORE|CONT|VIS|SEO|UX|ANA|DEV|QA)\b|qayyim-(core|cont|vis|seo|ux|ana|dev|qa)\b/;

describe("the owner's surfaces name the swarm by its live roles", () => {
  it("walks both shipped trees", () => {
    // A guard that scans nothing passes vacuously, so the scan itself is asserted.
    expect(sources("app").length).toBeGreaterThan(10);
    expect(sources("components").length).toBeGreaterThan(10);
  });

  it("carries no retired agent key in app or components", () => {
    const hits = ["app", "components"]
      .flatMap(sources)
      .filter((f) => RETIRED_KEY.test(readFileSync(f, "utf8")))
      .map((f) => f.replace(/\\/g, "/"));
    expect(hits, hits.join("\n")).toEqual([]);
  });

  /**
   * Arabic copy is where a role name goes stale silently: the key rename swept the
   * code but not the sentences, and no type or test fails when a label is wrong.
   * Every role label the owner reads must come from `agentLabel`, so the retired
   * spelling can never return as a string literal.
   */
  it("builds the studio's role labels from the identity module", () => {
    const panels = [
      "components/admin/ops/QayyimGoalsPanel.tsx",
      "components/admin/ops/QayyimExperimentsPanel.tsx",
      "components/admin/ops/QayyimTelemetryPanel.tsx",
    ];
    for (const file of panels) {
      expect(readFileSync(file, "utf8"), file).toContain('from \'@/lib/ops/identity\'');
    }
  });
});

/**
 * The monitoring tab read `ops_task_metrics`, a table only the QA and Dev agents
 * write to. The owner's screen therefore reported «zero agents, zero tasks» while
 * the same day's ledger held dozens of answered tasks — and the old dashboard,
 * which reads `agent_tasks`, showed the real numbers beside it. The two surfaces
 * disagreed because one of them was asking a nearly empty table for the truth.
 */
describe("the swarm's monitoring reads the complete ledger", () => {
  const route = readFileSync("app/api/admin/ops/observability/route.ts", "utf8");

  it("asks agent_tasks for what the swarm did", () => {
    expect(route).toContain(".from('agent_tasks')");
  });

  it("keeps the quality gate on the table that records its verdict", () => {
    expect(route).toContain(".from('ops_task_metrics')");
    expect(route).toContain("quality_gate_result");
  });

  /**
   * `ops_task_metrics` has a `duration_ms` column and `agent_tasks` does not — it
   * carries `started_at`/`completed_at` instead. Reading the wrong one silently
   * yields null durations, which is how «متوسط» disappears from the panel.
   */
  it("derives durations from the columns the ledger actually has", () => {
    expect(route).toContain("started_at");
    expect(route).toContain("completed_at");
    expect(route).not.toContain("duration_ms,");
  });

  it("does not count an unanswered task as a failure", () => {
    expect(route).toContain("completed.length + failed.length");
  });
});
