// @vitest-environment node
/**
 * The zero-key floor.
 *
 * The owner's law is that every capability the dashboard uses must still work when no key
 * answers. This is the ledger that law is recorded in, and these are the checks that keep
 * it from becoming a claim: a capability with no floor is a surface that goes dark, a floor
 * written in machine prose is a surface that insults the man it went dark for, and a drill
 * that only works in theory has never been run.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ALL_PROVIDERS_MESSAGE,
  CAPABILITIES,
  NO_KEY_MESSAGE,
  capabilityOf,
  keylessCoverage,
  modelFailureReason,
  modelFloorLine,
} from "@/lib/ops/capability-tiers";
import { keylessDrillOn } from "@/lib/api-keys-service";

describe("every capability declares what still works with no key", () => {
  it("names itself, its job, and a floor that is not empty", () => {
    const ids = CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size, "a repeated capability is two truths about one surface").toBe(ids.length);
    for (const capability of CAPABILITIES) {
      expect(capability.id.length).toBeGreaterThan(2);
      expect(capability.label.trim().length, capability.id).toBeGreaterThan(3);
      expect(capability.does.trim().length, capability.id).toBeGreaterThan(10);
      expect(capability.floor.trim().length, `${capability.id} has no zero-key floor`).toBeGreaterThan(20);
      expect(capability.model.trim().length, `${capability.id} does not say what the model is for`).toBeGreaterThan(10);
    }
  });

  it("speaks the owner's language on every floor line", () => {
    for (const capability of CAPABILITIES) {
      // Latin letters on an owner surface read as code to him; a machine identifier is
      // never allowed to stand in for an answer.
      expect(capability.floor, `${capability.id} floor`).not.toMatch(/[A-Za-z]/);
      expect(capability.label, `${capability.id} label`).not.toMatch(/[A-Za-z]/);
      expect(modelFloorLine(capability.id, "no_key")).not.toMatch(/[A-Za-z]/);
    }
  });

  it("counts its own coverage so a gap cannot be quietly added", () => {
    const coverage = keylessCoverage();
    expect(coverage.withFloor).toBe(coverage.total);
    expect(coverage.total).toBeGreaterThanOrEqual(6);
    expect(coverage.withDevice, "voice is on the device today; the ledger must not forget it").toBeGreaterThan(0);
  });

  it("returns nothing for a capability that does not exist, instead of a confident line", () => {
    expect(capabilityOf("no-such-thing")).toBeNull();
    expect(capabilityOf(null)).toBeNull();
    expect(modelFloorLine("no-such-thing", "no_key")).toBe(NO_KEY_MESSAGE);
  });
});

describe("the failure keeps its reason", () => {
  it("tells a dead key from a spent quota from a bad answer", () => {
    expect(modelFailureReason(NO_KEY_MESSAGE)).toBe("no_key");
    expect(modelFailureReason("No API keys available for google")).toBe("no_key");
    expect(modelFailureReason("429 Quota exceeded for quota metric")).toBe("quota");
    expect(modelFailureReason(ALL_PROVIDERS_MESSAGE)).toBe("failed");
    expect(modelFailureReason(undefined)).toBe("failed");
    expect(modelFailureReason(null)).toBe("failed");
  });

  it("says what stands, not what broke", () => {
    const line = modelFloorLine("chat", "no_key");
    expect(line).toContain(NO_KEY_MESSAGE);
    expect(line).toContain(capabilityOf("chat")!.floor);
    expect(line).toContain("جهازك", "the voice floor is the reason the chat still works");
  });
});

describe("the keyless drill", () => {
  it("is off unless it is asked for, and never in production", () => {
    const before = { ...process.env };
    try {
      delete process.env.OPS_KEYS_OFF;
      expect(keylessDrillOn()).toBe(false);
      process.env.OPS_KEYS_OFF = "1";
      process.env.NODE_ENV = "development";
      expect(keylessDrillOn()).toBe(true);
      process.env.NODE_ENV = "production";
      expect(keylessDrillOn(), "a forgotten variable must not be able to dim the live store").toBe(false);
    } finally {
      process.env = before;
    }
  });

  it("leaves no English machine prose on the owner's path", () => {
    const orchestrator = readFileSync("lib/ai-orchestrator.ts", "utf8");
    const swarm = readFileSync("lib/ops/QayyimAgentBase.ts", "utf8");
    const brain = readFileSync("lib/admin-natural-brain.ts", "utf8");
    const returned = (source: string) =>
      source
        .split("\n")
        .filter((line) => /return .*No API keys available/.test(line));
    expect(returned(orchestrator), "the door may log it, not answer with it").toEqual([]);
    expect(swarm).toMatch(/modelFloorLine\(this\.capabilityId/);
    expect(swarm).not.toMatch(/خطأ تقني/);
    // The cockpit's own brain answers a missing model with its floor, and logs the reason.
    expect(brain).toMatch(/modelFloorLine\("chat", modelFailureReason/);
    expect(brain).not.toMatch(/عقبة تقنية/);
  });
});
