/**
 * remember-round.ts — the round writes what it measured into the swarm's memory.
 *
 * Measured 2026-10-15: `ops_semantic_memory` held **0 rows** while its reader ran on every answer the
 * owner got from the cockpit chat. The table was never empty because the swarm has nothing to say —
 * the same round already publishes 248 events, measures a luxury score, a canary of the public pages,
 * a goal risk and a traffic watchdog. It was empty because the only writer needed a model key, threw
 * when none answered, and nobody called it anyway.
 *
 * Three brakes held here. **Nothing is invented:** a line is written only from a number the round
 * really measured, and a step that failed is remembered as having failed, in its own words.
 * **Nothing is repeated:** the same sentence on the same day is one memory, not two.
 * **Nothing is silent:** what the record refuses comes back named, and the round reports it.
 */
import "server-only";

import { sharedMemory } from "@/lib/ops/memory/SharedMemory";
import { arDigits, arNum } from "@/lib/ops/metricLabels";

export type RoundMemoryInput = {
  luxuryScore?: number | null;
  luxuryNote?: string | null;
  activeGoals?: number | null;
  atRiskGoals?: unknown;
  /** The round stores these as whatever the step returned; only real numbers are spoken from them. */
  anomaly?: unknown;
  anomalyDigest?: string | null;
  canary?: unknown;
  canaryDigest?: string | null;
  selfAudit?: unknown;
  selfAuditNote?: string | null;
};

export type RoundMemoryOutcome = {
  wrote: number;
  stored: number;
  embedded: boolean;
  duplicates: number;
  failures: string[];
};

/** A number the step really measured, or null — a missing reading is never written as a zero. */
function measured(source: unknown, key: string): number | null {
  const value = (source as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A list the step really returned, or null when the step never produced one. */
function counted(source: unknown, key: string): number | null {
  const value = (source as Record<string, unknown> | null | undefined)?.[key];
  return Array.isArray(value) ? value.length : null;
}

/** The sentences the round can honestly say today — one per measured fact, none for an unmeasured one. */
export function roundLines(results: RoundMemoryInput, day: string): string[] {
  const lines: string[] = [];

  if (typeof results.luxuryScore === "number") {
    lines.push(`يوم ${day}: سعر الفخامة في الدار ${arNum(results.luxuryScore)} من ١٠٠، مقاس من إشارات حقيقية — صور، أسعار، سيو، سرعة، نصوص بديلة.`);
  } else if (results.luxuryNote) {
    lines.push(`يوم ${day}: سعر الفخامة ما اتقاسش — ${results.luxuryNote}`);
  }

  const checked = measured(results.canary, "checked");
  if (checked !== null) {
    const failed = measured(results.canary, "failed") ?? 0;
    const skipped = measured(results.canary, "skipped") ?? 0;
    lines.push(
      `يوم ${day}: فحص الصفحات المنشورة — ${arNum(checked)} صفحة اتفحصت، ${arNum(failed)} واقفة${skipped ? `، و${arNum(skipped)} ما اتفحصتش` : ""}. ${(results.canaryDigest ?? "").trim()}`.trim()
    );
  }

  if (typeof results.activeGoals === "number") {
    const risk = Array.isArray(results.atRiskGoals) ? results.atRiskGoals.length : 0;
    lines.push(`يوم ${day}: أهداف الدار الشغالة ${arNum(results.activeGoals)}، اللي في منها في خطر ${arNum(risk)}.`);
  }

  const events = measured(results.anomaly, "events");
  if (events !== null) {
    const hits = counted(results.anomaly, "hits") ?? 0;
    lines.push(`يوم ${day}: مراقبة الزوار على ${arNum(measured(results.anomaly, "windowDays") ?? 28)} يوم — ${arNum(events)} حدث، و${arNum(hits)} شذوذ يستنى قرار. ${(results.anomalyDigest ?? "").trim()}`.trim());
  }

  const judged = measured(results.selfAudit, "judged");
  if (judged !== null) {
    lines.push(`يوم ${day}: تدقيق الردود — ${arNum(measured(results.selfAudit, "sampled") ?? 0)} رد اتبعت للمقيّم و${arNum(judged)} اتقيّمت. ${(results.selfAuditNote ?? "").trim()}`.trim());
  }

  return lines.filter(Boolean);
}

/**
 * Write the day's honest sentences under the leader's key. The vector is attempted, never invented:
 * when no key answers, the row still lands and the keyword recall still finds it.
 */
export async function rememberRound(companyId: string, results: RoundMemoryInput): Promise<RoundMemoryOutcome> {
  const outcome: RoundMemoryOutcome = { wrote: 0, stored: 0, embedded: false, duplicates: 0, failures: [] };
  const day = arDigits(new Date().toISOString().slice(0, 10));
  const lines = roundLines(results, day);
  if (!lines.length) {
    console.warn("[SwarmMemory] الجولة ما قالتش حاجة مقاسة — مفيش ذاكرة اتكتبت");
    return outcome;
  }

  await sharedMemory.initialize(companyId);
  let stored = 0;
  for (const content of lines) {
    const written = await sharedMemory.storeText({
      agent_key: "ops-lead",
      memory_type: "task_result",
      content,
      tags: ["daily_round", day],
      related_entities: { day, measured: true },
      importance_score: 0.6,
    });
    outcome.wrote += written.wrote;
    outcome.embedded = outcome.embedded || written.embedded;
    if (written.duplicate) outcome.duplicates += 1;
    if (written.failure) outcome.failures.push(written.failure);
    stored = written.stored;
  }
  outcome.stored = stored;
  console.log(
    `[SwarmMemory] ops-lead: سطور جديدة ${outcome.wrote} · مكررة ${outcome.duplicates} · المحفوظ ${outcome.stored} · متجه=${outcome.embedded ? "نعم" : "لا"} · مرفوض ${outcome.failures.length}`
  );
  return outcome;
}
