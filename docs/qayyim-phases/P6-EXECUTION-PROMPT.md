# P6 EXECUTION PROMPT — «مدير تشغيل المحتوى» (Head of Digital Store Experience)
### Copy this entire file to any capable AI coding agent. It is self-contained.

---

## 0. ROLE & MISSION

You are a senior staff engineer executing Phase P6 on an existing production codebase. Your mission: transform the existing 8-agent "Qayyim al-Dar" swarm into a complete, self-aware machine holding the job title **«مدير تشغيل المحتوى»** (English subtitle: *Head of Digital Store Experience*). The governing principle is **ZERO SURPRISE**: everything achievable for $0 inside the store's data boundary must actually execute (not be stubbed), and every out-of-boundary request must be refused explicitly, naming the missing capability.

## 1. REPOSITORY CONTEXT (verify before coding)

- Repo: Next.js 16.2.2 (App Router, Turbopack) + Supabase (Postgres+pgvector) + Vercel Hobby. Working dir: `my-app/`. Main branch deploys automatically to `https://azenith-living.vercel.app`.
- Read `AGENTS.md` at repo root: this Next version may differ from your training data — consult `node_modules/next/dist/docs/` before writing framework code.
- Existing infrastructure you MUST reuse (do not reinvent):
  - Swarm: `lib/qayyim/*.ts` (8 agents `QayyimCoreAgent`…`QayyimQaAgent`), orchestrator `lib/qayyim/orchestrator/MasterOrchestrator.ts` (LangGraph).
  - Chat brain: `lib/qayyim/chat-brain.ts` (recallMemory + deriveActions + finalizeReply), `lib/qayyim/url-manifest.ts` (route truth), `lib/qayyim/debate.ts` (critic pass), `lib/qayyim/agent-roles.ts` (capability catalog per agent).
  - Intent routing: `lib/agents/intent-router.ts` (`routeIntent`: regex fast-path via `inferUltimateTool` in `lib/admin-tool-bridge.ts`, then Gemini, then Groq; whitelist `TOOL_CATALOG`).
  - Tool execution: `runUltimateTool()` in `lib/admin-tool-bridge.ts` (measured tools: qa_load_probe, qa_security_headers, qa_accessibility, qayyim_luxury_score, qayyim_goals_risk, seo_*, speed_*, backup_*, metrics_realtime, agent_memory_inspect, …).
  - Governance: `lib/qayyim/governance/ConstitutionEngine.ts` (11 rules, hard_block; identity law scans Arabic string VALUES only).
  - Events: `lib/qayyim/memory/SyncLayer.ts` → table `qayyim_sync_events`; SSE stream `/api/admin/agents/events/stream`.
  - Memory: `lib/qayyim/memory/SharedMemory.ts` (gemini-embedding-001, 768-dim, pgvector HNSW).
  - Chat entry: `app/api/admin/agents/chat/route.ts` → `lib/agents/AgentOrchestrator.ts` `chat()` (history injection, follow-up routing, tool short-circuit, finalizeReply).
  - UI: `app/admin/v2/agents/page.tsx` (seed card), `app/admin/v2/agents/qayyim/page.tsx` (fullscreen chat), `components/admin/agents/ChatPanel.tsx`, `components/admin/qayyim/QayyimStudio.tsx` (8 cards + 4 tabs).
  - Telegram (exists, NOT yet wired to Qayyim): `lib/admin-telegram-summon.ts`.
  - Test harnesses (run these, don't rewrite): `scripts/qayyim-product-test.mjs` (14 API scenarios), `scripts/qayyim-deep-test.mjs` (8 layers), `scripts/qayyim-ui-test.mjs` (browser incl. gate login), `scripts/qayyim-smoke.mjs`.
  - DB migrations: apply via Prisma client over `DIRECT_URL` (pattern proven): read `.env.local` with dotenv, `new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL}}})`, split SQL on `/;\s*\n/`, strip `--` comment lines, `await prisma.$executeRawUnsafe(stmt)` per statement.
- Env: `.env.local` holds all secrets (service key, INTERNAL_API_KEY, ADMIN_GATE_*, DIRECT_URL). Vercel prod env already has: ADMIN_COMPANY_ID, NEXT_PUBLIC_SITE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, NEXT_PUBLIC_SUPABASE_ANON_KEY.
- Company id resolution: `resolveAdminCompanyId()` (lib/admin-company.ts). Real company row: `dbb9b420-f2ec-4dd3-88d6-4d1a9a74364d` (never hardcode; resolve).

## 2. ABSOLUTE CONSTRAINTS (violating any = failed task)

1. **$0 only.** No new npm dependencies — every algorithm (Holt-Winters, z-test, etc.) is hand-written TypeScript with unit tests. No paid services.
2. **Never print/log secret values** (API keys, service key, gate password, TOTP, INTERNAL_API_KEY). Reference by env var NAME only. Pipe secrets via stdin/files, never argv.
3. **Never touch `lib/vanguard/**`.** Never re-add `.github/workflows/`. No cron schedule more frequent than daily (Vercel Hobby).
4. **No autonomous publishing.** Constitution rule 3 stands: content publish requires human approval. You may test gates with `action=constitution` (side-effect free). Do NOT run live publish→rollback on production content without explicit human instruction.
5. **Git safety:** no force-push, no `git reset --hard`, no history rewrite, no amend of pushed commits. Branch per milestone: `qayyim/p6-m1` … `qayyim/p6-m6`; fast-forward merge to `main` only after the full gate; push triggers deploy — wait ~3 min and verify.
6. **TDD:** write the failing test first, see it fail, minimal implementation, see it pass, commit. Every task ends with: `npm run typecheck` (0 errors) + `npx eslint <touched files>` (0 errors) + `npx vitest run` (all green, currently 245+).
7. **DB changes** only via new idempotent file `supabase/migrations/20260925_p6_<name>.sql` + Prisma apply + read-back verification.
8. **Agent keys stay** (`qayyim-core`… `qayyim-qa`); only display strings change.
9. Arabic UI copy: simplified formal Egyptian. English code identifiers.
10. When a test suite fails twice on the same assertion, stop and diagnose root cause — do not widen assertions to pass.

## 3. PHASES (execute in order; each independently shippable)

### M1 — Self-awareness (full bite-sized plan already exists: `docs/superpowers/plans/2026-09-25-p6-m1-self-model.md` — follow it exactly)
Deliverables: `lib/qayyim/self-model.ts` (buildSelfModel/renderSelfReport/renderIdentityLine), export `TOOL_CATALOG`, tool `qayyim_whoami` (regex: `أنت بتعمل إيه|بتقدر تعمل إيه|قدراتك|who are you|عرف نفسك`), identity line injected into every chat turn, retitle surfaces to «مدير تشغيل المحتوى» (card, ChatPanel AGENT_METADATA core entry, Studio subtitle, daily proposal title `تقرير مدير تشغيل المحتوى اليومي — يتطلب تدخل`).
Acceptance: prod chat `عرف نفسك` returns live counters report via `qayyim_whoami`; `node scripts/qayyim-product-test.mjs` 14/14.

### M2 — World model (دار-KG)
1. `lib/qayyim/world-model.ts`: `buildWorldModel(companyId): Promise<WorldModel>` — read-only aggregates ≤2KB JSON: last-90-day revenue & order count & top/bottom products (tables `sales_orders`, `payments`, `products`), room section counts, visitor telemetry 7-day trend, active goals + at-risk, open proposals, last-week consultant questions (`agent_messages` where conversation involves consultant — read schema first). Cache in a module-level promise with 10-min TTL.
2. `lib/qayyim/egypt-calendar.ts`: static array of 2026–2030 seasons (رمضان، عيد الفطر، عيد الأضحى، المدارس، الصيف) with start/end ISO dates + `currentSeason()`. Dates must be verified against an authoritative source at implementation time (no guessing; cite in code comment).
3. Inject world-model digest (≤1200 chars) into qayyim-core chat prompts after identity line (same try/catch pattern as lessons block in `AgentOrchestrator.chat`).
4. New tool `qayyim_world` (catalog entry + regex `ازاي الشغل|المبيعات الفترة دي|إيه اللي بيتبيع|world model`) returning a human Arabic digest from world-model.
5. Search Console integration: `lib/qayyim/gsc.ts` reading env `GSC_SITE_URL` + `GOOGLE_APPLICATION_CREDENTIALS_JSON` (both optional). If unset: tool `gsc_queries` returns honest refusal naming the missing env + 5-minute setup steps. DO NOT invent data. Add to TOOL_CATALOG + regex `كلمات بحث|search console|جوجل ليا`.
6. Competitor watcher: `lib/qayyim/rivals.ts` — table `qayyim_rivals(name TEXT, url TEXT, enabled BOOL)` via migration; weekly function `crawlRival(robots=true, maxPages=10)` reusing the fetch+cheerio pattern from `QayyimSeoAgent.fetchPageEvidence`; store snapshots in `qayyim_rival_snapshots(jsonb)`. Wire into existing daily cron file as a step that only runs on Mondays (cron stays daily — Hobby rule). Tool `qayyim_rivals` returns latest comparison digest.
Acceptance: `qayyim_world` answers «إيه اللي بيتبيع؟» with real numbers from `sales_orders` (or honest empty-state); world digest appears nowhere as hallucinated when tables are empty — assert via product-test addition.

### M3 — Mathematical brain
1. `lib/qayyim/stats.ts` pure functions + full unit tests: `mean, std, zScore, twoProportionZTest(n1,x1,n2,x2)→{z,p,treatmentWins|null}`, `holtWinters(series, {alpha,beta,gamma,seasonLength,horizon})→{forecast[],mape}` (additive seasonality; validate seasonLength ≤ floor(n/2) else fall back to double exponential), `detectAnomalies(series, k=3)`.
2. Wire: A/B tab (`QayyimExperimentsPanel` data source `/api/admin/qayyim/ab-test`) — extend its handler to include `verdict` from twoProportionZTest; experiments with p>0.05 must say «مش حاسم بعد — محتاج ~N زائر» (compute N via simple power approximation in stats.ts).
3. Forecast: tool `qayyim_forecast` (regex `توقع|الشهر الجاي|forecast`) — Holt-Winters on 90-day daily revenue; respond with numbers + MAPE + one-line caveat. If <2 data points: honest refusal.
4. Anomaly: in the daily cron add step: z-score on 7-day telemetry; |z|>3 → SyncLayer event `anomaly_detected` + proposal (existing createAdminProposal pattern).
5. Luxury Score v2: `lib/qayyim/luxury-v2.ts` — weighted composite of measured signals already available (seo_analyzer score, imgsMissingAlt ratio, loadProbe p95, products image-completeness). Keep old endpoint response shape; add `signals` breakdown. Unit-test the weighting.
Acceptance: stats unit tests ≥18; forecast tool returns numeric array + MAPE; A/B verdicts appear in ab-test response.

### M4 — Long arms
1. Wire Telegram: extend `app/api/cron/qayyim-daily/route.ts` — after proposal creation, if env `TELEGRAM_SUMMON_CHAT_ID` (or existing config used by `lib/admin-telegram-summon.ts` — read it first, reuse, don't duplicate) is set, send the daily story (≤1000 chars, Arabic, includes counters + top issue + link to `/admin/v2/agents/qayyim`). Failure → push to results.errors, never crash the round. Respect Bot API limits (single message/day — trivially safe).
2. Refusal contract: `lib/qayyim/chat-brain.ts` add `explainGap(message, selfModel): string|null` — when a reply would be a refusal (LLM said لا أستطيع/مش قادر/out of scope keywords), append the named missing capability from self-model limits + the shortest path to enable it. Unit tests.
3. Consultant autonomy: in `app/api/consultant/route.ts` check-reply flow, add confidence-gated auto-reply for FAQ intents (pricing policy, shipping, showroom hours) sourced ONLY from a new table `qayyim_faq(question, answer, approved_by)` seeded from existing content; threshold 0.8; anything else keeps human takeover (existing flow). Migration + tests.
Acceptance: daily cron response JSON shows `telegramSent` true/false with reason; refusal messages in chat carry a named gap.

### M5 — Immune system
1. `tests/qayyim/decisions.eval.test.ts`: ≥30 golden cases (no network; pure): routeIntent fast-path table (15 phrasings incl. hamza variants), parseIntent whitelist rejects, isRealPath table, deriveActions table, identity-law scan (Arabic+english value → block; JSON keys only → allow), shouldDebate, zTest known samples, holtWinters on synthetic seasonal series (MAPE < 10%), explainGap.
2. Weekly self-audit: new daily-cron step (runs Sundays): sample last 10 agent_messages (sender agent), run `debate.critiqueAndPolish`-style judge (reuse critic prompt, score-only variant), write rows to `qayyim_benchmarks` (exists — read schema; else migration) + SyncLayer event `self_audit_completed` with avg score.
3. Canary: cron step (daily): fetch `/api/health`-equivalent public pages + assert 200; on failure createAdminProposal «كاناري» — reuse existing patterns.
Acceptance: eval suite green; Sunday run produces a `self_audit_completed` row (verify by triggering cron with bearer CRON_SECRET on prod after deploy).

### M6 — Interface perfection
1. Command palette in ChatPanel: Ctrl/Cmd+K opens overlay listing self-model tools+roles (fetched from new endpoint `GET /api/admin/qayyim/self` returning buildSelfModel JSON); Enter sends the chosen capability prompt.
2. «اسأل عن نفسك» visual: studio card button opens a modal rendering the self JSON (agents grid, tools list, limits, counters) — client-safe (endpoint, not server module).
3. Continuous voice mode toggle: Web Speech with `continuous=true`, silence gate (auto-send after 1.2s silence), stop button; keep existing single-utterance mode as default.
4. Daily digest deep-link: Telegram message includes `https://…/admin/v2/agents/qayyim?proposal=<id>`; chat page reads `?proposal=` and preloads a decision card (approve/better/reject wired to existing proposal actions).
Acceptance: `node scripts/qayyim-ui-test.mjs` extended with palette + self modal checks, all PASS on prod.

## 4. FINAL DEFINITION OF DONE (whole P6)

- [ ] All six milestones merged to main, each with its own commits, full gate green at every merge.
- [ ] `node scripts/qayyim-product-test.mjs` → 14/14 on prod; `node scripts/qayyim-deep-test.mjs` → 10/10; `node scripts/qayyim-ui-test.mjs` → 11/11 (after its additions).
- [ ] Seed card + studio + reports display «مدير تشغيل المحتوى»; agent keys unchanged.
- [ ] «عرف نفسك» → live self report; «إيه اللي بيتبيع» → real numbers or honest empty; «توقع مبيعات الشهر الجاي» → Holt-Winters + MAPE; out-of-scope request → named-gap refusal.
- [ ] Zero new npm dependencies (`git diff main@{start} -- package.json` shows none).
- [ ] No secret ever appears in code, logs, commits, or transcripts.
- [ ] Docs updated: `docs/qayyim-phases/P6-content-operations-manager.md` status section + memory notes.
- [ ] Final report to the human in Egyptian Arabic: table per milestone (claim / evidence / file:line), known limitations honestly listed, next-phase candidates.

## 5. START COMMAND

Begin with M1 Step 1 of `docs/superpowers/plans/2026-09-25-p6-m1-self-model.md`: create branch `qayyim/p6-m1`, write the failing self-model test, run it, confirm RED. Work milestone by milestone; do not skip gates; stop and ask the human only on constraint conflicts (never on ambiguity you can resolve by reading the code).
