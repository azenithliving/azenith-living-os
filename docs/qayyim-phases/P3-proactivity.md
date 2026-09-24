# PHASE P3 — Proactivity (daily initiative, Hobby-compliant, event-driven)

> 🇪🇬 ملخص: "كرون كل 6 ساعات" مستحيل على Vercel Hobby (أقل فترة = مرة/يوم). الحل المتوافق: cron يومي ثانٍ يجمع الفحوصات ويرفع اقتراحاً واحداً، وقناة SyncLayer (polling كل 2 ثانية) هي المبادر اللحظي — مع ربط أحداث دورة حياة المهام وبوابة الجودة بالأحداث الحقيقية.

## Mission

Add one daily cron that proactively audits and proposes (instead of the impossible 6-hour cron), publish real lifecycle events through SyncLayer at the exact points tasks finish and quality gates run, and surface the live event feed in the Studio observability tab.

## Pre-flight verification

```bash
# 1. Only one cron exists, daily
cat vercel.json
# EXPECT: single entry { path: "/api/cron/admin-daily-report", schedule: "0 8 * * *" }

# 2. Cron auth pattern
sed -n '1,20p' app/api/cron/admin-daily-report/route.ts
# EXPECT: assertCronAuthorized(request) guard (:9), maxDuration 60 (:6), GET+POST wrappers

# 3. Proposal pattern
grep -n "createAdminProposal" lib/admin-sovereign-mind.ts | head -3
# EXPECT: exported; signature takes { title, description, reasoning, userMessage, intent, userEmail?, proactive }

# 4. SyncLayer helpers exist
grep -n "publishTaskStatus\|publishQualityGate\|publish(" lib/qayyim/memory/SyncLayer.ts
# EXPECT: publish (:210), publishTaskStatus, publishQualityGate defined

# 5. Lifecycle hook points — find where tasks complete
grep -n "completed_at\|status.*completed\|markComplete\|finish" lib/qayyim/orchestrator/MasterOrchestrator.ts | head -20
# EXPECT: candidate insertion point(s) — READ the surrounding code and choose the single place where a task's final result is committed. Record the line you chose.

# 6. Quality gate call site
grep -rn "constitutionEngine.checkAll\|checkAll(" lib/qayyim app/api/admin/qayyim/route.ts | head -10
# EXPECT: publish flow gates — choose the publish handler in app/api/admin/qayyim/route.ts (constitution check around :390-431)
```

## Changes

| # | File | Change |
|---|------|--------|
| 1 | NEW `app/api/cron/qayyim-daily/route.ts` | Mirror `admin-daily-report` structure: `export const maxDuration = 60`; `assertCronAuthorized` guard on GET+POST. Body: resolve company via `resolveAdminCompanyId()`; (a) POST `/api/admin/qayyim/perf`-equivalent internal call is NOT allowed from a route to itself — instead import and call the same underlying functions the perf route uses (read `app/api/admin/qayyim/perf/route.ts` FIRST and import its core logic if exported; if it is inline, extract the luxury-score computation into `lib/qayyim/perf/luxuryScore.ts` and have BOTH routes import it — extraction is in scope); (b) read goals: query the goals table used by `QayyimGoalsPanel` (find it via `app/api/admin/qayyim/goals/route.ts`) for `status='active'` rows past deadline or under 25% progress; (c) `syncLayer.initialize(companyId)` then `syncLayer.publish({ event_type:'context_update', source_agent:'qayyim-core', target_agents:[], payload:{ kind:'daily_round', luxuryScore, atRiskGoals } })`; (d) if `atRiskGoals.length > 0` OR `luxuryScore < 70` (guard null), create ONE `createAdminProposal({ title: "تقرير قيّم اليومي — يتطلب تدخل", description: <Arabic summary with real numbers>, reasoning: "جولة يومية مجدولة", userMessage: "راجع الأهداف المهددة واقتراحات النشر", intent: { kind:"analytics", analyticsDays: 1, confidence: 0.8 }, userEmail: process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim(), proactive: true })`. Wrap every sub-step in try/catch so one failure cannot kill the round; report partial results in the JSON response. |
| 2 | `vercel.json` | Add `{ "path": "/api/cron/qayyim-daily", "schedule": "0 7 * * *" }` to the existing `crons` array. Keep the existing entry untouched. Both are daily — never add a sub-daily schedule. |
| 3 | `lib/qayyim/orchestrator/MasterOrchestrator.ts` | At the exact finalization point you recorded in pre-flight #5: `await syncLayer.initialize(companyId)` once (reuse a module-level promise guard so repeated calls are cheap), then `syncLayer.publishTaskStatus(agentKey, taskId, outcome === 'success' ? 'completed' : 'failed', { summary: <≤200 chars> })`. On publish flow success in `app/api/admin/qayyim/route.ts` (after the constitution check at :400): `syncLayer.publishQualityGate('qayyim-core', draftId, report.overallPassed, blockingViolations)`; when the publish is blocked: also `syncLayer.publishViolation('qayyim-core', 'scope', {...})` is NOT wanted here — instead publish event_type `quality_gate_failed` (already covered by publishQualityGate) — and if the violation is identity-related keep it as quality_gate payload only. Initialize syncLayer with the request's companyId in that route. |
| 4 | `components/admin/qayyim/QayyimStudio.tsx` | In the observability tab, add a live feed: `useEffect` opens `new EventSource("/api/admin/agents/events/stream")`, appends events to a capped list (latest 30), renders type + source_agent + created_at; cleanup closes the source on unmount. This consumes the REAL stream built in P0 — if P0 is not merged yet, mount the component anyway behind the same endpoint and note the dependency in your report. |

## New files

- `app/api/cron/qayyim-daily/route.ts`
- `lib/qayyim/perf/luxuryScore.ts` (ONLY if perf logic is inline and needs extraction — see change #1)

## Forbidden

- NO cron schedule other than daily. NO sub-daily polling cron.
- NO Redis/Socket.io/external bus — SyncLayer polling is the transport.
- NO self-HTTP-fetch from the cron route to its own origin — import functions directly.
- Do NOT auto-publish anything — proposals stay human-approved (Constitution rule 3).
- Do NOT touch the existing `admin-daily-report` cron entry or schedule.

## Post-change verification

```bash
npm run typecheck
npx eslint app/api/cron/qayyim-daily lib/qayyim/perf components/admin/qayyim/QayyimStudio.tsx
node -e "const v=require('./vercel.json'); const bad=v.crons.filter(c=>!/^\d+ \d+ \* \* \*$/.test(c.schedule)); if(bad.length){console.error('sub-daily cron!',bad);process.exit(1)} console.log('crons OK:',v.crons.length)"
# EXPECT: "crons OK: 2", exit 0

# local cron hit (with dev server + CRON_SECRET set per lib/cron-auth):
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/qayyim-daily
# EXPECT: {"success":true,...} JSON; and a qayyim_sync_events row appears (check Supabase table)
```

## Definition of Done

- [ ] Pre-flight 1-6 matched; chosen insertion lines recorded in the report.
- [ ] Exactly 2 crons in vercel.json, both daily.
- [ ] Cron endpoint returns success JSON and writes one `context_update` event.
- [ ] Completing an agent task produces an `agent_task_completed`/`failed` row in `qayyim_sync_events` within seconds.
- [ ] A blocked publish produces `quality_gate_failed`; an approved publish produces `quality_gate_passed`.
- [ ] Studio observability tab shows live events without page reload.
- [ ] Verification loop green.

## Rollback

```bash
git revert <p3-commit>
# vercel.json reverts automatically with the commit; no DB objects created.
```
