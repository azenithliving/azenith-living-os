// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AGENT_KEYS, SWARM_NAME, LEADER_TITLE, agentLabel } from "@/lib/ops/identity";
import { AGENT_PERSONAS } from "@/lib/agents/AgentOrchestrator";

const src = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");

describe("an agent introduces itself by role, not by the retired brand", () => {
  it("contains no old name", () => {
    expect(src).not.toMatch(/قيّم الدار/);
    expect(src).not.toMatch(/\bqayyim-(core|cont|vis|seo|ux|ana|dev|qa)\b/);
  });

  it("introduces every member through the identity module, not a literal", () => {
    for (const key of AGENT_KEYS) {
      expect(src, `missing the introduction for ${key}`).toContain(`agentLabel("${key}")`);
    }
    // The swarm's name is interpolated, never re-typed here: the sentence and the
    // label must be able to change in exactly one file.
    expect(src).toContain("${SWARM_NAME}");
    expect(AGENT_PERSONAS["ops-lead"].prompt).toContain(SWARM_NAME);
  });

  /**
   * The catalogue is what a sub-agent is told it is. If any of the eight still
   * opens with a brand sentence, or two members share one name, the swarm answers
   * the owner as «the brand» instead of as the role he hired.
   */
  it("gives every member its own role name and a role sentence", () => {
    for (const key of AGENT_KEYS) {
      const persona = AGENT_PERSONAS[key];
      expect(persona, `no persona for ${key}`).toBeDefined();
      expect(persona.name).toBe(agentLabel(key));
      expect(persona.prompt.startsWith(`أنت ${agentLabel(key)}`)).toBe(true);
      expect(persona.prompt).not.toMatch(/قيّم الدار|qayyim/i);
    }
    expect(AGENT_PERSONAS["ops-lead"].name).toBe(LEADER_TITLE);
  });

  it("keeps the specialised duties the roles were built for", () => {
    expect(AGENT_PERSONAS["ops-lead"].prompt).toContain("لا تنفّذ المهام التفصيلية بنفسك");
    expect(AGENT_PERSONAS["ops-content"].prompt).toContain("قانون الهوية");
    expect(AGENT_PERSONAS["ops-qa"].prompt).toContain("visual regression");
    for (const key of AGENT_KEYS) {
      expect(AGENT_PERSONAS[key].prompt).toContain("مش قادر على الصفحة دي");
    }
  });
});
