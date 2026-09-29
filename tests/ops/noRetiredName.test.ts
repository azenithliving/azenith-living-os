// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { agentLabel, scrubRetiredProductName } from "@/lib/ops/identity";

function files(dir: string): string[] {
  if (!statSync(dir).isDirectory()) return [];
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return full.includes("vanguard") ? [] : files(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes(".test.") ? [full] : [];
  });
}

/**
 * P7 retires the product name completely: the swarm is «سرب أزينث», its leader is a
 * job title, and its members are roles. The one place the old name may still be
 * written is `lib/ops/identity.ts`, which owns the mapping from the retired key to
 * the live one — that file is the migration's dictionary, not a surface.
 */
describe("the retired name is gone from shipped code", () => {
  for (const dir of ["app", "components", "lib"]) {
    it(`${dir} carries no retired brand`, () => {
      // A guard that scans nothing passes vacuously, so the scan itself is asserted.
      expect(files(dir).length, `${dir} was not walked`).toBeGreaterThan(10);
      const hits = files(dir)
        .filter((f) => !f.endsWith(join("lib", "ops", "identity.ts")))
        .filter((f) => readFileSync(f, "utf8").includes("قيّم الدار"));
      expect(hits, hits.join("\n")).toEqual([]);
    });
  }
});

/**
 * Scanning the source was only half the promise. Measured on production after P7
 * shipped clean: a development agent answered the owner with «بصفتي **قيّم الدار**،
 * المسؤول عن متانة البنيان البرمجي» — a name no file contains and no stored row
 * holds (both were swept and verified empty), so it came out of the model's own
 * memory of what this product used to be called. No prompt can be trusted to keep
 * a name that no longer exists; the reply boundary can.
 *
 * The repair is narrow on purpose: only the two-word product name is rewritten, so
 * «قيّم» used as a verb («افحص صور المنتجات وقيّم جودتها») and «القيّم» used as the
 * ordinary Arabic word for a custodian both survive untouched.
 */
describe("a model cannot bring the retired name back into a reply", () => {
  it("replaces the retired product name with the answering role", () => {
    const line = "بصفتي **قيّم الدار**، المسؤول عن متانة البنيان البرمجي";
    const fixed = scrubRetiredProductName(line, agentLabel("ops-dev"));
    expect(fixed).not.toContain("قيّم الدار");
    expect(fixed).toContain(agentLabel("ops-dev"));
    expect(fixed).toContain("المسؤول عن متانة البنيان البرمجي");
  });

  it("catches the spelling without the emphasis mark, and with the article", () => {
    for (const variant of ["قيم الدار", "القيّم الدار", "القيم الدار"]) {
      expect(scrubRetiredProductName(variant, "وكيل الاختبار"), variant).toBe("وكيل الاختبار");
    }
  });

  it("leaves the word alone when it is not the product name", () => {
    const verb = "افحص صور المنتجات وقيّم جودتها واتساقها";
    const custodian = "القيّم على هذا القسم يراجعه يومياً";
    const assessment = "ده تقييم الدار بعد التعديلات";
    expect(scrubRetiredProductName(verb, "وكيل الاختبار")).toBe(verb);
    expect(scrubRetiredProductName(custodian, "وكيل الاختبار")).toBe(custodian);
    expect(scrubRetiredProductName(assessment, "وكيل الاختبار")).toBe(assessment);
  });

  /**
   * The choke point is the one every admin reply already passes — the truth layer —
   * so a new surface cannot appear that forgets the scrub.
   */
  it("sits inside the reply boundary every admin answer passes", () => {
    const brain = readFileSync("lib/ops/chat-brain.ts", "utf8");
    expect(brain).toContain("scrubRetiredProductName");
    const orchestrator = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");
    expect(orchestrator).toMatch(/finalizeReply\(\s*response[^)]*,\s*process\.env\.NEXT_PUBLIC_SITE_URL\s*,/);
  });
});

/**
 * The clause the owner froze says the new house does not know the old name — in code,
 * in a component, or in a comment. Measured tonight, three Latin spellings of the
 * retired word were still inside `app/admin/v2` (two page function names and one
 * comment), and the guard above never saw them because it only reads the Arabic name.
 * A guard that checks one spelling is a guard on one spelling.
 */
describe("the new house does not know the retired word at all", () => {
  it("carries no spelling of it, Arabic or Latin", () => {
    const walked = files("app/admin/v2");
    expect(walked.length, "app/admin/v2 was not walked").toBeGreaterThan(10);
    const hits = walked
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => /qayyim|قيّم الدار/i.test(readFileSync(f, "utf8")));
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
