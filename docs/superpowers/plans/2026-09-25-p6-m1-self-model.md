# P6-M1 «الوعي الذاتي» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the swarm a live self-model — it knows, names, and reports its own agents/tools/limits/counters, answers «who are you / what can you do» from data not prose, and carries its new job title «مدير تشغيل المحتوى» everywhere.

**Architecture:** One pure module (`lib/qayyim/self-model.ts`) aggregates existing registries (AGENT_ROLES, intent-router TOOL_CATALOG, url-manifest) plus live DB head-counts; a new `qayyim_whoami` tool in the bridge renders its report; AgentOrchestrator injects a one-line identity into every agent prompt; UI strings adopt the new title.

**Tech Stack:** Next.js 16 / TypeScript, vitest (node env), existing supabaseServer DAL. No new deps.

**Spec:** `docs/qayyim-phases/P6-content-operations-manager.md` (section M1)

## Global Constraints

- $0: no new npm dependencies, no paid APIs.
- Server-only module (imports supabaseServer) — never imported by client components; UI gets strings via API or literals.
- TDD: failing test first, minimal implementation, commit per task.
- Branch `qayyim/p6-m1`; each task = one commit; final merge after full gate (`npm run typecheck`, `npx eslint <files>`, `npx vitest run`).
- Agent keys (`qayyim-core`…) and DB values NEVER change — display strings only.
- Arabic UI copy in Egyptian simplified formal style.

---

### Task 1: self-model module

**Files:**
- Modify: `lib/agents/intent-router.ts` (export TOOL_CATALOG)
- Create: `lib/qayyim/self-model.ts`
- Test: `tests/qayyim/selfModel.test.ts`

**Interfaces:**
- Consumes: `AGENT_ROLES` from `lib/qayyim/agent-roles.ts`; `TOOL_CATALOG` (being exported now); `supabaseServer` from `lib/dal/unified-supabase`.
- Produces: `buildSelfModel(companyId: string | null): Promise<SelfModel>`, `renderSelfReport(m: SelfModel): string`, `renderIdentityLine(agentKey: string, m: SelfModel): string`, `interface SelfModel` — used by Tasks 2–3.

- [ ] **Step 1: Write the failing test**

