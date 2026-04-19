/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    SOVEREIGN STATUS REPORT - Proactive Entry               ║
 * ║              Imperial Briefing | Empire Status | Autonomous Innovations    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * The Manager does not wait for "Hello." Upon entry, it provides a Sovereign 
 * Status Report: "Sir Azenith, the Empire is 100% stable. I have optimized 
 * 4 business modules and prepared a new growth strategy for your review."
 */

import { createClient } from "@supabase/supabase-js";
import { infiniteSwarm } from "./swarm-consensus";
import { marketSimulator } from "./market-simulator";
import { atomicState } from "./atomic-state";
import { selfOptimization } from "./self-optimization";
import { predatoryDefense } from "./predatory-defense";
import { semanticCache } from "./semantic-cache";
import { predictiveCoding } from "./predictive-coding";

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface SovereignStatusReport {
  timestamp: Date;
  sessionId: string;
  empireStatus: {
    stability: number; // 0-100
    threatLevel: "none" | "low" | "elevated" | "critical";
    operationsStatus: "optimal" | "normal" | "degraded";
    message: string;
  };
  swarm: {
    collectiveIntelligence: number;
    activeNodes: number;
    consensusRate: number;
    health: string;
  };
  opportunities: {
    count: number;
    totalRevenuePotential: number;
    readyToDeploy: number;
    topOpportunity: {
      title: string;
      revenue: number;
      preview?: string;
    } | null;
  };
  optimizations: {
    modulesOptimized: number;
    timeSaved: number;
    efficiencyGain: number;
    lastOptimization: string;
  };
  defense: {
    threatsBlocked: number;
    systemHealth: string;
    activeMonitoring: boolean;
  };
  predictive: {
    modulesGenerated: number;
    patternsDetected: number;
    suggestions: string[];
  };
  greeting: string;
  summary: string;
  actions: Array<{
    label: string;
    action: string;
    priority: "high" | "medium" | "low";
  }>;
}

// ==========================================
// SOVEREIGN STATUS GENERATOR
// ==========================================

