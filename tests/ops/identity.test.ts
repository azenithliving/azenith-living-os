// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  AGENT_KEYS, LEADER_TITLE, SWARM_NAME,
  legacyToOps, opsToLegacy, agentLabel, storedSenderName, isOpsKey,
} from "@/lib/ops/identity";

describe("the swarm's identity", () => {
  it("names the leader by job title and the swarm by the store", () => {
    expect(LEADER_TITLE).toBe("مدير تشغيل المحتوى");
    expect(SWARM_NAME).toBe("سرب أزينث");
  });

  it("maps every legacy key to exactly one new key", () => {
    const legacy = [
      "qayyim-core", "qayyim-cont", "qayyim-vis", "qayyim-seo",
      "qayyim-ux", "qayyim-ana", "qayyim-dev", "qayyim-qa",
    ];
    expect(legacy.map(legacyToOps)).toEqual([...AGENT_KEYS]);
    for (const k of legacy) expect(isOpsKey(legacyToOps(k))).toBe(true);
  });

  it("reverses the map without losing a key", () => {
    for (const k of AGENT_KEYS) expect(opsToLegacy(k)).toMatch(/^qayyim-/);
    for (const k of AGENT_KEYS) expect(legacyToOps(opsToLegacy(k) as string)).toBe(k);
  });

  it("never labels an agent with the retired brand", () => {
    for (const k of AGENT_KEYS) {
      expect(agentLabel(k)).not.toMatch(/قيّم الدار|qayyim/i);
      expect(agentLabel(k).length).toBeGreaterThan(3);
    }
    expect(agentLabel("ops-lead")).toBe(LEADER_TITLE);
  });

  it("keeps the stored sender-name convention (upper-cased key)", () => {
    expect(storedSenderName("ops-lead")).toBe("OPS-LEAD");
  });

  it("refuses to invent a key it does not know", () => {
    expect(isOpsKey("qayyim-core")).toBe(false);
    expect(agentLabel("nope")).toBe("nope");
  });
});
