/**
 * lib/vanguard/consciousness/self_awareness.ts
 * =============================================
 * SelfAwarenessEngine — the system's ability to monitor its own performance,
 * detect degradation, and surface actionable self-assessments.
 *
 * Tracks: response quality trends, hallucination rates, conversion metrics,
 * error patterns, and behavioral drift.
 */

import { type ConsciousnessMetrics } from "./consciousness_core";
import { type GoalStatus, GoalPriority } from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════════════════════
// SELF-ASSESSMENT TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface PerformanceSignal {
  readonly metric: string;
  readonly value: number;
  readonly baseline: number;
  readonly trend: "improving" | "degrading" | "stable";
  readonly urgency: "none" | "low" | "medium" | "high" | "critical";
  readonly description: string;
  readonly timestamp: string;
}

export interface SelfAssessment {
  readonly overallHealth: number;  // 0.0–1.0
  readonly signals: PerformanceSignal[];
  readonly criticalIssues: string[];
  readonly recommendations: string[];
  readonly needsEvolution: boolean;
  readonly needsHumanIntervention: boolean;
  readonly assessedAt: string;
}

export interface BehaviorDrift {
  readonly detected: boolean;
  readonly description: string | null;
  readonly driftMagnitude: number; // 0.0–1.0
  readonly affectedDimensions: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// SELF-AWARENESS ENGINE
// ════════════════════════════════════════════════════════════════════════════

export class SelfAwarenessEngine {
  /** Rolling window of quality scores (last 100 interactions) */
  private qualityWindow: number[] = [];

  /** Rolling window of conversion outcomes */
  private conversionWindow: Array<{ converted: boolean; timestamp: string }> = [];

  /** Recent error codes */
  private recentErrors: Array<{ code: string; timestamp: string }> = [];

  /** Baseline metrics set at first assessment */
  private baselines: Record<string, number> = {};

  /** Historic assessment log */
  private assessmentHistory: SelfAssessment[] = [];

  // ── Public API ─────────────────────────────────────────────────────────

  /** Record an interaction quality score (0.0–1.0) */
  recordQuality(score: number): void {
    this.qualityWindow.push(Math.max(0, Math.min(1, score)));
    if (this.qualityWindow.length > 200) this.qualityWindow.shift();
  }

  /** Record a conversion event */
  recordConversion(converted: boolean): void {
    this.conversionWindow.push({ converted, timestamp: new Date().toISOString() });
    if (this.conversionWindow.length > 500) this.conversionWindow.shift();
  }

  /** Record an error */
  recordError(code: string): void {
    this.recentErrors.push({ code, timestamp: new Date().toISOString() });
    // Keep last 24h only
    const cutoff = Date.now() - 86_400_000;
    this.recentErrors = this.recentErrors.filter(
      (e) => new Date(e.timestamp).getTime() > cutoff
    );
  }

  /** Run a full self-assessment */
  assess(metrics: ConsciousnessMetrics): SelfAssessment {
    const signals = this.buildSignals(metrics);
    const criticalIssues = signals
      .filter((s) => s.urgency === "critical")
      .map((s) => s.description);
    const recommendations = this.buildRecommendations(signals);

    const overallHealth = this.computeOverallHealth(signals);
    const needsEvolution = overallHealth < 0.6 || signals.some((s) => s.urgency === "critical");
    const needsHumanIntervention =
      criticalIssues.length > 2 ||
      this.getErrorRate() > 0.15 ||
      metrics.goalsFailed > metrics.goalsCompleted * 2;

    const assessment: SelfAssessment = {
      overallHealth,
      signals,
      criticalIssues,
      recommendations,
      needsEvolution,
      needsHumanIntervention,
      assessedAt: new Date().toISOString(),
    };

    this.assessmentHistory.push(assessment);
    if (this.assessmentHistory.length > 100) this.assessmentHistory.shift();

    if (needsHumanIntervention) {
      logger.warn("[SelfAwareness] Human intervention needed", { criticalIssues });
    }

    return assessment;
  }

  /** Detect behavioral drift vs. the baseline assessment */
  detectDrift(): BehaviorDrift {
    if (this.assessmentHistory.length < 10) {
      return { detected: false, description: null, driftMagnitude: 0, affectedDimensions: [] };
    }

    const recentAvg = this.avg(
      this.assessmentHistory.slice(-5).map((a) => a.overallHealth)
    );
    const historicAvg = this.avg(
      this.assessmentHistory.slice(0, -5).map((a) => a.overallHealth)
    );

    const magnitude = Math.abs(recentAvg - historicAvg);
    const detected = magnitude > 0.15;
    const affectedDimensions: string[] = [];

    if (detected) {
      if (this.getConversionRate() < 0.1) affectedDimensions.push("conversion");
      if (this.getErrorRate() > 0.1) affectedDimensions.push("reliability");
      if (this.getAvgQuality() < 0.7) affectedDimensions.push("quality");
    }

    return {
      detected,
      description: detected
        ? `Overall health drifted by ${(magnitude * 100).toFixed(1)}% over last 5 assessments`
        : null,
      driftMagnitude: magnitude,
      affectedDimensions,
    };
  }

