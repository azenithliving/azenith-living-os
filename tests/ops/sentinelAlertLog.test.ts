// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

import {
  alertCategoryAr,
  healthStatusFor,
  logNoteFor,
  logStateFor,
  recommendationsFor,
  type AlertCategory,
  type LogReading,
} from "@/lib/sentinel-report";

/**
 * The watcher's log has to outlive the request that wrote it, and a reading that came from nothing
 * must never be printed as a clean bill of health.
 *
 * Measured 2026-10-10: `lib/sentinel.ts` kept its alerts in a `Map` beside its own code. On this
 * host every request is served by a function that starts empty, so the door answered «مفيش تنبيهات»
 * forever and the screen showed a green tick over a zero nobody had measured. These guards hold the
 * two halves of the fix: the log lives in a table, and the three possible readings of that table each
 * say what they are.
 */

const sentinel = readFileSync("lib/sentinel.ts", "utf8");
const migrationPath = "supabase/migrations/20261011_a_system_alerts.sql";

function reading(over: Partial<LogReading> = {}): LogReading {
  return {
    readable: true,
    totalLogged: 4,
    pendingCritical: 0,
    pendingWarning: 0,
    pendingTotal: 0,
    dbReachable: true,
    newestSeenAt: "2026-10-11T09:00:00.000Z",
    ...over,
  };
}

describe("the alert log is a table, not a variable", () => {
  it("holds no in-memory alert store any more", () => {
    expect(sentinel).not.toContain("alertStore");
    expect(sentinel).not.toMatch(/new Map<string, SystemAlert>/);
    expect(sentinel).not.toMatch(/Array\.from\(.*\.values\(\)/);
  });

  it("writes and reads through the log table", () => {
    expect(sentinel).toContain('const ALERTS_TABLE = "system_alerts"');
    expect(sentinel).toMatch(/from\(ALERTS_TABLE\)/);
  });

  it("ships the table with security on and one service policy", () => {
    expect(existsSync(migrationPath), migrationPath).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create table if not exists public.system_alerts");
    expect(sql).toContain("alter table public.system_alerts enable row level security");
    expect(sql).toContain('to service_role using (true) with check (true)');
    // The open-condition key is what stops one recurring fault from becoming a hundred identical rows.
    expect(sql).toContain("dedupe_key text unique");
    expect(sql).toContain("occurrences integer not null default 1");
  });

  it("hands the dedupe key back when an alert is decided", () => {
    // A decided row that kept its key would block the same fault from ever being recorded again.
    expect(sentinel).toMatch(/resolved_at: now, dedupe_key: null/);
  });

  it("only closes an alert on a fix that actually ran", () => {
    // The old path wrote `resolved` even when the auto-fix refused, deciding an alert nothing did.
    expect(sentinel).toMatch(/return await applyAutoFix\(alertId\);/);
    expect(sentinel).not.toMatch(/await applyAutoFix\(alertId\);\s*\n\s*alert\.status = "resolved"/);
  });

  it("measures its memory threshold instead of inventing one", () => {
    // The constant it used to compare against (512 megabytes) was set by nobody.
    expect(sentinel).toContain("memoryCeilingMB");
    expect(sentinel).toContain("/sys/fs/cgroup/memory.max");
    expect(sentinel).not.toContain("thresholdMB: number = 512");
  });

  it("has a producer for the api alert it used to only describe", () => {
    // Nothing in the store ever called an api monitor, so that sentence could never be written.
    expect(sentinel).toContain("watchProviderKeys");
    expect(sentinel).toMatch(/from\("api_keys"\)/);
    expect(sentinel).toMatch(/gte\("error_count", 3\)/);
  });
});

describe("the three readings of the log", () => {
  it("keeps an answered log, an empty log, and no answer apart", () => {
    expect(logStateFor(reading())).toBe("recorded");
    expect(logStateFor(reading({ totalLogged: 0 }))).toBe("empty");
    expect(logStateFor(reading({ readable: false, totalLogged: null }))).toBe("unreadable");
    // A read that failed is never allowed to look like an empty log.
    expect(logStateFor(reading({ readable: false }))).toBe("unreadable");
  });

  it("never reports سليم while the log could not be read", () => {
    expect(healthStatusFor(reading({ readable: false, totalLogged: null }))).not.toBe("healthy");
    expect(healthStatusFor(reading())).toBe("healthy");
    expect(healthStatusFor(reading({ pendingCritical: 1 }))).toBe("critical");
    expect(healthStatusFor(reading({ pendingWarning: 3 }))).toBe("degraded");
    // The store refusing the connection is the most serious thing this page can learn.
    expect(healthStatusFor(reading({ dbReachable: false }))).toBe("critical");
  });

  it("says out loud that an empty log is not a clean bill of health", () => {
    const note = logNoteFor("empty", reading({ totalLogged: 0, newestSeenAt: null }));
    expect(note).toContain("فاضي");
    expect(note).toContain("مش معناه");
    expect(note).not.toMatch(/[A-Za-z]{3,}/);
  });

  it("says the reading failed rather than counting zero alerts", () => {
    const note = logNoteFor("unreadable", reading({ readable: false, totalLogged: null, newestSeenAt: null }));
    expect(note).toContain("ما قرئتش");
    expect(note).toContain("مش شهادة سلامة");
  });

  it("counts what waits for a decision, in his digits", () => {
    const note = logNoteFor("recorded", reading({ pendingTotal: 3 }));
    expect(note).toContain("٣ تنبيه مستني قرار");
    expect(note).not.toMatch(/[0-9]/);
  });

  it("states the recorded history when nothing waits", () => {
    const note = logNoteFor("recorded", reading({ pendingTotal: 0, totalLogged: 12 }));
    expect(note).toContain("مفيش تنبيه مستني قرار");
    expect(note).toContain("١٢ قراءة");
  });

  it("warns him not to trust the page when the log did not answer", () => {
    const recommendations = recommendationsFor(reading({ readable: false, totalLogged: null }), "unreadable");
    expect(recommendations.some((line) => line.includes("متعتمدش"))).toBe(true);
  });

  it("does not pad the recommendations with praise", () => {
    const quiet = recommendationsFor(reading(), "recorded");
    expect(quiet.filter((line) => /سليمة|ممتازة|تمام|تهنئة/.test(line))).toEqual([]);
  });

  it("names every category in his words, never by its machine key", () => {
    const categories: AlertCategory[] = ["api", "database", "cache", "memory", "external"];
    for (const category of categories) {
      const label = alertCategoryAr(category);
      expect(label).not.toBe(category);
      expect(label).not.toMatch(/[A-Za-z]{3,}/);
      expect(label.length).toBeGreaterThan(2);
    }
    expect(alertCategoryAr("unknown" as AlertCategory)).toBe("حالة عامة");
  });
});
