# PHASE P4 — Cleanup & Governance (delete the dead, keep one honest gate)

> 🇪🇬 ملخص: حذف 7 وحدات ميتة (TaskDecomposer/AgentRouter/ResultAggregator/3 graphs/RedTeamEngine/KnowledgeGraph/OPAEngine) بعد التأكد أن لا أحد يستوردها فعلياً، وتوحيد الحوكمة على ConstitutionEngine الوحيد الصادق — مع تنظيف ملفات الـ exports.

## Mission

Remove dead code proven unused (except two modules that ARE wired and are therefore cleaned honestly instead), leaving ConstitutionEngine as the single real governance gate. Every deletion is grep-verified first.

## Pre-flight verification

```bash
# 1. Dead modules: only definitions + re-exports, zero real callers
grep -rn "TaskDecomposer\|AgentRouter\|ResultAggregator\|RedTeamEngine\|runAuditGraph\|runDraftGraph\|runPublishGraph" app components lib --include=*.ts --include=*.tsx | grep -v "^lib/qayyim/orchestrator/TaskDecomposer.ts\|^lib/qayyim/orchestrator/AgentRouter.ts\|^lib/qayyim/orchestrator/ResultAggregator.ts\|^lib/qayyim/RedTeamEngine.ts\|^lib/qayyim/orchestrator/graphs/\|^lib/qayyim/index.ts"
# EXPECT: ZERO output. Any other file listed = STOP and report (something IS using it).

# 2. KnowledgeGraph real callers (known: stats handler + memory index)
grep -rn "KnowledgeGraph" app components lib --include=*.ts --include=*.tsx | grep -v "lib/vanguard" | grep -v "lib/qayyim/memory/KnowledgeGraph.ts"
# EXPECT: only lib/qayyim/index.ts (:35-36) and app/api/admin/qayyim/route.ts (:602-603) — the vanguard hit is a SEPARATE unrelated module, never touch it.

# 3. OPA real callers
grep -rn "OPAEngine\|opaEngine" app components lib --include=*.ts --include=*.tsx | grep -v "lib/qayyim/governance/OPAEngine.ts"
# EXPECT: only lib/qayyim/index.ts (:24-25) and app/api/admin/qayyim/route.ts (:10 import, :424 usage)

# 4. OPA is a stub anyway
sed -n '371,376p' lib/qayyim/governance/OPAEngine.ts
# EXPECT: opaAvailable=false / TypeScript fallback logging

# 5. memory barrel exists
cat lib/qayyim/memory/index.ts
# EXPECT: re-exports KnowledgeGraph (:11-12) among others
```

## Changes

| # | File | Change |
|---|------|--------|
| 1 | DELETE 7 files | `lib/qayyim/orchestrator/TaskDecomposer.ts`, `lib/qayyim/orchestrator/AgentRouter.ts`, `lib/qayyim/orchestrator/ResultAggregator.ts`, `lib/qayyim/orchestrator/graphs/audit.graph.ts`, `lib/qayyim/orchestrator/graphs/draft.graph.ts`, `lib/qayyim/orchestrator/graphs/publish.graph.ts`, `lib/qayyim/RedTeamEngine.ts`, `lib/qayyim/memory/KnowledgeGraph.ts`, `lib/qayyim/governance/OPAEngine.ts` (9 files total — remove the now-empty `graphs/` directory too). |
| 2 | `lib/qayyim/index.ts` | Remove the re-export lines for the deleted modules: OPA (:24-25), KnowledgeGraph (:35-36), RedTeamEngine (:64-65), TaskDecomposer (:68-69), AgentRouter (:71-72), ResultAggregator (:74-75), graphs (:78-85). Leave everything else exactly as-is. |
| 3 | `lib/qayyim/memory/index.ts` | Remove KnowledgeGraph re-export lines (:11-12). |
| 4 | `app/api/admin/qayyim/route.ts` | (a) Delete import of `opaEngine` (:10). (b) In `handleConstitutionCheck` (:390-431): delete the `opaInput` construction and `opaEngine.evaluate` call; response becomes `{ success: true, constitution_report: report, overall_allowed: report.overallPassed }` (same shape minus OPA fields). (c) In `handleStats` (:588-616): delete the KnowledgeGraph block (:602-605) and the `knowledge_graph` field from the response. Nothing else in this file changes. |
| 5 | NEW `docs/qayyim-phases/GOVERNANCE.md` (one page) | Document the single gate: ConstitutionEngine 10 rules + where `checkAll` runs (constitution_check action) + SyncLayer audit events (quality_gate_passed/failed, violations) as the observability trail. 20 lines max. |

## New files

- `docs/qayyim-phases/GOVERNANCE.md` (above only).

## Forbidden

- Do NOT touch `lib/vanguard/**` — its task_decomposer/citation_engine are separate living modules.
- Do NOT delete `ConstitutionEngine.ts`, `SharedMemory.ts`, `VectorStore.ts`, `SyncLayer.ts`, `SwarmLearnings.ts`, ab-testing, benchmarks — they are live.
- Do NOT change the MasterOrchestrator graph logic.
- Do NOT remove API response fields other than `opa_decision` / `knowledge_graph` (callers in the admin UI may read `overall_allowed` — keep it).
- No behavior changes to any surviving route.

## Post-change verification

```bash
npm run typecheck
npx eslint app/api/admin/qayyim/route.ts lib/qayyim/index.ts lib/qayyim/memory/index.ts
npm test
# EXPECT: all exit 0

grep -rn "OPAEngine\|opaEngine\|KnowledgeGraph\|knowledgeGraph\|TaskDecomposer\|AgentRouter\|ResultAggregator\|RedTeamEngine\|runAuditGraph\|runDraftGraph\|runPublishGraph" app components lib --include=*.ts --include=*.tsx | grep -v "lib/vanguard"
# EXPECT: ZERO matches (in lib/qayyim scope; vanguard excluded)

grep -c "constitutionEngine.checkAll" app/api/admin/qayyim/route.ts
# EXPECT: ≥1 (the real gate still runs)
```

Manual (state done/not-done): call `?action=constitution_check` with a draft payload missing evidence → `overall_allowed:false` with violations; with evidence+approval → `true`.

## Definition of Done

- [ ] Pre-flight 1-5 matched.
- [ ] 9 files deleted; `graphs/` dir gone; both barrels clean.
- [ ] Zero grep references outside vanguard.
- [ ] constitution_check endpoint works with identical semantics minus OPA.
- [ ] `handleStats` returns memory/learnings/vectors only.
- [ ] Verification loop green (typecheck + lint + full test suite).

## Rollback

```bash
git revert <p4-commit>
# Restores all 9 files and both barrels. No DB changes.
```

## Sequencing note

P4 touches `app/api/admin/qayyim/route.ts`, which P0 and P3 also edit (different functions — P0 does not touch this file; P3 edits its publish flow region around :380-431). If P3 is merged first, rebase P4 and expect a trivial conflict in `handleConstitutionCheck` — resolve by keeping the P3 event-publication lines and P4's OPA removal. If P0/P3 are not merged yet, P4 applies cleanly as-is.
