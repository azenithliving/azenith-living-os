# Qayyim Governance — Single Gate Architecture

After P4 cleanup, governance is unified under **ConstitutionEngine** with full observability through SyncLayer events.

## The Single Gate: ConstitutionEngine

**Location**: `lib/qayyim/governance/ConstitutionEngine.ts`

**10 Constitutional Rules** (all enforced):
1. **No Hallucination** — every claim needs evidenceUrl
2. **Identity Law** — Arabic luxury only
3. **No Code** — agents don't touch codebase
4. **Evidence-Based** — all changes backed by data
5. **Human Approval** — critical actions need approval
6. **Scope Compliance** — agents stay in their lanes
7. **No Data Leak** — sensitive info protected
8. **Fact-Check** — claims verified against reality
9. **Rollback Safe** — all changes reversible
10. **Quality Threshold** — minimum standards enforced

**Entry Point**: `app/api/admin/qayyim/route.ts` → `handleConstitutionCheck`

**Input**: `ConstitutionCheckInput` (agentKey, actionType, content, evidenceUrls, humanApproval, etc.)

**Output**: `ConstitutionReport` (overallPassed, results[], summary)

## Observability Trail

All governance events flow through **SyncLayer** (`lib/qayyim/memory/SyncLayer.ts`):

- `quality_gate_passed` — draft cleared all checks
- `quality_gate_failed` — draft blocked, violations attached
- `agent_task_completed` / `agent_task_failed` — task lifecycle
- `context_update` — daily proactive rounds

**Live Stream**: `/api/admin/agents/events/stream` (Server-Sent Events, 3s polling)

**Studio View**: QayyimStudio → Observability tab → LiveEventsPanel

## What Was Removed (P4)

- **OPAEngine** — Rego stub, TypeScript fallback only
- **KnowledgeGraph** — unused graph relations
- **TaskDecomposer / AgentRouter / ResultAggregator** — replaced by MasterOrchestrator StateGraph
- **Red Team attacks / specialized graphs** — never wired

ConstitutionEngine remains the **sole enforcer**. SyncLayer provides **full audit trail**.
