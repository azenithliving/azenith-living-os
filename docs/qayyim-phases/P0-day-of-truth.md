# PHASE P0 — Day of Truth (real numbers, real events, secrets out)

> 🇪🇬 ملخص: نصلح الأرقام الوهمية في لوحة `/admin/v2/agents` (مهام منجزة 0/0، luxury score null)، ونحوّل SSE من نبضات وهمية لأحداث حقيقية، ونطرد الـ JWT المسرب لملف env، ونركّب اللوحات اليتيمة، ونحذف ملفات .bak.

## Mission

Make the admin panel tell the truth: real task stats, real luxury score, real live events, no committed secrets, orphan panels mounted, repo cleaned of dated backups. Zero behavior rewrites beyond listed fixes.

## Pre-flight verification (run each; ALL must match before editing)

```bash
# 1. Stats bug: GET only lists pending
grep -n "get('status') || 'pending'" app/api/admin/agents/tasks/route.ts
# EXPECT: match at :32

# 2. Luxury score hardcoded null
grep -n "luxuryScore: null" app/admin/v2/agents/page.tsx
# EXPECT: match at :53

# 3. SSE heartbeat-only stub
grep -n "heartbeat_only" app/api/admin/agents/events/stream/route.ts
# EXPECT: match at :33

# 4. Committed service_role JWT
grep -n "SERVICE_ROLE_KEY\|SUPABASE_URL" scripts/run-migration.ts
# EXPECT: matches at :5-6 (hardcoded string literals, NOT process.env)

# 5. Lock route replaces task context
sed -n '58,72p' app/api/admin/agents/lock/route.ts
# EXPECT: .update({ context: { locked_resource_type: ... } }) — a REPLACING object (no spread of existing context)

# 6. Simulation writes fake rows
grep -n "enterprise_scenario" app/api/admin/agents/simulate-scenario/route.ts
# EXPECT: match at :248

# 7. Dated backups present
ls app/admin/page.tsx.20260923_180127.bak app/api/admin/qayyim/route.ts.20260923_175252.bak 2>/dev/null | wc -l
# EXPECT: 2 (sample of 13 dated backups)
```

If any check does not match → STOP and report. Do not proceed.

## Changes (exactly these, nothing more)

| # | File | Change |
|---|------|--------|
| 1 | `app/api/admin/agents/tasks/route.ts` | GET: accept `status=all` (keep default `pending`). When `status=all`: apply `limit` (default 50, cap 500) and return `{ tasks, counts }` where `counts` = `{pending, running, completed, failed, total}` computed for the same company scope. Other status values keep current single-status shape. |
| 2 | `app/admin/v2/agents/page.tsx` | Change fetch at :42 to `/api/admin/agents/tasks?status=all&limit=200` and read `counts` for totals. completedToday/successRate at :47-49 computed from returned `tasks`. Luxury score: add a second fetch exactly mirroring `components/admin/qayyim/QayyimStudio.tsx:53` — POST `/api/admin/qayyim/perf` body `{"action":"luxury_score","luxury_scope":"full_site"}` — and set `luxuryScore` from `result.data.luxury_score ?? null` instead of the literal `null` at :53. |
| 3 | `app/api/admin/agents/events/stream/route.ts` | Replace the heartbeat-only body with real event streaming: every 3s, select from `qayyim_sync_events` (`eq('company_id', companyId)`, `gt('id', lastId)`, order `created_at`, limit 50), enqueue each row as one SSE frame `data: ${JSON.stringify(event)}\n\n`, advance `lastId`. Keep the 25-30s heartbeat comment frame as liveness fallback. Keep the existing `request.signal` abort handling and `requireAdminApi` guard untouched. Reuse types via `import type { SyncEvent } from "@/lib/qayyim/memory/SyncLayer"`. Use `getSupabaseAdminClient` + `resolveAdminCompanyId` (same pattern as SyncLayer). `lastId` init: on stream start, seed with the newest event id at that moment (sub-select order desc limit 1) so the stream only shows NEW events. |
| 4 | `scripts/run-migration.ts` | Replace the hardcoded `SUPABASE_URL` / `SERVICE_ROLE_KEY` literals (:5-6) with `process.env.SUPABASE_URL` / `process.env.SUPABASE_SERVICE_ROLE_KEY`, loaded via `dotenv` (`import "dotenv/config"` — package exists). Add an explicit startup check: if either is missing, `throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")`. Do not change any SQL it applies. |
| 5 | `app/api/admin/agents/lock/route.ts` | POST acquire path (:58-72): before the update, `select('context').from('agent_tasks').eq('id', data.task_id).single()` and then update with `context: { ...existingContext, locked_resource_type, locked_resource_id, lock_expires_at, lock_acquired_at }` — MERGE, never replace. If the select fails, fall back to current replacing behavior and log a warning. |
| 6 | `app/api/admin/agents/simulate-scenario/route.ts` | Top of POST handler: `if (process.env.NODE_ENV === "production" && process.env.ALLOW_AGENT_SIMULATIONS !== "true") return NextResponse.json({ success:false, error:"Simulations disabled in production" }, { status: 403 })`. Additionally, every row this route inserts must set metadata `simulated: true` (merge into existing metadata objects) and prefix any human-readable title/name with `[SIM] `. |
| 7 | `components/admin/qayyim/QayyimStudio.tsx` | Mount the orphans (both are `'use client'`, need no props — read them first): in the observability tab render `<QayyimTelemetryPanel />`; in the overview tab render `<QayyimGoalsPanel />` below the StatCards; import both at top. Also import `QayyimQualityGate` and render it in the drafts tab, fed by draft constitution data when available, `null`-safe (component already returns null for null result). |
| 8 | `supabase/migrations/20260925_qayyim_visitor_telemetry.sql` | New migration creating `public.visitor_telemetry` with the columns actually used in `app/api/telemetry/route.ts` (`session_id`, `current_path`, `hovered_elements`, `attention_score`, plus `id uuid pk default gen_random_uuid()`, `created_at`/`updated_at` timestamptz defaults). Index on `session_id`. Enable RLS + service_role-only policies, copying the exact policy style from `supabase/migrations/20260923_qayyim_foundation.sql` (:458-469). Wrap in `create table if not exists` / `create index if not exists` so it is idempotent. |

