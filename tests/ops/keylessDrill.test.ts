// @vitest-environment node
/**
 * The keyless drill, run for real.
 *
 * The owner's law is not «we hope the rules cover it» — it is that the store keeps working
 * with zero keys. So this file turns the drill switch on, asks the exact function every AI
 * surface goes through for a key, and then asks the four keyless engines the same questions
 * they will be asked on a day when no provider answers. A claim about a floor is worth the
 * run that stands on it.
 */
import { describe, expect, it } from "vitest";

import { getNextAvailableKey, keylessDrillOn } from "@/lib/api-keys-service";
import { NO_KEY_MESSAGE, modelFailureReason } from "@/lib/ops/capability-tiers";
import { anomalyFromCounts, buildDailyCounts, renderAnomalyDigest } from "@/lib/ops/anomaly";
import { buildPalette, filterPalette } from "@/lib/ops/palette";
import { freshnessOf, hoursSinceLastTouch } from "@/lib/leads-freshness";
import { rollCustomers, type RawRow } from "@/lib/customers/roll";

const withDrill = async <T,>(run: () => Promise<T> | T): Promise<T> => {
  const before = { ...process.env };
  process.env.OPS_KEYS_OFF = "1";
  process.env.NODE_ENV = "development";
  try {
    return await run();
  } finally {
    process.env = before;
  }
};

describe("with the keys away", () => {
  it("the drill is on and the picker answers for every provider that there is no key", async () => {
    await withDrill(async () => {
      expect(keylessDrillOn()).toBe(true);
      for (const provider of ["google", "groq", "openrouter", "cerebras", "together"] as const) {
        expect(await getNextAvailableKey(provider), provider).toBeNull();
      }
    });
  });

  it("and the door that reads a paper's numbers says so in his language, not in prose", async () => {
    await withDrill(async () => {
      const { askGoogleVision } = await import("@/lib/ai-orchestrator");
      const answer = await askGoogleVision("اقرأ الورقة", "AA", "image/png");
      expect(answer.success).toBe(false);
      expect(answer.error).toBe(NO_KEY_MESSAGE);
      expect(modelFailureReason(answer.error)).toBe("no_key");
    });
  });
});

describe("the floors that do not need a key", () => {
  it("the site's own watcher still finds the spike", () => {
    const end = Date.UTC(2026, 8, 26);
    const perDay = [4, 5, 4, 6, 5, 4, 3, 5, 4, 31];
    const timestamps: string[] = [];
    perDay.forEach((count, dayFromStart) => {
      const day = end - (perDay.length - 1 - dayFromStart) * 864e5;
      for (let i = 0; i < count; i++) timestamps.push(new Date(day + i * 60e3).toISOString());
    });

    const counts = buildDailyCounts(timestamps, { days: perDay.length, endDate: new Date(end) });
    const hits = anomalyFromCounts(counts);
    expect(counts).toHaveLength(perDay.length);
    expect(hits.length, "a day seven times the rest is still an anomaly with no model").toBeGreaterThan(0);
    expect(hits[0].count).toBe(31);
    expect(renderAnomalyDigest(hits)).toContain("أعلى من الطبيعي");
  });

  it("the command cabin still finds the capability he types for", () => {
    const palette = buildPalette(null);
    const found = filterPalette(palette, "الوكلاء");
    expect(found.length, "the cabin answers from its own list, no model in the path").toBeGreaterThan(0);
    expect(found[0].label).toContain("الوكلاء");
  });

  it("the cold clock still says who is waiting", () => {
    const hours = hoursSinceLastTouch({ created_at: new Date(Date.now() - 50 * 3600e3).toISOString(), messages: [] }, new Date());
    expect(hours).not.toBeNull();
    expect(freshnessOf(hours).label).toBeTruthy();
  });

  it("the roll still counts one human once", () => {
    const rows: RawRow[] = [
      { space: "profile", phone: "01001234567", name: "محمود" },
      { space: "order", phone: "+20 100 123 4567", name: "محمود" },
      { space: "form", name: "اسم بلا وسيلة وصول" },
      { space: "quote" },
    ];
    const lines = rollCustomers(rows);
    expect(lines.filter((l) => l.key === "phone:1001234567"), "two spaces, one man").toHaveLength(1);
    // A name alone is its own weak line, and a row with nothing to reach him by is counted
    // out loud as anonymous — the roll never invents a person and never drops one.
    expect(lines.some((l) => l.key === "name:اسم بلا وسيلة وصول" && l.kind === "weak-name")).toBe(true);
    expect(lines.find((l) => l.key === "anonymous")?.anonymous).toBe(1);
  });
});
