/**
 * Learned intent patterns — seeded + reinforced from successful executions.
 * In-memory first; persisted to agent_memory when DB is available.
 */

import { createClient } from "@supabase/supabase-js";
import type { ClassifiedIntent } from "./admin-intent-types";

export interface LearnedPattern {
  id: string;
  triggers: RegExp[];
  intent: ClassifiedIntent;
  hits: number;
  source: "seed" | "execution" | "owner";
}

const MEMORY_CATEGORY = "admin_learned_intent";

const SEED_PATTERNS: Omit<LearnedPattern, "hits">[] = [
  {
    id: "monitor-system-ar",
    triggers: [/راقب.*(النظام|الموقع)|مراقبة.*النظام/i],
    intent: { kind: "health", confidence: 0.82, reasoning: "learned-monitor" },
    source: "seed",
  },
  {
    id: "backup-list-ar",
    triggers: [/اعرض.*النسخ|قائمة.*نسخ.*احتياط|كل.*backups/i],
    intent: {
      kind: "ultimate_tool",
      toolName: "backup_list",
      toolParams: {},
      confidence: 0.86,
      reasoning: "learned-backup-list",
    },
    source: "seed",
  },
  {
    id: "deep-health-ar",
    triggers: [/فحص.*تقني.*عميق|system_health_check/i],
    intent: {
      kind: "ultimate_tool",
      toolName: "system_health_check",
      toolParams: {},
      confidence: 0.84,
      reasoning: "learned-deep-health",
    },
    source: "seed",
  },
  {
    id: "self-evolve-ar",
    triggers: [
      /طوّ?ر.*(نفسك|قدراتك|مهاراتك)|طور.*امكانيات|develop.*capabilities|10.*سنين.*خبرة/i,
    ],
    intent: {
      kind: "command",
      command: "evolve",
      commandLine: "evolve",
      confidence: 0.88,
      reasoning: "learned-self-evolve",
    },
    source: "seed",
  },
  {
    id: "goal-progress-ar",
    triggers: [/وين.*الهدف|تقدم.*الهدف|goal.*progress/i],
    intent: {
      kind: "ultimate_tool",
      toolName: "goal_check_progress",
      toolParams: { goalId: "latest" },
      confidence: 0.85,
      reasoning: "learned-goal-progress",
    },
    source: "seed",
  },
  {
    id: "live-metrics-ar",
    triggers: [/مؤشرات.*الآن|الأرقام.*الحين|dashboard.*live/i],
    intent: {
      kind: "ultimate_tool",
      toolName: "metrics_realtime",
      toolParams: { timeRange: "24h" },
      confidence: 0.83,
      reasoning: "learned-live-metrics",
    },
    source: "seed",
  },
  {
    id: "leads-list-ar",
    triggers: [/اعرض.*(العملاء|leads)|قائمة.*عملاء/i],
    intent: {
      kind: "ultimate_tool",
      toolName: "lead_list",
      toolParams: { limit: 20 },
      confidence: 0.86,
      reasoning: "learned-leads",
    },
    source: "seed",
  },
  {
    id: "content-health-ar",
    triggers: [/صحة.*المحتوى|content\s*health/i],
    intent: {
      kind: "ultimate_tool",
      toolName: "content_health_check",
      toolParams: { pageSlug: "home" },
      confidence: 0.84,
      reasoning: "learned-content-health",
    },
    source: "seed",
  },
  {
    id: "daily-report-ar",
    triggers: [/تقرير.*يومي|ملخص.*اليوم|daily\s*report/i],
    intent: { kind: "analytics", analyticsDays: 7, confidence: 0.9, reasoning: "learned-daily" },
    source: "seed",
  },
  {
    id: "web-search-ar",
    triggers: [/ابحث.*عن|بحث.*ويب/i],
    intent: {
      kind: "ultimate_tool",
      toolName: "web_search",
      toolParams: {},
      confidence: 0.82,
      reasoning: "learned-search",
    },
    source: "seed",
  },
];

const patternStore = new Map<string, LearnedPattern>();

function initStore() {
  if (patternStore.size > 0) return;
  for (const p of SEED_PATTERNS) {
    patternStore.set(p.id, { ...p, hits: 0 });
  }
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function matchLearnedPattern(message: string): ClassifiedIntent | null {
  initStore();
  const trimmed = message.trim();
  if (!trimmed) return null;

  let best: LearnedPattern | null = null;
  for (const p of patternStore.values()) {
    if (p.triggers.some((rx) => rx.test(trimmed))) {
      if (!best || p.hits > best.hits) best = p;
    }
  }
  if (!best) return null;
  return { ...best.intent, reasoning: best.intent.reasoning || `pattern:${best.id}` };
}

export function reinforceLearnedPattern(
  message: string,
  intent: ClassifiedIntent
): void {
  initStore();
  const id = `exec-${hashMessage(message)}`;
  const existing = patternStore.get(id);
  if (existing) {
    existing.hits += 1;
    return;
  }
  const triggers = [buildLoosePattern(message)];
  patternStore.set(id, {
    id,
    triggers,
    intent: { ...intent, confidence: Math.min(0.92, (intent.confidence || 0.7) + 0.05) },
    hits: 1,
    source: "execution",
  });
  void persistPattern(id, message, intent).catch(() => {});
}

function buildLoosePattern(message: string): RegExp {
  const words = message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 4);
  if (words.length === 0) {
    return new RegExp(message.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  }
  return new RegExp(words.join(".*"), "i");
}

function hashMessage(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

async function persistPattern(
  id: string,
  message: string,
  intent: ClassifiedIntent
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  await supabase.from("agent_memory").insert({
    type: "pattern",
    category: MEMORY_CATEGORY,
    content: message.slice(0, 500),
    context: { patternId: id, intent },
    priority: "normal",
    outcome: "success",
  });
}

export async function hydrateLearnedPatternsFromDb(limit = 40): Promise<number> {
  initStore();
  const supabase = getServiceSupabase();
  if (!supabase) return patternStore.size;

  const { data } = await supabase
    .from("agent_memory")
    .select("content, context")
    .eq("category", MEMORY_CATEGORY)
    .order("created_at", { ascending: false })
    .limit(limit);

  let added = 0;
  for (const row of data || []) {
    const ctx = row.context as { patternId?: string; intent?: ClassifiedIntent } | null;
    const intent = ctx?.intent;
    const pid = ctx?.patternId || `db-${hashMessage(row.content)}`;
    if (!intent || patternStore.has(pid)) continue;
    patternStore.set(pid, {
      id: pid,
      triggers: [buildLoosePattern(row.content)],
      intent,
      hits: 1,
      source: "execution",
    });
    added++;
  }
  return patternStore.size + added;
}

export function listLearnedPatternCount(): number {
  initStore();
  return patternStore.size;
}