```ts
// tests/qayyim/selfModel.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderSelfReport, renderIdentityLine, type SelfModel } from '@/lib/qayyim/self-model';

const fixture: SelfModel = {
  generatedAt: '2026-09-25T00:00:00Z',
  title: 'مدير تشغيل المحتوى',
  brand: 'قيّم الدار',
  agents: [{ key: 'qayyim-core', name: 'القائد', roles: 6 }],
  tools: [{ name: 'speed_analyze', desc: 'قياس سرعة' }],
  limits: ['كرون يومي واحد (Vercel Hobby)'],
  counters: { drafts: 3, goals: 0, learnings: 5, eventsToday: 12 },
};

describe('self-model', () => {
  it('renders a report naming title, tool count and counters', () => {
    const r = renderSelfReport(fixture);
    expect(r).toContain('مدير تشغيل المحتوى');
    expect(r).toContain('1 أداة');
    expect(r).toContain('3');
    expect(r).toContain('كرون يومي واحد');
  });
  it('identity line names the agent and its live tool count', () => {
    const line = renderIdentityLine('qayyim-core', fixture);
    expect(line).toContain('مدير تشغيل المحتوى');
    expect(line).toContain('قائد');
    expect(line).toContain('1 أداة');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/qayyim/selfModel.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// lib/qayyim/self-model.ts
"use server";
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { AGENT_ROLES } from "./agent-roles";
import { TOOL_CATALOG } from "@/lib/agents/intent-router";

export interface SelfModel {
  generatedAt: string;
  title: string;
  brand: string;
  agents: Array<{ key: string; name: string; roles: number }>;
  tools: Array<{ name: string; desc: string }>;
  limits: string[];
  counters?: { drafts?: number; goals?: number; learnings?: number; eventsToday?: number };
}

const AGENT_NAMES: Record<string, string> = {
  "qayyim-core": "القائد", "qayyim-cont": "المحتوى", "qayyim-vis": "المرئيات",
  "qayyim-seo": "الظهور", "qayyim-ux": "التجربة", "qayyim-ana": "التحليلات",
  "qayyim-dev": "التطوير", "qayyim-qa": "الجودة",
};

const LIMITS = [
  "كرون يومي واحد كحد أقصى (Vercel Hobby)",
  "لا نشر بلا موافقة بشرية (دستور — قاعدة 3)",
  "صفر خدمات مدفوعة",
  "روابط وأرقام من خريطة المسارات وقاعدة البيانات فقط",
];

export async function buildSelfModel(companyId: string | null): Promise<SelfModel> {
  const model: SelfModel = {
    generatedAt: new Date().toISOString(),
    title: "مدير تشغيل المحتوى",
    brand: "قيّم الدار",
    agents: Object.keys(AGENT_ROLES).map((key) => ({
      key, name: AGENT_NAMES[key] ?? key, roles: (AGENT_ROLES[key] ?? []).length,
    })),
    tools: TOOL_CATALOG.map((t) => ({ name: t.name, desc: t.desc })),
    limits: LIMITS,
  };
  if (companyId && supabaseServer) {
    const [drafts, goals, learnings, events] = await Promise.all([
      supabaseServer.from("qayyim_drafts").select("id", { count: "exact", head: true }).eq("company_id", companyId).in("status", ["draft", "previewing"]),
      supabaseServer.from("qayyim_goals").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
      supabaseServer.from("qayyim_learnings").select("id", { count: "exact", head: true }).eq("company_id", companyId),
      supabaseServer.from("qayyim_sync_events").select("id", { count: "exact", head: true }).eq("company_id", companyId).gte("created_at", new Date(Date.now() - 864e5).toISOString()),
    ]);
    model.counters = { drafts: drafts.count ?? 0, goals: goals.count ?? 0, learnings: learnings.count ?? 0, eventsToday: events.count ?? 0 };
  }
  return model;
}

export function renderSelfReport(m: SelfModel): string {
  const c = m.counters;
  return [
    `**${m.title}** (${m.brand}) — تقرير ذاتي حي`,
    `• الوكلاء: ${m.agents.length} — ${m.agents.map((a) => `${a.name}(${a.roles} دورًا)`).join("، ")}`,
    `• الأدوات المقاسة: ${m.tools.length} أداة — ${m.tools.slice(0, 6).map((t) => t.name).join("، ")}…`,
    c ? `• الآن: ${c.drafts} مسودة معلقة · ${c.goals} هدف نشط · ${c.learnings} تعلّم · ${c.eventsToday} حدث آخر 24س` : "• العدادات غير متاحة (لا شركة محددة)",
    `• حدودي المعلنة: ${m.limits.join("؛ ")}`,
    "لو طلبتُ خارج هذه الحدود هقولك بصراحة وسمّي الناقص.",
  ].join("\n");
}

export function renderIdentityLine(agentKey: string, m: SelfModel): string {
  const me = m.agents.find((a) => a.key === agentKey);
  return `[هويتك: أنت «${m.name ? "" : m.title}» — ${m.brand}${me ? `، وكيل ${me.name} (${me.roles} أدوار)` : ""}. أدوات السرب الآن ${m.tools.length} أداة. ممنوع الطلبات خارج الأدوات: ارفض بصراحة وسمِّ الناقص.]`;
}
```

Note: `renderIdentityLine` uses `m.title` literally; `m.name` is not a field — write `${m.title}` (fix during implementation; test above is the contract).

- [ ] **Step 4: Run tests → PASS.** Also `npm run typecheck`.

- [ ] **Step 5: Commit** `feat(qayyim): live self-model module (P6-M1)`

---

### Task 2: `qayyim-whoami` tool

**Files:**
- Modify: `lib/agents/intent-router.ts` (catalog entry + fast regex), `lib/admin-tool-bridge.ts` (execution branch), `tests/qayyim/selfModel.test.ts` (add routing test)

**Interfaces:**
- Consumes: `buildSelfModel`, `renderSelfReport` (Task 1).
- Produces: tool `qayyim_whoami` routable by regex `/أنت بتعمل إيه|بتقدر تعمل إيه|قدراتك|who are you|عرف نفسك/i`; AgentOrchestrator needs no change (generic tool flow renders the answer).

- [ ] **Step 1: Failing test**

