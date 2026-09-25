import "server-only";
/**
 * الجولة اليومية الاستباقية — the round itself, moved out of the cron route so
 * it has two triggers:
 *
 *  1. Vercel's schedule (`/api/cron/qayyim-daily`, 0 7 * * *) — the primary.
 *  2. A backstop from the commander's own turn: when the last round on record
 *     is older than `ROUND_STALE_MS`, the next admin chat fires it. The platform
 *     scheduler is demonstrably unreliable here (it registers the job and never
 *     lands a row), and a swarm that reports "all clear" while asleep is the
 *     exact thing P6 exists to prevent.
 *
 * The backstop is best-effort: a serverless instance can be frozen as soon as
 * the reply is sent, so it is not a guarantee — the freshness line in the world
 * digest is what makes the difference visible instead of silent.
 */
import { resolveAdminCompanyId } from "@/lib/admin-company";
import { syncLayer } from "@/lib/qayyim/memory/SyncLayer";
import { createAdminProposal } from "@/lib/admin-sovereign-mind";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { roundFreshness, ROUND_STALE_MS } from "@/lib/qayyim/round-freshness";

export interface DailyRoundResults {
  luxuryScore: number | null;
  luxurySignals?: unknown;
  luxuryNote?: string;
  atRiskGoals: unknown[];
  goalsSummary?: string;
  goalsReadError?: string;
  activeGoals?: number;
  proposalCreated: boolean;
  rivals: unknown;
  /** Traffic watchdog result: { windowDays, events, hits, digest }. */
  anomaly?: unknown;
  anomalyDigest?: string;
  anomalyReadError?: string;
  /** P6-M4: the morning report on Telegram — reported, never assumed. */
  telegramSent?: boolean;
  telegramReason?: string;
  telegramHref?: string;
  proposalId?: string | null;
  errors: string[];
  [k: string]: unknown;
}

export interface DailyRoundOutcome {
  success: boolean;
  results?: DailyRoundResults;
  error?: string;
  skipped?: string;
}

