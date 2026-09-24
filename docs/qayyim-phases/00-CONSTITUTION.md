# QAYYIM Execution — Universal Constitution (PREPEND TO EVERY PHASE)

> 🇪🇬 ملخص للمستخدم: الصق هذا الملف قبل أي ملف مرحلة عند التنفيذ مع أي AI Agent. هو الدستور المشترك اللي يمنع الأخطاء.

You are executing ONE phase of the Qayyim hardening plan in the repo `azenith-living` (Next.js 16.2.2 + Supabase + Vercel Hobby). Obey every rule below. They are not negotiable.

## 0. Ground rules

1. **Read before write.** Before editing any file, READ it fully. Never edit from assumptions.
2. **Next.js is non-standard.** This repo pins Next.js 16.2.2 with custom docs. BEFORE using any Next.js API (route handlers, cookies, streaming, `export const`, caching), read the matching guide under `node_modules/next/dist/docs/`. Heed deprecation notices.
3. **Zero new paid dependencies.** Use only what exists in `package.json` (notably: `cheerio`, `@google/generative-ai`, `zod`, `playwright` (dev), `dotenv`, `@supabase/supabase-js`). If something is missing, build it in-repo — do NOT `npm install` anything without explicit approval.
4. **Zero new secrets.** All keys come from Supabase `api_keys` table or existing env vars. Never hardcode a key. Never print a key.
5. **DB changes = migrations only.** Any table/column/index change goes in a new file under `supabase/migrations/YYYYMMDD_description.sql`. Never create tables via dashboard or runtime SQL outside migrations (except the advisory-lock RPC which already exists). Follow the RLS pattern in `supabase/migrations/20260923_qayyim_foundation.sql` (service_role-only policies).
6. **Do NOT touch `.github/workflows/`.** CI was deliberately removed (commits 63233a4, 3132da8, d386a18). Do not re-add any workflow.
7. **Vercel Hobby cron = once per day minimum interval.** Never add a cron more frequent than daily — the deploy will fail. Precision ±59 min is acceptable.
8. **No destructive git.** Work on a branch `qayyim/<phase>`. Never force-push, never rewrite history, never `git reset --hard`.
9. **Minimal diffs.** Touch only the files listed in your phase. No drive-by refactors, no renames of things other files import (verify with `grep -rn "<symbol>" app components lib` first).
10. **Honesty over polish.** If a verification command output does NOT match the expected output, STOP, report the actual output, and do not improvise a fix outside the phase scope.

## 1. Project facts (verified, cite these)

- Agent swarm entry: `app/api/admin/agents/chat/route.ts` → `lib/agents/AgentOrchestrator.ts` → `lib/qayyim/orchestrator/MasterOrchestrator.ts` (LangGraph StateGraph) → 8 agents under `lib/qayyim/` (base class `QayyimAgentBase`).
- LLM calls: NEVER fetch/env directly in `lib/qayyim/**`. Route through `askOrchestratorMessages` in `lib/ai-orchestrator.ts`.
- Supabase clients: `supabaseServer` / DALs from `@/lib/dal/unified-supabase`; admin: `getSupabaseAdminClient` from `@/lib/supabase-admin`; company resolution: `resolveAdminCompanyId` from `@/lib/admin-company`.
- Drafts & publish: `lib/qayyim-ops.ts` (`createQayyimDraft`, constitution-gated publish/rollback). Drafts table: `qayyim_drafts`.
- Governance: `lib/qayyim/governance/ConstitutionEngine.ts` (10 real rules, runs checks locally — no LLM).
- Events/locks: `lib/qayyim/memory/SyncLayer.ts` — pub/sub via `qayyim_sync_events` table (2s polling), `publish*()` helpers, advisory locks via `pg_try_advisory_lock`.
- Migrations of record: `supabase/migrations/20260923_qayyim_foundation.sql`, `20260923_qayyim_swarm.sql`, `20260923_qayyim_facade.sql`.

## 2. Mandatory verification loop (run after every phase)

```bash
npm run typecheck          # must exit 0
npx eslint <changed files> # must exit 0
npm test                   # must exit 0 (if tests exist for touched area)
```

If any fails, fix and re-run. Only then declare done.

## 3. Definition of done (all phases)

- [ ] Every pre-flight check matched its expected output BEFORE editing.
- [ ] Every change listed in the phase is applied, nothing extra.
- [ ] Verification loop green.
- [ ] Each DoD item in the phase is demonstrably true (command + output).
- [ ] Rollback path documented in the final report.