```ts
import { inferUltimateTool } from '@/lib/admin-tool-bridge';
it('routes self-capability questions to qayyim_whoami', () => {
  expect(inferUltimateTool('انت بتعمل ايه بالظبط؟')?.toolName).toBe('qayyim_whoami');
  expect(inferUltimateTool('عرف نفسك')?.toolName).toBe('qayyim_whoami');
});
```

- [ ] **Step 2: Verify FAIL** (returns null).
- [ ] **Step 3: Implement** — add to `TOOL_CATALOG`: `{ name: "qayyim_whoami", desc: "تقرير ذاتي حي بقدرات السرب وأدواته وحدوده وعداداته" }`; add the regex rule at the TOP of the P5 block in `inferUltimateTool`; in `runUltimateTool` add branch:

```ts
  if (toolName === "qayyim_whoami") {
    const { buildSelfModel, renderSelfReport } = await import("@/lib/qayyim/self-model");
    const model = await buildSelfModel(companyId ?? null);
    return { success: true, message: renderSelfReport(model), data: { agents: model.agents.length, tools: model.tools.length } };
  }
```

- [ ] **Step 4: Tests PASS + typecheck.**
- [ ] **Step 5: Commit** `feat(qayyim): qayyim_whoami live self-report tool`

---

### Task 3: identity injection into every chat turn

**Files:**
- Modify: `lib/agents/AgentOrchestrator.ts` (chat(), after lessons block ~:341)
- Test: extend `tests/qayyim/selfModel.test.ts` (renderIdentityLine already covered; add guard test that injection is failure-proof)

- [ ] **Step 1:** In `chat()` after the lessons try/catch add:

```ts
      // P6-M1: every agent knows itself before it speaks
      try {
        const { buildSelfModel, renderIdentityLine } = await import("@/lib/qayyim/self-model");
        const self = await buildSelfModel(resolvedCompanyId);
        promptWithToolContext = `${renderIdentityLine(selectedAgent, self)}\n\n${promptWithToolContext}`;
      } catch {}
```

- [ ] **Step 2:** Live check on dev server: chat «انت بتعمل ايه؟» must return the counters report (curl UTF-8 body file + x-internal-key; expect `tool: qayyim_whoami`).
- [ ] **Step 3: Commit** `feat(qayyim): inject live identity line into every agent turn`

---

### Task 4: retitle surfaces to «مدير تشغيل المحتوى»

**Files:**
- Modify: `app/admin/v2/agents/page.tsx` (card h2 + teaser line), `app/admin/v2/agents/qayyim/page.tsx` (none — inherits), `components/admin/agents/ChatPanel.tsx` (AGENT_METADATA 'qayyim-core' name → `مدير تشغيل المحتوى — قيّم الدار`), `components/admin/qayyim/QayyimStudio.tsx` (SWARM core entry + studio subtitle), `app/api/cron/qayyim-daily/route.ts` (proposal title → `تقرير مدير تشغيل المحتوى اليومي — يتطلب تدخل`)

- [ ] **Step 1:** Apply string edits (keys/DB values untouched).
- [ ] **Step 2:** `npm run typecheck && npx vitest run tests/qayyim/` green; grep confirms no remaining user-facing lone "قيّم الدار — القائد" in those five files.
- [ ] **Step 3: Commit** `feat(qayyim): adopt official job title across surfaces (P6-M1)`

---

### Task 5: honesty-protocol prompt rule + full gate

**Files:**
- Modify: `lib/qayyim/self-model.ts` (LIMITS array gains the refusal contract line — already included in Task 1 text)
- Test: `npx vitest run` full + product suites on prod after deploy

- [ ] **Step 1:** Full gate locally: `npm run typecheck && npx vitest run` (expect ≥245 passing).
- [ ] **Step 2:** Merge `qayyim/p6-m1` → main, push, wait deploy.
- [ ] **Step 3:** Prod verify: `node scripts/qayyim-product-test.mjs` (14/14) + live whoami via curl; screenshot seed card showing new title.
- [ ] **Step 4:** Update project memory (P6-M1 closed; next plan: M2 world-model).

## Self-Review Notes

- Spec coverage: M1 bullets (self-model, whoami, identity injection, retitling, refusal contract) → Tasks 1–5. ✅
- Placeholders: none — all code inline. `renderIdentityLine` typo note fixed at implementation.
- Type consistency: `SelfModel`/`buildSelfModel`/`renderSelfReport`/`renderIdentityLine` used identically in Tasks 1–3.