  /** Latest assessment */
  getLatestAssessment(): SelfAssessment | null {
    return this.assessmentHistory.at(-1) ?? null;
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  private buildSignals(metrics: ConsciousnessMetrics): PerformanceSignal[] {
    const signals: PerformanceSignal[] = [];
    const now = new Date().toISOString();

    // Quality signal
    const quality = this.getAvgQuality();
    const qualityBaseline = this.baselines.quality ?? 0.85;
    if (!this.baselines.quality) this.baselines.quality = quality;
    signals.push({
      metric: "avg_quality",
      value: quality,
      baseline: qualityBaseline,
      trend: quality >= qualityBaseline ? "stable" : quality > qualityBaseline * 0.85 ? "degrading" : "stable",
      urgency: quality < 0.6 ? "critical" : quality < 0.75 ? "high" : quality < 0.85 ? "medium" : "none",
      description: `متوسط جودة الردود: ${(quality * 100).toFixed(1)}%`,
      timestamp: now,
    });

    // Conversion rate signal
    const conversion = this.getConversionRate();
    const convBaseline = this.baselines.conversion ?? conversion;
    if (!this.baselines.conversion && this.conversionWindow.length > 10) {
      this.baselines.conversion = conversion;
    }
    signals.push({
      metric: "conversion_rate",
      value: conversion,
      baseline: convBaseline,
      trend: conversion >= convBaseline * 0.9 ? "stable" : "degrading",
      urgency: conversion < 0.05 ? "critical" : conversion < 0.1 ? "high" : conversion < 0.15 ? "medium" : "none",
      description: `معدل التحويل: ${(conversion * 100).toFixed(1)}%`,
      timestamp: now,
    });

    // Error rate signal
    const errorRate = this.getErrorRate();
    signals.push({
      metric: "error_rate",
      value: errorRate,
      baseline: 0.01,
      trend: errorRate <= 0.01 ? "stable" : errorRate <= 0.05 ? "degrading" : "degrading",
      urgency: errorRate > 0.15 ? "critical" : errorRate > 0.08 ? "high" : errorRate > 0.03 ? "medium" : "none",
      description: `معدل الأخطاء: ${(errorRate * 100).toFixed(1)}%`,
      timestamp: now,
    });

    // Goal completion signal
    const totalGoals = metrics.goalsCompleted + metrics.goalsFailed;
    const goalSuccessRate = totalGoals > 0 ? metrics.goalsCompleted / totalGoals : 1.0;
    signals.push({
      metric: "goal_success_rate",
      value: goalSuccessRate,
      baseline: 0.8,
      trend: goalSuccessRate >= 0.8 ? "stable" : "degrading",
      urgency: goalSuccessRate < 0.5 ? "critical" : goalSuccessRate < 0.65 ? "high" : "none",
      description: `معدل نجاح الأهداف: ${(goalSuccessRate * 100).toFixed(1)}%`,
      timestamp: now,
    });

    return signals;
  }

  private buildRecommendations(signals: PerformanceSignal[]): string[] {
    const recs: string[] = [];
    for (const signal of signals) {
      if (signal.urgency === "critical" || signal.urgency === "high") {
        switch (signal.metric) {
          case "avg_quality":
            recs.push("مراجعة نظام التحقق — جودة الردود منخفضة");
            break;
          case "conversion_rate":
            recs.push("تحليل نقاط الفشل في مسار التحويل وتعديل الاستراتيجية");
            break;
          case "error_rate":
            recs.push("فحص سجلات الأخطاء وإصلاح المسارات الفاشلة");
            break;
          case "goal_success_rate":
            recs.push("مراجعة تعريف الأهداف وتعديل معايير النجاح");
            break;
        }
      }
    }
    return [...new Set(recs)];
  }

  private computeOverallHealth(signals: PerformanceSignal[]): number {
    if (signals.length === 0) return 1.0;
    const urgencyWeights: Record<string, number> = {
      none: 1.0,
      low: 0.9,
      medium: 0.75,
      high: 0.5,
      critical: 0.1,
    };
    const weights = signals.map((s) => urgencyWeights[s.urgency] ?? 1.0);
    return weights.reduce((a, b) => a + b, 0) / weights.length;
  }

  private getAvgQuality(): number {
    if (this.qualityWindow.length === 0) return 0.9; // assume good until proven otherwise
    return this.avg(this.qualityWindow);
  }

  private getConversionRate(): number {
    if (this.conversionWindow.length === 0) return 0.12; // industry average
    const converted = this.conversionWindow.filter((c) => c.converted).length;
    return converted / this.conversionWindow.length;
  }

  private getErrorRate(): number {
    if (this.recentErrors.length === 0) return 0;
    // Errors in last hour vs. assumed total interactions
    const hourAgo = Date.now() - 3_600_000;
    const recentCount = this.recentErrors.filter(
      (e) => new Date(e.timestamp).getTime() > hourAgo
    ).length;
    // Assume ~60 interactions per hour as denominator
    return Math.min(1, recentCount / 60);
  }

  private avg(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}
