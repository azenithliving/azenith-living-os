import { describe, it, expect } from "vitest";
import { askGroqLite } from "../aaca/lib/ask-groq-lite";
import {
  MemoryEventBus,
  DegradedQueueManager,
} from "../aaca/stubs/degraded-infrastructure";

describe("AACA infrastructure", () => {
  it("degraded event bus connects and publishes", async () => {
    const bus = new MemoryEventBus();
    await bus.connect();
    const id = await bus.publish({
      type: "test:event",
      source: "vitest",
      payload: { ok: true },
    });
    expect(id).toMatch(/^mem-/);
    await bus.disconnect();
  });

  it("degraded queue manager exposes agent queues", async () => {
    const qm = new DegradedQueueManager();
    await qm.initialize();
    expect(qm.getQueueNames()).toContain("orchestrator");
  });

  it("askGroqLite returns success or graceful error", async () => {
    const result = await askGroqLite("Reply with exactly: OK");
    expect(typeof result.success).toBe("boolean");
    if (result.success) {
      expect(result.content?.length).toBeGreaterThan(0);
    } else {
      expect(result.error).toBeDefined();
    }
  });
});