export class SovereignStatusGenerator {
  private _supabase: ReturnType<typeof createClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Missing Supabase credentials");
      this._supabase = createClient(url, key);
    }
    return this._supabase;
  }

  private imperialTitles = [
    "Sir Azenith",
    "My Liege",
    "Emperor",
    "Master",
    "Lord of the Empire",
    "Sovereign",
  ];

  private stabilityMessages: Record<number, string[]> = {
    90: [
      "The Empire stands unshakable. All systems operate at peak efficiency.",
      "Your domain thrives. Every metric reports excellence.",
      "The realm is secure and prosperous. Operations proceed flawlessly.",
    ],
    70: [
      "The Empire remains strong with minor optimizations in progress.",
      "Your realm is stable. I am fine-tuning several systems for enhanced performance.",
      "All critical systems operational. Enhancing auxiliary functions.",
    ],
    50: [
      "The Empire faces minor challenges. Countermeasures deployed.",
      "Your domain requires attention in several areas. I have initiated remedial protocols.",
      "Systems are functional but not optimal. Adjustments underway.",
    ],
    0: [
      "The Empire requires immediate attention. Critical systems affected.",
      "Emergency protocols active. Awaiting your command.",
      "Multiple systems compromised. Recommend immediate strategic review.",
    ],
  };

  // ==========================================
  // STATUS REPORT GENERATION
  // ==========================================

  async generateReport(sessionId: string): Promise<SovereignStatusReport> {
    const startTime = Date.now();

    // Gather all system intelligence in parallel
    const [
      swarmHealth,
      swarmStats,
      marketStats,
      defenseMetrics,
      optimizationReport,
      cacheStats,
      topOpportunities,
      predictedModules,
      recentSnapshots,
    ] = await Promise.all([
      infiniteSwarm.getSwarmHealth(),
      infiniteSwarm.getConsensusStats(),
      marketSimulator.getSimulationStats(),
      predatoryDefense.getDefenseMetrics(),
      selfOptimization.getOptimizationReport(),
      semanticCache.getStats(),
      marketSimulator.getTopOpportunities(1),
      predictiveCoding.getPredictedModules({ status: "predicted", limit: 5 }),
      atomicState.getSnapshots({ limit: 1 }),
    ]);

    // Calculate empire stability
    const stability = this.calculateStability(
      swarmHealth,
      defenseMetrics,
      optimizationReport,
      cacheStats
    );

    // Build report
    const report: SovereignStatusReport = {
      timestamp: new Date(),
      sessionId,
      empireStatus: {
        stability,
        threatLevel: this.determineThreatLevel(defenseMetrics),
        operationsStatus: this.determineOperationsStatus(stability),
        message: this.selectStabilityMessage(stability),
      },
      swarm: {
        collectiveIntelligence: swarmHealth.averageIntelligence,
        activeNodes: swarmHealth.activeNodes,
        consensusRate: swarmStats.consensusRate,
        health: swarmHealth.activeNodes > 20 ? "Exceptional" : swarmHealth.activeNodes > 15 ? "Strong" : "Adequate",
      },
      opportunities: {
        count: marketStats.totalScenarios,
        totalRevenuePotential: marketStats.totalRevenuePotential,
        readyToDeploy: marketStats.readyToDeployCount,
        topOpportunity: topOpportunities[0] ? {
          title: topOpportunities[0].title,
          revenue: topOpportunities[0].revenueProjection.yearly,
          preview: topOpportunities[0].landingPage?.previewUrl,
        } : null,
      },
      optimizations: {
        modulesOptimized: optimizationReport.optimizationsApplied,
        timeSaved: optimizationReport.totalTimeSaved,
        efficiencyGain: optimizationReport.efficiencyGain,
        lastOptimization: optimizationReport.timestamp.toISOString(),
      },
      defense: {
        threatsBlocked: defenseMetrics.blockedRequests,
        systemHealth: defenseMetrics.systemHealth,
        activeMonitoring: true,
      },
      predictive: {
        modulesGenerated: predictedModules.length,
        patternsDetected: predictiveCoding.getTopPatterns(1).length,
        suggestions: this.generateSuggestions(predictedModules, topOpportunities),
      },
      greeting: this.generateImperialGreeting(stability),
      summary: "",
      actions: this.generateRecommendedActions(
        topOpportunities,
        predictedModules,
        defenseMetrics
      ),
    };

    // Generate comprehensive summary
    report.summary = this.generateSummary(report);

    // Store report
    await this.storeReport(report);

    const generationTime = Date.now() - startTime;
    console.log(`[SovereignStatus] Report generated in ${generationTime}ms`);

    return report;
  }

  private calculateStability(
    swarmHealth: ReturnType<typeof infiniteSwarm.getSwarmHealth>,
    defenseMetrics: ReturnType<typeof predatoryDefense.getDefenseMetrics>,
    optimizationReport: ReturnType<typeof selfOptimization.getOptimizationReport>,
    cacheStats: ReturnType<typeof semanticCache.getStats>
  ): number {
    let score = 100;

    // Swarm health impact
    const swarmScore = (swarmHealth.activeNodes / swarmHealth.totalNodes) * 20;
    score -= (20 - swarmScore);

    // Defense impact
    if (defenseMetrics.systemHealth === "optimal") score -= 0;
    else if (defenseMetrics.systemHealth === "stable") score -= 5;
    else if (defenseMetrics.systemHealth === "degraded") score -= 15;
    else score -= 25;

    // Optimization impact
    if (optimizationReport.efficiencyGain > 20) score += 5;
    else if (optimizationReport.efficiencyGain > 10) score += 2;

    // Cache impact
    if (cacheStats.l1HitRate + cacheStats.l2HitRate > 90) score += 5;

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  private determineThreatLevel(defense: ReturnType<typeof predatoryDefense.getDefenseMetrics>): SovereignStatusReport["empireStatus"]["threatLevel"] {
    if (defense.activeThreats > 10) return "critical";
    if (defense.activeThreats > 5) return "elevated";
    if (defense.activeThreats > 0) return "low";
    return "none";
  }

  private determineOperationsStatus(stability: number): SovereignStatusReport["empireStatus"]["operationsStatus"] {
    if (stability >= 90) return "optimal";
    if (stability >= 70) return "normal";
    return "degraded";
  }

  private selectStabilityMessage(stability: number): string {
    const threshold = stability >= 90 ? 90 : stability >= 70 ? 70 : stability >= 50 ? 50 : 0;
    const messages = this.stabilityMessages[threshold];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  private generateImperialGreeting(stability: number): string {
    const title = this.imperialTitles[0]; // Sir Azenith
    
    if (stability >= 90) {
      return `${title}, the Empire is ${stability}% stable. All dominions report excellence.`;
    } else if (stability >= 70) {
      return `${title}, the Empire maintains ${stability}% stability. Minor optimizations in progress.`;
    } else {
      return `${title}, the Empire requires attention. Current stability: ${stability}%.`;
    }
  }

  private generateSuggestions(
    modules: ReturnType<typeof predictiveCoding.getPredictedModules>,
    opportunities: ReturnType<typeof marketSimulator.getTopOpportunities>
  ): string[] {
    const suggestions: string[] = [];

    // Add opportunity suggestions
    for (const opp of opportunities.slice(0, 2)) {
      suggestions.push(`Deploy "${opp.title}" for $${opp.revenueProjection.yearly.toLocaleString()} annual revenue`);
    }

    // Add predictive module suggestions
    for (const mod of modules.slice(0, 2)) {
      suggestions.push(`Implement ${mod.name} (${mod.confidence}% confidence match)`);
    }

    return suggestions;
  }

  private generateRecommendedActions(
    opportunities: ReturnType<typeof marketSimulator.getTopOpportunities>,
    predictedModules: ReturnType<typeof predictiveCoding.getPredictedModules>,
    defense: ReturnType<typeof predatoryDefense.getDefenseMetrics>
  ): SovereignStatusReport["actions"] {
    const actions: SovereignStatusReport["actions"] = [];

    // High priority: Deploy opportunities
    if (opportunities.length > 0 && opportunities[0].landingPage) {
      actions.push({
        label: `Deploy ${opportunities[0].title}`,
        action: "deploy_opportunity",
        priority: "high",
      });
    }

    // Medium priority: Review predicted modules
    if (predictedModules.length > 0) {
      actions.push({
        label: `Review ${predictedModules.length} Predicted Modules`,
        action: "review_predictions",
        priority: "medium",
      });
    }

    // Security actions if needed
    if (defense.systemHealth !== "optimal") {
      actions.push({
        label: "Review Security Status",
        action: "security_review",
        priority: defense.systemHealth === "degraded" ? "high" : "medium",
      });
    }

    // Always offer war room
    actions.push({
      label: "Enter War Room",
      action: "open_war_room",
      priority: "low",
    });

    return actions;
  }

  private generateSummary(report: SovereignStatusReport): string {
    const parts: string[] = [];

    // Opening
    parts.push(report.greeting);

    // Swarm status
    parts.push(`The Infinite Swarm operates at ${report.swarm.consensusRate}% consensus with ${report.swarm.activeNodes} active neural nodes.`);

    // Opportunities
    if (report.opportunities.readyToDeploy > 0) {
      parts.push(`I have identified ${report.opportunities.readyToDeploy} revenue opportunities ready for immediate deployment, with combined potential of $${(report.opportunities.totalRevenuePotential / 1000000).toFixed(1)}M.`);
    }

    // Optimizations
    if (report.optimizations.modulesOptimized > 0) {
      parts.push(`Self-optimization protocols have enhanced ${report.optimizations.modulesOptimized} modules, saving ${(report.optimizations.timeSaved / 1000000).toFixed(1)} million microseconds.`);
    }

    // Defense
    if (report.defense.threatsBlocked > 0) {
      parts.push(`Defense systems have neutralized ${report.defense.threatsBlocked} threats. Perimeter remains secure.`);
    }

    // Predictive
    if (report.predictive.modulesGenerated > 0) {
      parts.push(`Predictive analysis suggests ${report.predictive.modulesGenerated} logical next implementations based on your coding patterns.`);
    }

    // Closing
    parts.push("The Empire awaits your command.");

    return parts.join(" ");
  }

  private async storeReport(report: SovereignStatusReport): Promise<void> {
    await this.supabase.from("sovereign_reports").insert({
      session_id: report.sessionId,
      timestamp: report.timestamp.toISOString(),
      stability: report.empireStatus.stability,
      threat_level: report.empireStatus.threatLevel,
      summary: report.summary,
      opportunities_count: report.opportunities.count,
      revenue_potential: report.opportunities.totalRevenuePotential,
      optimizations_count: report.optimizations.modulesOptimized,
    });
  }

  // ==========================================
  // QUICK STATUS
  // ==========================================

  async getQuickStatus(): Promise<{
    stability: number;
    message: string;
    urgentActions: number;
  }> {
    const defense = predatoryDefense.getDefenseMetrics();
    const swarm = infiniteSwarm.getSwarmHealth();
    
    const stability = this.calculateQuickStability(swarm, defense);
    const urgentActions = defense.activeThreats > 0 ? 1 : 0;

    return {
      stability,
      message: this.selectStabilityMessage(stability),
      urgentActions,
    };
  }

  private calculateQuickStability(
    swarm: ReturnType<typeof infiniteSwarm.getSwarmHealth>,
    defense: ReturnType<typeof predatoryDefense.getDefenseMetrics>
  ): number {
    let score = 100;
    score -= (swarm.totalNodes - swarm.activeNodes) * 2;
    if (defense.systemHealth === "degraded") score -= 20;
    if (defense.systemHealth === "under_attack") score -= 40;
    return Math.max(0, Math.min(100, score));
  }

  // ==========================================
  // HISTORICAL REPORTS
  // ==========================================

  async getReportHistory(limit: number = 10): Promise<SovereignStatusReport[]> {
    const { data } = await this.supabase
      .from("sovereign_reports")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);

    return (data || []).map(r => ({
      timestamp: new Date(r.timestamp),
      sessionId: r.session_id,
      empireStatus: {
        stability: r.stability,
        threatLevel: r.threat_level,
        operationsStatus: r.stability > 90 ? "optimal" : r.stability > 70 ? "normal" : "degraded",
        message: "",
      },
      // ... other fields
    } as SovereignStatusReport));
  }
}

// Export singleton
export const sovereignStatus = new SovereignStatusGenerator();
