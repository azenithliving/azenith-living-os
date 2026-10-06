// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { AGENT_KEYS } from "@/lib/ops/identity";
import { AGENT_ROLES } from "@/lib/ops/agent-roles";

function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes(".test.") ? [full] : [];
  });
}

/**
 * The key rename is atomic: a catalog keyed one way and callers passing the other
 * returns undefined and breaks the live chat, so this guard is the proof that the
 * whole codebase moved in the same commit.
 */
describe("the whole codebase speaks one key set", () => {
  it("keys the role catalog by the new keys only", () => {
    expect(Object.keys(AGENT_ROLES).sort()).toEqual([...AGENT_KEYS].sort());
  });

  it("no source file carries a retired agent key", () => {
    const hits = ["lib", "app", "components"]
      .flatMap(sources)
      .filter((f) => !f.endsWith(join("lib", "ops", "identity.ts")))
      .filter((f) => /qayyim-(core|cont|vis|seo|ux|ana|dev|qa)\b/.test(readFileSync(f, "utf8")));
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("message stamps come from the identity module", () => {
    expect(readFileSync("lib/agents/AgentOrchestrator.ts", "utf8")).toContain("storedSenderName(");
    expect(readFileSync("app/api/admin/agents/messages/route.ts", "utf8")).toContain("storedSenderName(");
  });

  /**
   * The leader hands work to the seven by writing their key in prose. When the
   * keys moved, the parser kept looking for the retired prefix and every
   * delegation became a silent no-op — so the pattern accepts either spelling
   * and the result goes through the same map the HTTP doors use.
   */
  it("parses a delegation written with either key spelling", () => {
    const core = readFileSync("lib/ops/QayyimCoreAgent.ts", "utf8");
    expect(core).toContain("(?:ops|qayyim)-\\w+");
    expect(core).toContain("legacyToOps(match[1])");
    expect(core).not.toMatch(/\(qayyim-\\w\+\)/);
  });

  /**
   * A browser tab opened before the rename keeps posting the key it was built
   * with until the owner reloads, and a Telegram deep link never expires. Each
   * door maps that key instead of rejecting it or storing a second identity.
   */
  it("normalises a retired key at every door it can still arrive through", () => {
    const doors = [
      "lib/agents/AgentOrchestrator.ts",
      "app/api/admin/agents/chat/route.ts",
      "app/api/admin/agents/messages/route.ts",
      "app/api/admin/agents/tasks/route.ts",
      "app/api/admin/agents/learn/route.ts",
      "app/api/admin/ops/route.ts",
    ];
    for (const file of doors) {
      expect(readFileSync(file, "utf8"), file).toContain("legacyToOps(");
    }
    /**
     * The chat page used to be in that list. Batch four moved its door to the outer
     * gate: a retired key in `?agent=` is rewritten before the page is reached, so
     * the page must NOT own a translator — see `legacyAddressTable.test.ts`.
     */
    expect(readFileSync("app/admin/v2/agents/ops/page.tsx", "utf8")).not.toContain("legacyToOps");
    expect(readFileSync("proxy.ts", "utf8")).toContain("retiredAgentQueryRedirect");
  });
});

/**
 * The quick-actions drawer is the one place where the owner reads a capability as a button label
 * and then taps it. Measured on the published site, four of those labels carried English machine
 * words («Luxury Score», «SEO», «About», «alt text») inside an Egyptian sentence — the same defect
 * the cockpit's cards and the daily report had, in a surface nobody had scanned.
 *
 * The rename is routing-safe: `admin-tool-bridge` already matches these intents on Arabic
 * («الفخامة», «ظهور», «من نحن»), which is what the assertions below protect — a label may not
 * become pretty and stop reaching its tool.
 */
describe("the quick actions the owner taps are his Arabic", () => {
  const examples = Object.entries(AGENT_ROLES).flatMap(([key, role]) =>
    role.map((text) => ({ key, text }))
  );

  it("carries examples for the roles at all", () => {
    expect(examples.length).toBeGreaterThan(15);
  });

  it("names nothing in a language he does not read", () => {
    const hits = examples.filter(({ text }) => /[A-Za-z]{3,}/.test(text));
    expect(hits.map((h) => `${h.key}: ${h.text}`)).toEqual([]);
  });

  it("still reaches the tool each label promises after the rename", async () => {
    const { inferUltimateTool } = await import("@/lib/admin-tool-bridge");
    for (const label of [
      "احسب درجة الفخامة الآن للموقع كله",
      "أصلح مشاكل الظهور في نتائج البحث للمحتوى الحالي",
      "راجع نص صفحة من نحن واقترح نسخة أفخم",
    ]) {
      const intent = inferUltimateTool(label);
      expect(intent.toolName, label).toBeTruthy();
      expect(intent.toolName, label).not.toBe("none");
    }
  });
});
