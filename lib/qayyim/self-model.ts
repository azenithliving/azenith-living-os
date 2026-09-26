/**
 * self-model.ts — what the swarm knows about itself.
 *
 * Aggregates the real registries (AGENT_ROLES, TOOL_CATALOG) with live DB
 * head-counts so «عرف نفسك» answers with numbers, not prose.
 * Server-only: imports the service-role DAL. UI reads it through an API.
 */
import "server-only";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { AGENT_ROLES } from "./agent-roles";
import { TOOL_CATALOG } from "@/lib/agents/intent-router";
import type { SelfModelView } from "./self-view";

export interface SelfModel {
  generatedAt: string;
  title: string;
  brand: string;
  agents: Array<{ key: string; name: string; roles: number }>;
  tools: Array<{ name: string; desc: string }>;
  limits: string[];
  /** What runs on its own schedule. Declared here so `whoami` cannot forget it. */
  organs: Organ[];
  counters?: { drafts?: number; goals?: number; learnings?: number; eventsToday?: number };
  /** Counters whose query failed — reported instead of silently reading as zero.
   * `label` is what the owner reads, `reason` is the provider's own words. */
  dataGaps?: Array<{ label: string; reason: string }>;
}

export interface Organ {
  label: string;
  cadence: string;
  /** The module the round actually calls. The suite greps for it, so a deleted
   * organ fails the self-report test instead of turning the report into fiction. */
  source: string;
}

export const AUTONOMOUS_ORGANS: Organ[] = [
  { label: "مؤشر الفخامة المقاس", cadence: "كل يوم", source: "@/lib/qayyim/luxury-v2" },
  { label: "الأهداف المهددة", cadence: "كل يوم", source: "@/lib/qayyim/goal-risk" },
  { label: "مراقبة شذوذ الزوار", cadence: "كل يوم", source: "@/lib/qayyim/anomaly" },
  { label: "كاناري الصفحات العامة", cadence: "كل يوم", source: "@/lib/qayyim/canary" },
  { label: "قياس المنافسين", cadence: "كل اثنين", source: "@/lib/qayyim/rivals" },
  { label: "تدقيق ردود السرب", cadence: "كل أحد", source: "@/lib/qayyim/self-audit" },
  { label: "إغلاق المهام المعلقة", cadence: "كل يوم", source: "@/lib/qayyim/task-reconcile" },
  { label: "تقرير الصباح على تليجرام", cadence: "كل يوم", source: "@/lib/qayyim/daily-story" },
];

const AGENT_NAMES: Record<string, string> = {
  "qayyim-core": "القائد",
  "qayyim-cont": "المحتوى",
  "qayyim-vis": "المرئيات",
  "qayyim-seo": "الظهور",
  "qayyim-ux": "التجربة",
  "qayyim-ana": "التحليلات",
  "qayyim-dev": "التطوير",
  "qayyim-qa": "الجودة",
};

const LIMITS = [
  "كرون يومي واحد كحد أقصى، لأن منصة الاستضافة المجانية لا تسمح بأكثر",
  "لا نشر بلا موافقة بشرية — القاعدة الثالثة في الدستور",
  "صفر خدمات مدفوعة",
  "روابط وأرقام من خريطة المسارات وقاعدة البيانات فقط",
];

type CounterKey = "drafts" | "goals" | "learnings" | "eventsToday";

/** How many tool ids the report spells out. The count is the honest headline;
 * the list is for the owner to recognise a name he has already seen. */
export const TOOLS_LISTED = 6;

const COUNTER_LABELS: Record<CounterKey, string> = {
  drafts: "مسودات معلقة",
  goals: "أهداف نشطة",
  learnings: "تعلّمات مسجّلة",
  eventsToday: "حدث آخر 24 ساعة",
};

type CountResult = { count: number | null; error: { message: string } | null };

