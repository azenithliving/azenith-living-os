/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Strategy Synthesizer
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 1: Task 9 – Convert patterns into actionable strategies
 * 
 * Takes pattern extraction results and synthesizes concrete, actionable
 * strategies that VANGUARD can execute to improve sales outcomes.
 * 
 * Strategy types:
 * - Amplify: Double down on what works (win patterns)
 * - Mitigate: Reduce risk of loss (loss patterns)
 * - Optimize: Improve baseline performance (neutral patterns)
 */

import type { Pattern, PatternExtractionResult } from "./pattern_extractor";

// ─── Strategy Types ──────────────────────────────────────────────────────────

export type StrategyType = "amplify" | "mitigate" | "optimize";

export interface Strategy {
  type: StrategyType;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  actionableSteps: string[];
  expectedImpact: string;
  basedOnPattern: string; // Which pattern triggered this strategy
  confidence: number; // Inherited from pattern
}

export interface StrategySynthesisResult {
  strategies: Strategy[];
  priorityQueue: Strategy[]; // Sorted by priority (critical → low)
  synthesizedAt: string;
}

// ─── Strategy Templates ──────────────────────────────────────────────────────

interface StrategyTemplate {
  patternMatch: (pattern: Pattern) => boolean;
  build: (pattern: Pattern) => Strategy;
}

