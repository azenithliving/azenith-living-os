/**
 * lib/vanguard/consciousness/context_engine.ts
 * =============================================
 * Context Engine — builds the rich context object fed into every
 * LLM call and the ConsciousnessCore's decision cycle.
 *
 * Sources (merged in priority order):
 *   1. Active goals (from ConsciousnessCore)
 *   2. Relevant memories (semantic search on working memory)
 *   3. Active beliefs (filtered by domain)
 *   4. Current session insights (conversation history)
 *   5. System metadata (time, state, cycle count)
 */

import {
  type Goal,
  type Memory,
  type Belief,
  type ConsciousnessStateSnapshot,
  type SessionInsights,
  type ConversationMessage,
  GoalStatus,
} from "@/lib/vanguard/types";
import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════
// CONTEXT TYPES
// ════════════════════════════════════════════════════════════

export interface RichContext {
  /** ISO timestamp when context was built */
  readonly builtAt:          string;
  /** Current consciousness state */
  readonly consciousnessState?: ConsciousnessStateSnapshot;
  /** Top-priority active goals (max 5) */
  readonly activeGoals:      Goal[];
  /** Most relevant memories for the current query (max 10) */
  readonly relevantMemories: Memory[];
  /** Beliefs relevant to the current domain (max 15) */
  readonly activeBeliefs:    Belief[];
  /** Distilled session insights (name, room, style, etc.) */
  readonly sessionInsights:  SessionInsights;
  /** Recent conversation turns (max 20, newest last) */
  readonly recentHistory:    ConversationMessage[];
  /** Flat key→value bag for prompt template injection */
  readonly promptVars:       Record<string, string>;
}

export interface ContextBuildOptions {
  query?:              string;
  goals?:              Goal[];
  memories?:           Memory[];
  beliefs?:            Belief[];
  sessionInsights?:    SessionInsights;
  history?:            ConversationMessage[];
  consciousnessState?: ConsciousnessStateSnapshot;
  maxGoals?:           number;
  maxMemories?:        number;
  maxBeliefs?:         number;
  maxHistory?:         number;
}

// ════════════════════════════════════════════════════════════
// RELEVANCE SCORING
// ════════════════════════════════════════════════════════════

function scoreMemoryRelevance(memory: Memory, query: string): number {
  if (!query) return memory.importance;
  const q     = query.toLowerCase();
  const text  = memory.content.toLowerCase();
  // Simple keyword overlap score (0–1)
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return memory.importance;
  const hits  = words.filter((w) => text.includes(w)).length;
  return (hits / words.length) * 0.6 + memory.importance * 0.4;
}