## Deletions (exactly these 13)

```
app/admin/page.tsx.20260923_180127.bak
app/api/admin/qayyim/route.ts.20260923_175252.bak
app/api/admin/qayyim/route.ts.20260923_175327.bak
app/api/admin/qayyim/route.ts.20260923_175341.bak
app/api/admin/qayyim/route.ts.20260923_175542.bak
app/api/admin/qayyim/suggestions/route.ts.20260923_175514.bak
components/admin/agents/ChatPanel.tsx.20260923_175924.bak
components/admin/qayyim/QayyimDraftPreview.tsx.20260923_175359.bak
components/admin/qayyim/QayyimDraftPreview.tsx.20260923_175556.bak
components/admin/qayyim/QayyimDraftPreview.tsx.20260923_175613.bak
components/admin/qayyim/QayyimDraftPreview.tsx.20260923_175614.bak
components/admin/qayyim/QayyimStudio.tsx.20260923_175358.bak
lib/qayyim/api/utils.ts.20260923_173957.bak
lib/qayyim/index.ts.20260923_174408.bak
```

KEEP untouched: `data/browser-workspace/config/.config/labwc/menu.xml.bak`, `aaca/prisma/schema.prisma.bak`, all `sandbox/backups/*.bak`.

## Forbidden

- Do NOT change PATCH handler in `tasks/route.ts` (it correctly sets `started_at`/`completed_at`).
- Do NOT change the SSE auth guard or abort wiring.
- Do NOT print or log the new env values anywhere.
- Do NOT touch `.github/workflows/`, `vercel.json`, or any other route.
- Do NOT delete any keeper `.bak` listed above.

## Post-change verification

```bash
npm run typecheck
# EXPECT: exit 0

grep -n "process.env.SUPABASE_SERVICE_ROLE_KEY" scripts/run-migration.ts
# EXPECT: 1 match; and: git grep -n "eyJ" scripts/run-migration.ts ; EXPECT: no match

git status --porcelain | grep "\.bak" | wc -l
# EXPECT: 13 deleted (D) entries, and none of the 6 keepers listed

grep -rn "qayyim_sync_events" app/api/admin/agents/events/stream/route.ts
# EXPECT: ≥1 match (real polling wired)
```

Manual UI checks (state them in your report as done/not-done): `/admin/v2/agents` shows non-zero Completed/Success when tasks exist; luxury score card shows a number after perf call; create a draft in Studio → event appears in the agents page stream within ~5s.

## Definition of Done

- [ ] Pre-flight 1-7 all matched.
- [ ] Verification loop green (typecheck/lint/test).
- [ ] `tasks?status=all` returns rows of mixed statuses + `counts` object (curl with admin auth, paste summary).
- [ ] No literal secrets in `scripts/run-migration.ts`; startup throws without env.
- [ ] Exactly 13 dated `.bak` deleted; 6 keepers intact.
- [ ] QayyimStudio compiles with the 3 mounted components.
- [ ] Migration file exists and is idempotent.

## Rollback

```bash
git checkout main -- .            # if committed: git revert <p0-commit>
git clean -fd app components lib  # only if untracked leftovers from this phase
```

Note (report to user, not code): the old JWT is still in git history (commit 3e1b2a2). Rotating the service_role key in the Supabase dashboard is MANDATORY and manual: Dashboard → Project Settings → API → Reset service_role key, then update `SUPABASE_SERVICE_ROLE_KEY` in Vercel env and local `.env`.
