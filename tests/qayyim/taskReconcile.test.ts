// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isStaleRunning, STALE_RUNNING_MS, describeStale, type TaskRow } from "@/lib/qayyim/task-reconcile";

/**
 * P6-M5 — a task that never stopped is a task that never finished.
 *
 * Live case: the seed card told the owner «قيد المعالجة · 1 مهمة» off a
 * `status='running'` row started 2026-08-10 — 46 days earlier. A serverless
 * function cannot run for 46 days (the platform kills it at 60s); what actually
 * happened is the process died mid-task and nobody reconciled the row. Left
 * alone, the badge lies forever, and a badge that lies forever trains the owner
 * to ignore the one time it's telling the truth.
 */

const now = new Date("2026-09-25T20:00:00.000Z");
const row = (over: Partial<TaskRow> = {}): TaskRow => ({
  status: "running",
  started_at: new Date(now.getTime() - 60_000).toISOString(),
  created_at: new Date(now.getTime() - 60_000).toISOString(),
  ...over,
});

describe("isStaleRunning", () => {
  it("leaves a task that started a minute ago alone", () => {
    expect(isStaleRunning(row(), now)).toBe(false);
  });

  it("flags one that has been 'running' for 46 days", () => {
    const zombie = row({ started_at: new Date(now.getTime() - 46 * 86_400_000).toISOString() });
    expect(isStaleRunning(zombie, now)).toBe(true);
  });

  it("flags exactly at the boundary and not a second before it", () => {
    expect(isStaleRunning(row({ started_at: new Date(now.getTime() - STALE_RUNNING_MS).toISOString() }), now)).toBe(true);
    expect(isStaleRunning(row({ started_at: new Date(now.getTime() - STALE_RUNNING_MS + 1000).toISOString() }), now)).toBe(false);
  });

  // A row that never got a start time is judged by when it was created: a
  // `running` with no clock is exactly the shape a crashed writer leaves behind.
  it("falls back to created_at when started_at is missing", () => {
    expect(isStaleRunning(row({ started_at: null, created_at: new Date(now.getTime() - 3 * 86_400_000).toISOString() }), now)).toBe(true);
    expect(isStaleRunning(row({ started_at: null, created_at: new Date(now.getTime() - 3 * 86_400_000).toISOString() }), now)).toBe(true);
  });

  it("is not the business of finished or failed tasks", () => {
    const old = new Date(now.getTime() - 46 * 86_400_000).toISOString();
    expect(isStaleRunning(row({ status: "completed", started_at: old }), now)).toBe(false);
    expect(isStaleRunning(row({ status: "failed", started_at: old }), now)).toBe(false);
    expect(isStaleRunning(row({ status: "pending", started_at: null, created_at: old }), now)).toBe(false);
  });

  it("treats an unparseable timestamp as stale rather than as forever running", () => {
    expect(isStaleRunning(row({ started_at: "not-a-date", created_at: "not-a-date" }), now)).toBe(true);
  });
});

describe("describeStale", () => {
  it("says how long it had been claiming to work", () => {
    const text = describeStale(row({ started_at: new Date(now.getTime() - 46 * 86_400_000).toISOString() }), now);
    expect(text).toContain("46");
    expect(text).toContain("يوم");
    expect(text).not.toContain("/");
  });
});