function rankMemories(memories: Memory[], query: string, limit: number): Memory[] {
  return [...memories]
    .map((m) => ({ memory: m, score: scoreMemoryRelevance(m, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ memory }) => memory);
}

function filterBeliefsByContext(beliefs: Belief[], insights: SessionInsights): Belief[] {
  const relevantDomains: Belief["domain"][] = ["sales", "cultural", "general"];
  // If discussing technical materials, include technical beliefs
  if (insights.roomType || insights.style) {
    relevantDomains.push("technical");
  }
  return beliefs.filter((b) => relevantDomains.includes(b.domain));
}

// ════════════════════════════════════════════════════════════
// PROMPT VARIABLE EXTRACTION
// Converts context into flat strings suitable for `{{var}}` injection
// ════════════════════════════════════════════════════════════

function buildPromptVars(
  insights:   SessionInsights,
  goals:      Goal[],
  memories:   Memory[]
): Record<string, string> {
  const vars: Record<string, string> = {};

  // Session data
  if (insights.userName)  vars.user_name    = insights.userName;
  if (insights.roomType)  vars.room_type    = insights.roomType;
  if (insights.style)     vars.style        = insights.style;
  if (insights.budget)    vars.budget       = insights.budget;
  if (insights.urgency)   vars.urgency      = insights.urgency;
  if (insights.mood)      vars.mood         = insights.mood;
  if (insights.location)  vars.location     = insights.location;

  // Goal summary
  if (goals.length > 0) {
    vars.primary_goal = goals[0].description;
    vars.goal_count   = String(goals.length);
  }

  // Memory excerpts (top 3, comma-separated)
  if (memories.length > 0) {
    vars.relevant_memories = memories
      .slice(0, 3)
      .map((m) => m.content.slice(0, 100))
      .join(" | ");
  }

  // Pipeline stage
  if (insights.pipelineStage) {
    vars.pipeline_stage = insights.pipelineStage;
  }

  return vars;
}

// ════════════════════════════════════════════════════════════
// CONTEXT ENGINE CLASS
// ════════════════════════════════════════════════════════════

export class ContextEngine {
  private readonly defaultMaxGoals:    number;
  private readonly defaultMaxMemories: number;
  private readonly defaultMaxBeliefs:  number;
  private readonly defaultMaxHistory:  number;

  constructor(opts: {
    maxGoals?:    number;
    maxMemories?: number;
    maxBeliefs?:  number;
    maxHistory?:  number;
  } = {}) {
    this.defaultMaxGoals    = opts.maxGoals    ?? 5;
    this.defaultMaxMemories = opts.maxMemories ?? 10;
    this.defaultMaxBeliefs  = opts.maxBeliefs  ?? 15;
    this.defaultMaxHistory  = opts.maxHistory  ?? 20;
  }

  // ── Public API ────────────────────────────────────────────

  build(opts: ContextBuildOptions = {}): RichContext {
    const maxGoals    = opts.maxGoals    ?? this.defaultMaxGoals;
    const maxMemories = opts.maxMemories ?? this.defaultMaxMemories;
    const maxBeliefs  = opts.maxBeliefs  ?? this.defaultMaxBeliefs;
    const maxHistory  = opts.maxHistory  ?? this.defaultMaxHistory;

    const query    = opts.query ?? "";
    const insights = opts.sessionInsights ?? {};
    const history  = opts.history ?? [];
    const goals    = opts.goals  ?? [];
    const memories = opts.memories ?? [];
    const beliefs  = opts.beliefs  ?? [];

    // 1. Filter to active goals, ranked by priority
    const activeGoals = goals
      .filter((g) => g.status === GoalStatus.ACTIVE)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxGoals);

    // 2. Rank memories by relevance to the current query
    const relevantMemories = rankMemories(memories, query, maxMemories);

    // 3. Filter beliefs by domain relevance
    const activeBeliefs = filterBeliefsByContext(beliefs, insights)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxBeliefs);

    // 4. Recent history (newest last, capped)
    const recentHistory = history.slice(-maxHistory);

    // 5. Build prompt variable bag
    const promptVars = buildPromptVars(insights, activeGoals, relevantMemories);

    const ctx: RichContext = {
      builtAt:           new Date().toISOString(),
      consciousnessState: opts.consciousnessState,
      activeGoals,
      relevantMemories,
      activeBeliefs,
      sessionInsights:   insights,
      recentHistory,
      promptVars,
    };

    logger.debug("[ContextEngine] Context built", {
      goalCount:   activeGoals.length,
      memoryCount: relevantMemories.length,
      beliefCount: activeBeliefs.length,
      historyLen:  recentHistory.length,
    });

    return ctx;
  }

  /**
   * Serialises the context into a compact string for LLM injection.
   * Called by the brain endpoint when assembling the final prompt.
   */
  serialise(ctx: RichContext): string {
    const parts: string[] = [];

    if (ctx.activeGoals.length > 0) {
      parts.push(
        `[الأهداف النشطة]\n${ctx.activeGoals
          .map((g, i) => `${i + 1}. ${g.description}`)
          .join("\n")}`
      );
    }

    if (ctx.activeBeliefs.length > 0) {
      const topBeliefs = ctx.activeBeliefs.slice(0, 5);
      parts.push(
        `[معتقدات ذات صلة]\n${topBeliefs
          .map((b) => `• ${b.proposition} (ثقة: ${(b.confidence * 100).toFixed(0)}%)`)
          .join("\n")}`
      );
    }

    if (ctx.relevantMemories.length > 0) {
      const topMems = ctx.relevantMemories.slice(0, 3);
      parts.push(
        `[ذكريات ذات صلة]\n${topMems
          .map((m) => `• ${m.content.slice(0, 120)}`)
          .join("\n")}`
      );
    }

    const ins = ctx.sessionInsights;
    const sessionLines: string[] = [];
    if (ins.userName)  sessionLines.push(`العميل: ${ins.userName}`);
    if (ins.roomType)  sessionLines.push(`الغرفة: ${ins.roomType}`);
    if (ins.style)     sessionLines.push(`الأسلوب: ${ins.style}`);
    if (ins.urgency)   sessionLines.push(`الإلحاح: ${ins.urgency}`);
    if (ins.mood)      sessionLines.push(`المزاج: ${ins.mood}`);
    if (sessionLines.length > 0) {
      parts.push(`[معلومات الجلسة]\n${sessionLines.join("\n")}`);
    }

    return parts.join("\n\n");
  }

  /**
   * Merge a context patch into an existing RichContext snapshot.
   * Used for incremental updates without full rebuild.
   */
  merge(base: RichContext, patch: Partial<ContextBuildOptions>): RichContext {
    return this.build({
      query:             patch.query,
      goals:             patch.goals ?? base.activeGoals,
      memories:          patch.memories ?? base.relevantMemories,
      beliefs:           patch.beliefs ?? base.activeBeliefs,
      sessionInsights:   patch.sessionInsights ?? base.sessionInsights,
      history:           patch.history ?? base.recentHistory,
      consciousnessState: patch.consciousnessState ?? base.consciousnessState,
    });
  }
}

// ════════════════════════════════════════════════════════════
// SINGLETON
// ════════════════════════════════════════════════════════════

let _contextEngine: ContextEngine | null = null;

export function getContextEngine(): ContextEngine {
  if (!_contextEngine) _contextEngine = new ContextEngine();
  return _contextEngine;
}
