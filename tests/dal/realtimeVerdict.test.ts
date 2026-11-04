// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { publishedRealtimeTables, realtimeChannelVerdict } from "@/lib/dal/realtime-verdict";

/**
 * A live channel may only open for a table the record itself publishes.
 *
 * Measured 2026-11-04 (scratch/measure-realtime-publication.mjs): the store's realtime
 * publication carries 5 tables — consultant_sessions, product_categories,
 * product_inventory_log, products, reality_mutations. Neither event table is among them, and
 * `agent_events` holds 4 seeded rows last written 2026-08-10. So the channel the data layer
 * used to open for alerts was a subscription that could never deliver one message: it opens,
 * the callback stays quiet, and the caller believes it has a feed.
 */

const snapshot = JSON.parse(readFileSync("lib/dal/record-schema.json", "utf8")) as {
  measuredAt: string;
  realtime?: { publication: string; measuredAt: string; publishedTables: string[] };
};

describe("the realtime verdict", () => {
  it("reads the published list from the measured snapshot, not from code", () => {
    expect(snapshot.realtime?.publication).toBe("supabase_realtime");
    expect(snapshot.realtime?.measuredAt).toBeTruthy();
    expect(publishedRealtimeTables()).toEqual(snapshot.realtime?.publishedTables);
    expect(publishedRealtimeTables().length).toBeGreaterThan(0);
  });

  it("refuses a channel for a table the record does not publish", () => {
    for (const table of ["agent_events", "ops_sync_events"]) {
      const verdict = realtimeChannelVerdict(table);
      expect(verdict.usable).toBe(false);
      expect(verdict.reason).toBe("not-published");
      expect(verdict.measuredAt).toBe(snapshot.realtime?.measuredAt);
    }
  });

  it("opens a channel for a table the record does publish", () => {
    for (const table of publishedRealtimeTables()) {
      const verdict = realtimeChannelVerdict(table);
      expect(verdict.usable).toBe(true);
      expect(verdict.reason).toBe("published");
    }
  });

  it("names a missing measurement instead of trusting every table", () => {
    const verdict = realtimeChannelVerdict("anything", []);
    expect(verdict.usable).toBe(false);
    expect(verdict.reason).toBe("unmeasured");
    expect(verdict.publishedCount).toBe(0);
  });

  it("checks the verdict before the data layer opens a channel", () => {
    const dal = readFileSync("lib/dal/unified-supabase.ts", "utf8");
    const block = dal.slice(dal.indexOf("export const realtimeDAL"));
    expect(block.indexOf("realtimeChannelVerdict(table)")).toBeGreaterThanOrEqual(0);
    expect(block.indexOf(".channel(")).toBeGreaterThan(block.indexOf("realtimeChannelVerdict(table)"));
    expect(block).toContain("subscribed: false");
    expect(block).toContain("no live channel for");
  });

  it("keeps the alert ledger as the only source of the owner's alerts", () => {
    const dal = readFileSync("lib/dal/unified-supabase.ts", "utf8");
    expect(dal).not.toMatch(/from\(\s*['"`]agent_events/);
    expect(dal).toContain("lib/ops/alerts.ts");
  });
});
