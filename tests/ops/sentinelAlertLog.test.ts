// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

import {
  alertCategoryAr,
  healthStatusFor,
  logNoteFor,
  logStateFor,
  muteIsLive,
  muteUntilFrom,
  recommendationsFor,
  MUTE_WINDOW_HOURS,
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
    mutedCount: 0,
    newestMuteUntil: null,
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

describe("the day a reviewed alert keeps quiet", () => {
  // The owner's word on 2026-10-11: a dismissed fault should not come back on the next refresh, but
  // the window must end — hiding a fault forever is the failure this guards against.
  const now = new Date("2026-10-11T10:00:00.000Z");

  it("is the length he named, measured off the clock it is given", () => {
    expect(MUTE_WINDOW_HOURS).toBe(24);
    expect(muteUntilFrom(now)).toBe("2026-10-12T10:00:00.000Z");
  });

  it("covers a condition only until its own deadline", () => {
    expect(muteIsLive("2026-10-11T10:00:01.000Z", now)).toBe(true);
    expect(muteIsLive("2026-10-11T09:59:59.000Z", now)).toBe(false);
    expect(muteIsLive(null, now)).toBe(false);
    expect(muteIsLive(undefined, now)).toBe(false);
    expect(muteIsLive("not a date", now)).toBe(false);
  });

  it("says out loud that something is muted, and until when", () => {
    const note = logNoteFor("recorded", reading({
      pendingTotal: 0,
      mutedCount: 2,
      newestMuteUntil: "2026-10-12T10:00:00.000Z",
    }));
    expect(note).toContain("مكتوم");
    expect(note).toContain("لحد");
    expect(note).toContain("لو السبب رجع");
    expect(note).not.toMatch(/[A-Za-z]/);
    expect(note).not.toMatch(/[0-9]/);
  });

  it("keeps the mute visible beside alerts that still wait", () => {
    const note = logNoteFor("recorded", reading({
      pendingTotal: 1,
      mutedCount: 1,
      newestMuteUntil: "2026-10-12T10:00:00.000Z",
    }));
    expect(note).toContain("تنبيه مستني قرار");
    expect(note).toContain("مكتوم");
  });

  it("does not let a mute turn an empty log into a clean bill of health", () => {
    const note = logNoteFor("empty", reading({ totalLogged: 0, newestSeenAt: null, mutedCount: 1, newestMuteUntil: "2026-10-12T10:00:00.000Z" }));
    expect(note).toContain("فاضي من أول الطلب");
    expect(note).toContain("مش معناه");
  });

  it("is written by the review button and consulted before any new row", () => {
    expect(sentinel).toContain('const MUTES_TABLE = "system_alert_mutes"');
    expect(sentinel).toMatch(/from\(MUTES_TABLE\)[\s\S]{0,160}eq\("dedupe_key"/);
    expect(sentinel).toMatch(/upsert\(\{ dedupe_key: row\.dedupe_key, alert_id: alertId, muted_until: mutedUntil \}/);
    // The guard has to run before the row is written, not after.
    expect(sentinel.indexOf("is muted until")).toBeLessThan(sentinel.indexOf("const fields = {"));
  });

  it("mutes a reviewed alert only — a fix that ran must be able to fail again", () => {
    const dismissBody = sentinel.slice(sentinel.indexOf("export async function dismissAlert"), sentinel.indexOf("export async function logSystemEvent"));
    const resolveBody = sentinel.slice(sentinel.indexOf("export async function applyAutoFix"), sentinel.indexOf("async function readAlertById"));
    expect(dismissBody).toContain("muteUntilFrom(new Date())");
    expect(resolveBody).not.toContain("MUTES_TABLE");
    expect(sentinel.match(/muteUntilFrom\(new Date\(\)\)/g)?.length).toBe(1);
  });

  it("ships the ledger with security on and no cascade that could erase a decision", () => {
    const sql = readFileSync("supabase/migrations/20261011_b_system_alert_mutes.sql", "utf8");
    expect(sql).toContain("create table if not exists public.system_alert_mutes");
    expect(sql).toContain("alter table public.system_alert_mutes enable row level security");
    expect(sql).toContain('to service_role using (true) with check (true)');
    expect(sql).toContain("on delete set null");
    // A foreign key that clears itself is fine; a statement that removes rows or the table is not.
    expect(sql).not.toMatch(/delete\s+from/i);
    expect(sql).not.toMatch(/\bdrop\b/i);
  });
});