export async function executeDailyRound(): Promise<DailyRoundOutcome> {
  const companyId = await resolveAdminCompanyId();
  if (!companyId) return { success: false, error: "No company configured" };

  const results: DailyRoundResults = {
    luxuryScore: null,
    atRiskGoals: [],
    proposalCreated: false,
    rivals: null,
    errors: [],
  };

  // (a) Luxury score — measured from real signals (images, prices, SEO, load,
  // alt text), not from asking a model how luxurious the shop feels.
  try {
    const { runLuxuryScore } = await import("@/lib/qayyim/luxury-v2");
    const lux = await runLuxuryScore(companyId);
    if (lux.luxury_score !== null) {
      results.luxuryScore = lux.luxury_score;
      results.luxurySignals = lux.signals;
    } else {
      results.luxuryNote = `لم تُقاس أي إشارة (غير متاح: ${lux.missing.join("، ")})`;
      results.errors.push(`Luxury score: ${results.luxuryNote}`);
    }
  } catch (e: any) {
    results.luxuryNote = `استثناء: ${e.message}`;
    results.errors.push(`Luxury score: ${e.message}`);
  }

  // (b) At-risk goals, through the same helper the `qayyim_goals_risk` tool
  // uses, so the two cannot disagree and a failed read is never an all-clear.
  try {
    const { assessGoals, renderGoalRisk } = await import("@/lib/qayyim/goal-risk");
    const { data, error } = await supabaseServer
      .from("qayyim_goals")
      .select("id,name,target_value,current_value,deadline,status")
      .eq("company_id", companyId)
      .eq("status", "active");

    if (error) {
      results.errors.push(`الأهداف: ${error.message}`);
      results.goalsReadError = error.message;
    } else {
      const goals = data || [];
      results.atRiskGoals = assessGoals(goals);
      results.goalsSummary = renderGoalRisk(goals, null, results.atRiskGoals as any);
      results.activeGoals = goals.length;
    }
  } catch (e: any) {
    results.errors.push(`Goals query: ${e.message}`);
    results.goalsReadError = e.message;
  }

  // (c) P6-M3 traffic watchdog — a robust z-score over a month of daily visitor
  // events, reported only for the recent edge so one old spike cannot generate a
  // proposal every morning forever.
  try {
    const { scanTrafficAnomalies, renderAnomalyDigest } = await import("@/lib/qayyim/anomaly");
    const scan = await scanTrafficAnomalies({ days: 28 });
    if (scan.error) {
      results.errors.push(`مراقبة حركة الزوار: ${scan.error}`);
      results.anomalyReadError = scan.error;
    } else {
      const digest = renderAnomalyDigest(scan.hits);
      results.anomaly = { windowDays: scan.windowDays, events: scan.totalEvents, hits: scan.hits, digest };
      results.anomalyDigest = digest;
    }
  } catch (e: any) {
    results.errors.push(`مراقبة حركة الزوار: ${e.message}`);
    results.anomalyReadError = e.message;
  }

  // (d) Publish the round so the dashboard and the swarm see it happened.
  try {
    await syncLayer.initialize(companyId);
    await syncLayer.publish({
      event_type: "context_update",
      source_agent: "qayyim-core",
      target_agents: [],
      payload: {
        kind: "daily_round",
        luxuryScore: results.luxuryScore,
        luxuryNote: results.luxuryNote ?? null,
        // Stored so the score can be re-checked later without re-probing.
        luxurySignals: results.luxurySignals ?? null,
        activeGoals: results.activeGoals ?? 0,
        atRiskGoals: results.atRiskGoals,
        goalsSummary: results.goalsSummary ?? null,
        goalsReadError: results.goalsReadError ?? null,
        anomalyDigest: results.anomalyDigest ?? null,
        anomalyReadError: results.anomalyReadError ?? null,
      },
    });

    const hits = (results.anomaly as { hits?: unknown[] } | null)?.hits ?? [];
    if (hits.length) {
      await syncLayer.publish({
        event_type: "anomaly_detected",
        source_agent: "qayyim-ana",
        target_agents: [],
        payload: { kind: "traffic_anomaly", hits, digest: results.anomalyDigest ?? null },
      });
    }
  } catch (e: any) {
    results.errors.push(`SyncLayer publish: ${e.message}`);
  }

  // (e) One proposal, only when something actually needs the owner.
  const anomalyHits = (results.anomaly as { hits?: unknown[] } | null)?.hits ?? [];
  const needsIntervention =
    results.atRiskGoals.length > 0 ||
    (results.luxuryScore !== null && results.luxuryScore < 70) ||
    anomalyHits.length > 0;

  if (needsIntervention) {
    try {
      const atRisk = results.atRiskGoals as Array<{ name: string; progressPct: number | null; reasons: string[] }>;
      const description =
        `نظام قيّم الدار يحتاج مراجعتك:\n\n` +
        `• مستوى الفخامة (مقيس): ${results.luxuryScore ?? results.luxuryNote ?? "غير متاح"}\n` +
        `• عدد الأهداف المهددة: ${atRisk.length}\n\n` +
        (atRisk.length
          ? `الأهداف المهددة:\n${atRisk
              .slice(0, 3)
              .map((g) => `  - ${g.name} (${g.progressPct === null ? "غير قابل للقياس" : `تقدم ${g.progressPct}%`} · ${g.reasons.join("، ")})`)
              .join("\n")}\n\n`
          : "") +
        (anomalyHits.length ? `حركة الزوار فيها يوم مش طبيعي:\n${results.anomalyDigest}\n\n` : "") +
        `الرجاء مراجعة لوحة قيّم الدار واتخاذ الإجراء المناسب.`;

      const proposal = await createAdminProposal({
        title: "تقرير مدير تشغيل المحتوى اليومي — يتطلب تدخل",
        description,
        reasoning: "جولة يومية مجدولة",
        userMessage: "راجع الأهداف المهددة واقتراحات النشر",
        intent: { kind: "analytics", analyticsDays: 7, confidence: 0.8 },
        userEmail: process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim(),
        proactive: true,
      });

      results.proposalCreated = proposal.success;
      results.proposalId = proposal.requestId ?? null;
      if (!proposal.success) results.errors.push(`Proposal creation: ${proposal.error}`);
    } catch (e: any) {
      results.errors.push(`Proposal creation: ${e.message}`);
    }
  }

  // (f) Weekly competitor read. The platform schedule stays daily (Hobby limit),
  // so the weekday gate lives here rather than in vercel.json.
  if (new Date().getUTCDay() === 1) {
    try {
      const { runRivalsWeekly } = await import("@/lib/qayyim/rivals");
      const r = await runRivalsWeekly(companyId, { budgetMs: 35_000 });
      results.rivals = { crawled: r.crawled, failed: r.failed, skipped: r.skipped, errors: r.errors };
      if (r.crawled || r.failed || r.skipped.length) {
        await syncLayer.publish({
          event_type: "market_update",
          source_agent: "qayyim-seo",
          target_agents: [],
          payload: { kind: "rivals_weekly", digest: r.digest, crawled: r.crawled, failed: r.failed, skipped: r.skipped },
        });
      }
    } catch (e: any) {
      results.errors.push(`قياس المنافسين: ${e.message}`);
    }
  }

  // (g) P6-M5 — close tasks that are "running" only because their process died.
  // Without this the ledger keeps rows open for weeks and every count built on
  // them (including the card's busy dot) reports work that stopped happening.
  try {
    const { reconcileStaleTasks } = await import("@/lib/qayyim/task-reconcile");
    const sweep = await reconcileStaleTasks();
    results.staleTasksClosed = sweep.closed;
    if (sweep.error) results.errors.push(`إغلاق المهام المعلقة: ${sweep.error}`);
  } catch (e: any) {
    results.errors.push(`إغلاق المهام المعلقة: ${e.message}`);
  }

  // (h) P6-M4 — the morning story on the owner's phone, through the store's
  // existing Telegram transport (no second config, no second sender). A round
  // that ran and a round that reached him are two different facts, so the result
  // says which one happened instead of leaving him to discover the difference.
  try {
    const [{ getActiveTelegramConfig, sendTelegramMessage }, { buildDailyStory, renderTelegramHtml }] = await Promise.all([
      import("@/lib/telegram-config"),
      import("@/lib/qayyim/daily-story"),
    ]);
    const cfg = await getActiveTelegramConfig();
    const rivalRead = results.rivals as { crawled: number; failed: number; skipped: number } | null | undefined;
    const story = buildDailyStory({
      dateKey: new Date().toISOString().slice(0, 10),
      luxuryScore: results.luxuryScore,
      luxuryNote: results.luxuryNote ?? null,
      activeGoals: results.activeGoals ?? null,
      atRiskCount: results.atRiskGoals.length,
      goalsSummary: results.goalsSummary ?? null,
      anomalyDigest: results.anomalyDigest ?? null,
      anomalyReadError: results.anomalyReadError ?? null,
      rivals: rivalRead ? { crawled: rivalRead.crawled, failed: rivalRead.failed, skipped: rivalRead.skipped } : null,
      errors: results.errors,
      proposalId: results.proposalId ?? null,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    });
    results.telegramHref = story.href;

    if (!cfg.botToken) {
      results.telegramSent = false;
      results.telegramReason = "مفيش مفتاح بوت تليجرام مضبوط — التقرير اتكتب بس ما اتبعتش.";
    } else if (!cfg.chatId) {
      results.telegramSent = false;
      results.telegramReason = "مفيش محادثة تليجرام مضبوطة — البعثة مستحيلة.";
    } else if (!cfg.enabled) {
      results.telegramSent = false;
      results.telegramReason = "تنبيهات تليجرام مقفولة في الإعدادات.";
    } else {
      // A routine report arrives silently; the one that needs his signature makes
      // the noise. Two alarms a day is how notifications get muted forever.
      const ok = await sendTelegramMessage(renderTelegramHtml(story), { silent: !needsIntervention });
      results.telegramSent = ok;
      results.telegramReason = ok ? "التقرير اليومي وصل" : "البوت رفض البعثة — راجع المفتاح والمحادثة";
      if (!ok) results.errors.push("Telegram: البعثة فشلت");
    }
  } catch (e: any) {
    results.telegramSent = false;
    results.telegramReason = `استثناء: ${e.message}`;
    results.errors.push(`Telegram: ${e.message}`);
  }

  return { success: true, results };
}

let inFlight: Promise<DailyRoundOutcome> | null = null;

/** Fire the round only if the recorded last run is overdue. Never concurrent. */
export async function ensureDailyRound(companyId: string | null): Promise<DailyRoundOutcome> {
  if (!companyId) return { success: false, skipped: "no company" };
  if (inFlight) return { success: true, skipped: "already running" };

  const fresh = await roundFreshness(companyId);
  if (!fresh.overdue) return { success: true, skipped: `fresh (${fresh.ageHours}h)` };

  inFlight = executeDailyRound().finally(() => {
    inFlight = null;
  });
  try {
    return await inFlight;
  } catch (e: any) {
    return { success: false, error: e?.message || "round failed" };
  }
}

export { ROUND_STALE_MS };