const AMPLIFY_TEMPLATES: StrategyTemplate[] = [
  {
    patternMatch: (p) => p.description.includes("Fast conversion"),
    build: (p) => ({
      type: "amplify",
      title: "Accelerate First Response Time",
      description: "Fast conversions (≤7 days) have high win rate. Prioritize rapid lead response.",
      priority: "high",
      actionableSteps: [
        "Set SLA: respond to new leads within 15 minutes",
        "Automate instant acknowledgment via WhatsApp/email",
        "Pre-qualify leads before human handoff to reduce friction",
        "Use charisma_mode for warm, immediate engagement",
      ],
      expectedImpact: "Increase win rate by 20-30% for fast-tracked leads",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
  {
    patternMatch: (p) => p.description.includes("High-value deals"),
    build: (p) => ({
      type: "amplify",
      title: "Enterprise Playbook Optimization",
      description: "High-value deals (≥50k) consistently won. Refine enterprise approach.",
      priority: "critical",
      actionableSteps: [
        "Activate diplomat_mode for enterprise leads (value ≥ 50k)",
        "Request detailed requirements upfront (RFP template)",
        "Engage multiple stakeholders early (decision-maker mapping)",
        "Offer custom pricing tiers for large contracts",
      ],
      expectedImpact: "Protect 90%+ win rate for enterprise deals",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
  {
    patternMatch: (p) => p.description.includes("Persistent follow-up"),
    build: (p) => ({
      type: "amplify",
      title: "Multi-Touchpoint Nurture Campaign",
      description: "Deals with persistent follow-up win more often. Automate nurture sequences.",
      priority: "high",
      actionableSteps: [
        "Create 5-touch nurture sequence: Day 0 (intro), Day 3 (value prop), Day 7 (case study), Day 14 (pricing), Day 21 (close)",
        "Use background_tasks to schedule automated follow-ups",
        "Track engagement: open rates, reply rates, meeting bookings",
        "Escalate to human if 2+ touches receive no response",
      ],
      expectedImpact: "Increase conversion rate by 15-25% in mid-funnel",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
];

const MITIGATE_TEMPLATES: StrategyTemplate[] = [
  {
    patternMatch: (p) => p.description.includes("negotiation") || p.description.includes("pricing"),
    build: (p) => ({
      type: "mitigate",
      title: "Pricing Objection Defense Protocol",
      description: "Losses during negotiation often due to pricing. Arm VANGUARD with value justification.",
      priority: "critical",
      actionableSteps: [
        "Pre-emptively share ROI calculator before pricing discussion",
        "Cite 3-tier verification data (knowledge graph → learnings → external) to justify value",
        "Offer flexible payment terms (monthly vs. annual) to reduce sticker shock",
        "Activate diplomat_mode if negotiation stalls",
        "Fallback: escalate to human sales rep if discount >15% requested",
      ],
      expectedImpact: "Reduce negotiation-stage losses by 30-40%",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
  {
    patternMatch: (p) => p.description.includes("stuck") || p.description.includes("slow"),
    build: (p) => ({
      type: "mitigate",
      title: "Stale Lead Reactivation",
      description: "Leads stuck in qualified stage for 30+ days have high loss rate. Trigger reactivation.",
      priority: "high",
      actionableSteps: [
        "Flag pipelines in 'qualified' stage for >21 days",
        "Send personalized re-engagement message (reference past conversation)",
        "Offer time-limited incentive (10% discount for 7 days)",
        "If no response in 7 days, mark as 'dormant' and move to nurture drip campaign",
      ],
      expectedImpact: "Recover 10-20% of stale leads",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
  {
    patternMatch: (p) => p.description.includes("competitor") || p.description.includes("proposal"),
    build: (p) => ({
      type: "mitigate",
      title: "Competitive Differentiation Playbook",
      description: "Losses at proposal stage suggest competitor advantage. Strengthen differentiation.",
      priority: "high",
      actionableSteps: [
        "Include competitor comparison matrix in all proposals",
        "Highlight unique differentiators: 3-tier verification, conscious personality, Egyptian cultural alignment",
        "Offer pilot/trial period to reduce risk vs. competitor unknown",
        "Request feedback if proposal rejected → feed to reflection_engine",
      ],
      expectedImpact: "Increase proposal win rate by 15-25%",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
];

const OPTIMIZE_TEMPLATES: StrategyTemplate[] = [
  {
    patternMatch: (p) => p.description.includes("Average sales cycle"),
    build: (p) => ({
      type: "optimize",
      title: "Sales Cycle Compression Initiative",
      description: "Current average cycle duration observed. Identify opportunities to compress timeline.",
      priority: "medium",
      actionableSteps: [
        "Benchmark cycle duration by lead source, value tier, and stage",
        "Identify bottleneck stages (where pipelines dwell longest)",
        "Automate manual steps (quote generation, contract signing via CraftMyPDF)",
        "A/B test accelerated vs. standard nurture sequences",
      ],
      expectedImpact: "Reduce sales cycle by 10-20% within 3 months",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
  {
    patternMatch: (p) => p.description.includes("Most common stage"),
    build: (p) => ({
      type: "optimize",
      title: "Funnel Stage Balancing",
      description: "Stage distribution shows concentration. Balance funnel to prevent bottlenecks.",
      priority: "low",
      actionableSteps: [
        "Monitor stage distribution weekly via consciousness_state",
        "If >50% of pipelines in one stage, trigger stage-specific automation",
        "Example: if 'qualified' overloaded, automate proposal generation",
        "Example: if 'negotiation' overloaded, prioritize high-value deals first",
      ],
      expectedImpact: "Improve funnel flow efficiency by 10-15%",
      basedOnPattern: p.description,
      confidence: p.confidence,
    }),
  },
];

// ─── Main Synthesis Function ─────────────────────────────────────────────────

export function synthesizeStrategies(
  patternResult: PatternExtractionResult
): StrategySynthesisResult {
  const strategies: Strategy[] = [];

  // Amplify win patterns
  patternResult.winPatterns.forEach((pattern) => {
    AMPLIFY_TEMPLATES.forEach((template) => {
      if (template.patternMatch(pattern)) {
        strategies.push(template.build(pattern));
      }
    });
  });

  // Mitigate loss patterns
  patternResult.lossPatterns.forEach((pattern) => {
    MITIGATE_TEMPLATES.forEach((template) => {
      if (template.patternMatch(pattern)) {
        strategies.push(template.build(pattern));
      }
    });
  });

  // Optimize neutral patterns
  patternResult.neutralPatterns.forEach((pattern) => {
    OPTIMIZE_TEMPLATES.forEach((template) => {
      if (template.patternMatch(pattern)) {
        strategies.push(template.build(pattern));
      }
    });
  });

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const priorityQueue = [...strategies].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return {
    strategies,
    priorityQueue,
    synthesizedAt: new Date().toISOString(),
  };
}

// ─── Helper: Filter Strategies by Type ───────────────────────────────────────

export function filterByType(
  strategies: Strategy[],
  type: StrategyType
): Strategy[] {
  return strategies.filter((s) => s.type === type);
}

// ─── Helper: Get Top N Strategies by Priority ────────────────────────────────

export function getTopPriority(strategies: Strategy[], n: number): Strategy[] {
  return strategies.slice(0, n);
}

// ─── Helper: Serialize Strategies for Logs ───────────────────────────────────

export function serializeStrategies(result: StrategySynthesisResult): string {
  let output = `Strategy Synthesis (${result.strategies.length} strategies, ${result.synthesizedAt})\n\n`;

  output += "Priority Queue:\n";
  result.priorityQueue.forEach((s, i) => {
    output += `\n${i + 1}. [${s.priority.toUpperCase()}] ${s.title} (${s.type})\n`;
    output += `   ${s.description}\n`;
    output += `   Expected Impact: ${s.expectedImpact}\n`;
    output += `   Actionable Steps:\n`;
    s.actionableSteps.forEach((step, j) => {
      output += `     ${j + 1}. ${step}\n`;
    });
    output += `   Based on: ${s.basedOnPattern} (confidence=${s.confidence.toFixed(2)})\n`;
  });

  return output;
}

// ─── Helper: Convert Strategies to JSON for Persistence ──────────────────────

export function strategiesToJSON(result: StrategySynthesisResult): string {
  return JSON.stringify(result, null, 2);
}

// ─── Helper: Estimate Strategy Execution Cost ────────────────────────────────

export function estimateExecutionCost(strategy: Strategy): {
  estimatedHours: number;
  automationRequired: boolean;
} {
  const stepCount = strategy.actionableSteps.length;
  let hours = 0;

  switch (strategy.priority) {
    case "critical":
      hours = stepCount * 4; // 4 hours per step for critical
      break;
    case "high":
      hours = stepCount * 2;
      break;
    case "medium":
      hours = stepCount * 1;
      break;
    case "low":
      hours = stepCount * 0.5;
      break;
  }

  const automationRequired = strategy.actionableSteps.some(
    (step) =>
      step.includes("automate") ||
      step.includes("background_tasks") ||
      step.includes("schedule")
  );

  return { estimatedHours: hours, automationRequired };
}