export async function buildSelfModel(companyId: string | null): Promise<SelfModel> {
  const model: SelfModel = {
    generatedAt: new Date().toISOString(),
    title: "مدير تشغيل المحتوى",
    brand: "قيّم الدار",
    agents: Object.keys(AGENT_ROLES).map((key) => ({
      key,
      name: AGENT_NAMES[key] ?? key,
      roles: (AGENT_ROLES[key] ?? []).length,
    })),
    tools: TOOL_CATALOG.map((t) => ({ name: t.name, desc: t.desc })),
    limits: LIMITS,
    organs: AUTONOMOUS_ORGANS,
  };
  const sb = supabaseServer;
  if (!companyId || !sb) return model;

  const dayAgo = new Date(Date.now() - 864e5).toISOString();
  const headCount = (table: string) =>
    sb.from(table).select("id", { count: "exact", head: true }).eq("company_id", companyId);

  const results: [CounterKey, CountResult][] = [
    ["drafts", await headCount("qayyim_drafts").in("status", ["draft", "previewing"])],
    ["goals", await headCount("qayyim_goals").eq("status", "active")],
    ["learnings", await headCount("qayyim_swarm_learnings")],
    ["eventsToday", await headCount("qayyim_sync_events").gte("created_at", dayAgo)],
  ];

  const counters: NonNullable<SelfModel["counters"]> = {};
  const gaps: NonNullable<SelfModel["dataGaps"]> = [];
  for (const [key, res] of results) {
    if (res.error) gaps.push({ label: COUNTER_LABELS[key], reason: res.error.message });
    else counters[key] = res.count ?? 0;
  }
  model.counters = counters;
  if (gaps.length) model.dataGaps = gaps;
  return model;
}

export function renderSelfReport(m: SelfModel): string {
  const live = m.counters
    ? (Object.keys(COUNTER_LABELS) as CounterKey[]).map(
        (k) => `${m.counters?.[k] ?? "؟"} ${COUNTER_LABELS[k]}`
      )
    : null;

  return [
    `**${m.title}** (${m.brand}) — تقرير ذاتي حي`,
    `• الوكلاء: ${m.agents.length} — ${m.agents.map((a) => `${a.name} (${a.roles} دورًا)`).join("، ")}`,
    // Tool ids are Latin. In an Arabic sentence the bidi renderer flips the
    // whole line, so they go under their own Arabic caption instead.
    `• الأدوات المقاسة: ${m.tools.length} أداة، أوّل ${Math.min(m.tools.length, TOOLS_LISTED)} أسماءها في السطر التالي`,
    m.tools
      .slice(0, TOOLS_LISTED)
      .map((t) => t.name)
      .join(", "),
    live ? `• الآن: ${live.join(" · ")}` : "• العدادات غير متاحة (لا شركة محددة)",
    m.dataGaps?.length ? `• لم أستطع قراءة: ${m.dataGaps.map((g) => g.label).join("، ")}` : "",
    ...(m.dataGaps?.map((g) => g.reason) ?? []),
    `• اللي بيحصل لوحده من غير ما تطلب: ${m.organs.map((o) => `${o.label}: ${o.cadence}`).join("، ")}`,
    `• حدودي المعلنة: ${m.limits.join("؛ ")}`,
    "لو طلبتُ خارج هذه الحدود هقولك بصراحة وسمّي الناقص.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The client shape: Arabic labels decided here, foreign identifiers dropped, so
 * no browser code translates a key and no Latin token can land inside an Arabic
 * sentence on the owner's screen. */
export function toSelfView(m: SelfModel): SelfModelView {
  return {
    generatedAt: m.generatedAt,
    title: m.title,
    brand: m.brand,
    agents: m.agents,
    // Ids only: the Arabic name of a capability is chosen where the owner will
    // read it, not in the prompt text written for the intent model.
    tools: m.tools.map((t) => ({ name: t.name })),
    limits: m.limits,
    organs: m.organs.map((o) => ({ label: o.label, cadence: o.cadence })),
    counters: m.counters
      ? (Object.keys(COUNTER_LABELS) as CounterKey[]).map((k) => ({
          label: COUNTER_LABELS[k],
          value: m.counters?.[k] ?? null,
        }))
      : undefined,
    dataGaps: m.dataGaps,
  };
}

export function renderIdentityLine(agentKey: string, m: SelfModel): string {
  const me = m.agents.find((a) => a.key === agentKey);
  return `[هويتك: أنت «${m.title}» — ${m.brand}${
    me ? `، وكيل ${me.name} (${me.roles} أدوار)` : ""
  }. أدوات السرب الآن ${m.tools.length} أداة. ممنوع الطلبات خارج الأدوات: ارفض بصراحة وسمِّ الناقص.]`;
}
