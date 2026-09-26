# P7 — تقاعد هوية «قيّم الدار» Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the «قيّم الدار» / `qayyim-*` identity from every layer of the store — stored values, agent keys, prompts, display strings, folders, API routes, tool ids, DB tables and the cron path — leaving «مدير تشغيل المحتوى» as the only human-facing title and «سرب أزينث» as the swarm name.

**Architecture:** One identity module (`lib/ops/identity.ts`) becomes the single source for agent keys, Arabic labels and the legacy↔new mapping. Stored values are migrated first (data, not schema), then code and routes move behind permanent redirects, then prose and prompts are regenerated from the identity module, and only at the end are tables renamed and every alias removed.

**Tech Stack:** Next.js 16.2 App Router, TypeScript, vitest (node env), Supabase/Postgres via Prisma `DIRECT_URL`, Playwright suite in `scripts/`.

**Spec:** `docs/superpowers/specs/2026-09-26-p7-retire-qayyim-identity-design.md`

## Global Constraints

- $0: **no new npm dependencies** — `git diff package.json` must stay empty.
- **Never print or log a secret value**; env var NAMES only. Secrets via stdin/files, never argv.
- **Never touch `lib/vanguard/**`.** `neural_stream.agent_name` belongs to vanguard — out of scope.
- No cron more frequent than daily (Vercel Hobby). No `.github/workflows/`.
- TDD: failing test first, see it fail, minimal implementation, see it pass, commit.
- Every task ends with: `npm run typecheck` (0 errors) · `npx eslint <touched files>` (0 errors) · `npx vitest run` (all green).
- DB changes only through an idempotent file `supabase/migrations/20260927_p7_*.sql`, applied with `node scripts/apply-p6-migration.mjs <file> --apply`, then read back.
- Arabic UI copy: simplified Egyptian. The owner is a man — masculine address. No Latin token inside an Arabic sentence.
- Git: no force-push, no `git reset --hard`, no history rewrite, no amend of pushed commits. Push triggers a deploy — wait ~4 minutes and verify on `https://azenith-living.vercel.app`.
- **The agent-key rename is atomic** (Task 2): catalogs, literals, writers and prompts change in one commit, after the data migration. A half-renamed key set returns `undefined` from the role catalog and breaks the live chat.
- The owner runs his own `next dev` on port 3000: never kill it, never start a second dev server. To verify a production build locally use `npx next start -p 3112` and kill **that PID only**.
- No autonomous publishing to live content. Constitution gate stays human-approved.

**Naming map (verbatim, used by every task):**

| old | new |
|---|---|
| `qayyim-core` | `ops-lead` |
| `qayyim-cont` | `ops-content` |
| `qayyim-vis` | `ops-visual` |
| `qayyim-seo` | `ops-seo` |
| `qayyim-ux` | `ops-ux` |
| `qayyim-ana` | `ops-analytics` |
| `qayyim-dev` | `ops-dev` |
| `qayyim-qa` | `ops-qa` |
| `qayyim_whoami` | `ops_self` |
| `qayyim_world` | `ops_world` |
| `qayyim_rivals` | `ops_rivals` |
| `qayyim_forecast` | `ops_forecast` |
| `qayyim_luxury_score` | `ops_luxury_score` |
| `qayyim_goals_risk` | `ops_goals_risk` |
| `lib/qayyim/` | `lib/ops/` |
| `app/api/admin/qayyim/*` | `app/api/admin/ops/*` |
| `app/admin/v2/qayyim` | `app/admin/v2/ops` |
| `app/api/cron/qayyim-daily` | `app/api/cron/ops-daily` |
| `app/api/cron/qayyim-proactive` | `app/api/cron/ops-proactive` |
| «سرب قيّم الدار» | «سرب أزينث» |
| «قيّم الدار — المحتوى» | «وكيل المحتوى» |
| «قيّم الدار — المرئيات» | «وكيل المرئيات» |
| «قيّم الدار — الظهور والبحث» | «وكيل الظهور» |
| «قيّم الدار — تجربة المستخدم» | «وكيل التجربة» |
| «قيّم الدار — التحليلات والأعمال» | «وكيل التحليلات» |
| «قيّم الدار — التطوير» | «وكيل التطوير» |
| «قيّم الدار — الجودة» | «وكيل الجودة» |

---

## Milestone 1 — the identity layer (code only, zero data touched)

### Task 1: `lib/ops/identity.ts`

**Files:**
- Create: `lib/ops/identity.ts`
- Test: `tests/ops/identity.test.ts`

**Interfaces:**
- Produces: `AGENT_KEYS: readonly OpsAgentKey[]`, `type OpsAgentKey`, `LEADER_TITLE: string`, `SWARM_NAME: string`, `legacyToOps(key: string): OpsAgentKey`, `opsToLegacy(key: string): string | null`, `agentLabel(key: string): string`, `storedSenderName(key: string): string`, `isOpsKey(value: string): boolean`.
- Consumed by: Tasks 2–14 (every other task reads names from here).

- [ ] **Step 1: Write the failing test**

Create `tests/ops/identity.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  AGENT_KEYS, LEADER_TITLE, SWARM_NAME,
  legacyToOps, opsToLegacy, agentLabel, storedSenderName, isOpsKey,
} from "@/lib/ops/identity";

describe("the swarm's identity", () => {
  it("names the leader by job title and the swarm by the store", () => {
    expect(LEADER_TITLE).toBe("مدير تشغيل المحتوى");
    expect(SWARM_NAME).toBe("سرب أزينث");
  });

  it("maps every legacy key to exactly one new key", () => {
    const legacy = [
      "qayyim-core", "qayyim-cont", "qayyim-vis", "qayyim-seo",
      "qayyim-ux", "qayyim-ana", "qayyim-dev", "qayyim-qa",
    ];
    expect(legacy.map(legacyToOps)).toEqual([...AGENT_KEYS]);
    for (const k of legacy) expect(isOpsKey(legacyToOps(k))).toBe(true);
  });

  it("reverses the map without losing a key", () => {
    for (const k of AGENT_KEYS) expect(opsToLegacy(k)).toMatch(/^qayyim-/);
    for (const k of AGENT_KEYS) expect(legacyToOps(opsToLegacy(k) as string)).toBe(k);
  });

  it("never labels an agent with the retired brand", () => {
    for (const k of AGENT_KEYS) {
      expect(agentLabel(k)).not.toMatch(/قيّم الدار|qayyim/i);
      expect(agentLabel(k).length).toBeGreaterThan(3);
    }
    expect(agentLabel("ops-lead")).toBe(LEADER_TITLE);
  });

  it("keeps the stored sender-name convention (upper-cased key)", () => {
    expect(storedSenderName("ops-lead")).toBe("OPS-LEAD");
  });

  it("refuses to invent a key it does not know", () => {
    expect(isOpsKey("qayyim-core")).toBe(false);
    expect(agentLabel("nope")).toBe("nope");
  });
});
```

- [ ] **Step 2: Run it, see it fail**

Run: `npx vitest run tests/ops/identity.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ops/identity'`.

- [ ] **Step 3: Write the module**

Create `lib/ops/identity.ts`:

```ts
/**
 * The swarm's identity, in one place.
 *
 * P7 retired «قيّم الدار»: the leader is a job title, the swarm belongs to the
 * store, and the members are roles. Anything that needs a key or a name reads it
 * here, so a rename can never again be half-done across forty files.
 */
export const AGENT_KEYS = [
  "ops-lead", "ops-content", "ops-visual", "ops-seo",
  "ops-ux", "ops-analytics", "ops-dev", "ops-qa",
] as const;

export type OpsAgentKey = (typeof AGENT_KEYS)[number];

export const LEADER_TITLE = "مدير تشغيل المحتوى";
export const SWARM_NAME = "سرب أزينث";

const LABELS: Record<OpsAgentKey, string> = {
  "ops-lead": LEADER_TITLE,
  "ops-content": "وكيل المحتوى",
  "ops-visual": "وكيل المرئيات",
  "ops-seo": "وكيل الظهور",
  "ops-ux": "وكيل التجربة",
  "ops-analytics": "وكيل التحليلات",
  "ops-dev": "وكيل التطوير",
  "ops-qa": "وكيل الجودة",
};

const LEGACY: Record<OpsAgentKey, string> = {
  "ops-lead": "qayyim-core",
  "ops-content": "qayyim-cont",
  "ops-visual": "qayyim-vis",
  "ops-seo": "qayyim-seo",
  "ops-ux": "qayyim-ux",
  "ops-analytics": "qayyim-ana",
  "ops-dev": "qayyim-dev",
  "ops-qa": "qayyim-qa",
};

const FROM_LEGACY: Record<string, OpsAgentKey> = Object.fromEntries(
  (Object.keys(LEGACY) as OpsAgentKey[]).map((ops) => [LEGACY[ops], ops])
) as Record<string, OpsAgentKey>;

export function isOpsKey(value: string): value is OpsAgentKey {
  return (AGENT_KEYS as readonly string[]).includes(value);
}

/** Unknown input is returned unchanged — a wrong key must never become a guess. */
export function legacyToOps(key: string): OpsAgentKey {
  return FROM_LEGACY[key] ?? (key as OpsAgentKey);
}

export function opsToLegacy(key: string): string | null {
  const ops = legacyToOps(key);
  return LEGACY[ops as OpsAgentKey] ?? null;
}

export function agentLabel(key: string): string {
  const ops = legacyToOps(key);
  return LABELS[ops] ?? key;
}

/** `agent_messages.sender_name` stores the key upper-cased; keep that shape. */
export function storedSenderName(key: string): string {
  return legacyToOps(key).toUpperCase();
}
```

- [ ] **Step 4: Run the test, see it pass**

Run: `npx vitest run tests/ops/identity.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/ops/identity.ts tests/ops/identity.test.ts
git commit -m "feat(ops): one module owns the swarm's keys and names (P7-M1)"
```

### Task 2: the atomicity rule (no code change — read this before Task 5)

Attempted during drafting and rejected: re-keying `AGENT_ROLES` alone. The app passes
`agent_key` from URL params, saved localStorage and DB rows into that catalog, so a
catalog keyed `ops-*` while its callers still say `qayyim-*` returns `undefined` and
the live chat breaks on the next deploy.

- [ ] **Step 1: Accept the rule**

**The key rename is atomic.** Catalogs (`agent-roles`, `AGENT_PERSONAS`, `AGENT_REGISTRY`,
zod enums, `VALID_AGENTS` lists), every literal in `lib app components`, the two
`sender_name` writers, the prompt text and the tool ids all change in **one commit
series inside Milestone 3**, and Milestone 2's data migration is applied first so the
stored rows already speak `ops-*`.

- [ ] **Step 2: Nothing to commit**

Task 1 is the whole of Milestone 1. Milestone 2 starts at Task 4.

### Task 3: Milestone 1 closes inert

`lib/ops/identity.ts` is imported by nothing yet, so there is no behaviour to deploy
and no deploy gate to run. Verification is the unit suite; the first production
verification happens after Milestone 3's sweep (Task 7 Step 6).

- [ ] **Step 1: Confirm nothing imports it yet**

```bash
grep -rln "lib/ops/identity" --include=*.ts --include=*.tsx lib app components
```

Expected: only test files. If a source file already imports it, stop — the atomicity
rule in Task 2 means that coupling belongs in Task 5.

---

## Milestone 2 — migrate stored values (data, not schema)

### Task 4: the values migration

**Files:**
- Create: `supabase/migrations/20260927_p7_identity_values.sql`
- Create: `scripts/p7-verify-values.mjs`

**Interfaces:**
- Consumes: the naming map above.
- Produces: zero rows anywhere carrying `qayyim-*` keys or the Arabic brand in the five live columns; `_p7_backup_*` snapshots of exactly those five tables.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260927_p7_identity_values.sql`. `--SPLIT--` separates statements because the applier cannot split inside `DO $$` bodies:

```sql
-- P7: retire the old identity in stored values. Idempotent: every statement is
-- a no-op once the data already speaks the new keys.
DO $$
DECLARE t text; r record;
BEGIN
  FOREACH t IN ARRAY ARRAY['agent_messages','agent_profiles','enterprise_agents','qayyim_sync_events','qayyim_benchmark_runs']
  LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS public._p7_backup_%I (LIKE public.%I INCLUDING ALL)', t, t);
    EXECUTE format('INSERT INTO public._p7_backup_%I SELECT * FROM public.%I ON CONFLICT DO NOTHING', t, t);
  END LOOP;
END $$;
--SPLIT--
UPDATE agent_messages SET sender_name = CASE upper(sender_name)
  WHEN 'QAYYIM-CORE' THEN 'OPS-LEAD'    WHEN 'QAYYIM-CONT' THEN 'OPS-CONTENT'
  WHEN 'QAYYIM-VIS'  THEN 'OPS-VISUAL'  WHEN 'QAYYIM-SEO'  THEN 'OPS-SEO'
  WHEN 'QAYYIM-UX'   THEN 'OPS-UX'      WHEN 'QAYYIM-ANA'  THEN 'OPS-ANALYTICS'
  WHEN 'QAYYIM-DEV'  THEN 'OPS-DEV'     WHEN 'QAYYIM-QA'   THEN 'OPS-QA'
  ELSE sender_name END
WHERE upper(sender_name) LIKE 'QAYYIM-%';
--SPLIT--
UPDATE agent_profiles SET agent_key = CASE agent_key
  WHEN 'qayyim-core' THEN 'ops-lead'    WHEN 'qayyim-cont' THEN 'ops-content'
  WHEN 'qayyim-vis'  THEN 'ops-visual'  WHEN 'qayyim-seo'  THEN 'ops-seo'
  WHEN 'qayyim-ux'   THEN 'ops-ux'      WHEN 'qayyim-ana'  THEN 'ops-analytics'
  WHEN 'qayyim-dev'  THEN 'ops-dev'     WHEN 'qayyim-qa'   THEN 'ops-qa'
  ELSE agent_key END WHERE agent_key LIKE 'qayyim-%';
--SPLIT--
UPDATE agent_profiles SET name = CASE name
  WHEN 'قيّم الدار - الجودة والاختبار'   THEN 'وكيل الجودة'
  WHEN 'قيّم الدار - المحتوى والعربية'   THEN 'وكيل المحتوى'
  WHEN 'قيّم الدار - الظهور والبحث'      THEN 'وكيل الظهور'
  WHEN 'قيّم الدار - التحليلات والأعمال' THEN 'وكيل التحليلات'
  WHEN 'قيّم الدار - تجربة المستخدم'     THEN 'وكيل التجربة'
  WHEN 'قيّم الدار - المرئي والصور'      THEN 'وكيل المرئيات'
  WHEN 'قيّم الدار - التطوير'            THEN 'وكيل التطوير'
  WHEN 'قيّم الدار - القائد'             THEN 'مدير تشغيل المحتوى'
  ELSE name END
WHERE name LIKE '%قيّم الدار%';
--SPLIT--
UPDATE enterprise_agents SET agent_key = CASE agent_key
  WHEN 'qayyim-core' THEN 'ops-lead' ELSE agent_key END WHERE agent_key LIKE 'qayyim-%';
--SPLIT--
UPDATE qayyim_sync_events SET source_agent = CASE source_agent
  WHEN 'qayyim-core' THEN 'ops-lead'    WHEN 'qayyim-cont' THEN 'ops-content'
  WHEN 'qayyim-vis'  THEN 'ops-visual'  WHEN 'qayyim-seo'  THEN 'ops-seo'
  WHEN 'qayyim-ux'   THEN 'ops-ux'      WHEN 'qayyim-ana'  THEN 'ops-analytics'
  WHEN 'qayyim-dev'  THEN 'ops-dev'     WHEN 'qayyim-qa'   THEN 'ops-qa'
  ELSE source_agent END WHERE source_agent LIKE 'qayyim-%';
--SPLIT--
UPDATE qayyim_benchmark_runs SET agent_key = CASE agent_key
  WHEN 'qayyim-core' THEN 'ops-lead'    WHEN 'QAYYIM-CORE' THEN 'OPS-LEAD'
  WHEN 'QAYYIM-CONT' THEN 'OPS-CONTENT' WHEN 'qayyim-ana'  THEN 'ops-analytics'
  WHEN 'qayyim-ux'   THEN 'ops-ux'      WHEN 'qayyim-dev'  THEN 'ops-dev'
  WHEN 'qayyim-qa'   THEN 'ops-qa'
  ELSE agent_key END WHERE agent_key ILIKE 'qayyim%';
--SPLIT--
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Write the read-back verifier**

Create `scripts/p7-verify-values.mjs`:

```js
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const p = new PrismaClient({ datasources: { db: { url: env.DIRECT_URL } } });
const checks = [
  ["agent_messages.sender_name", "select count(*)::bigint n from agent_messages where upper(sender_name) like 'QAYYIM-%'"],
  ["agent_profiles.agent_key", "select count(*)::bigint n from agent_profiles where agent_key like 'qayyim-%'"],
  ["agent_profiles.name", "select count(*)::bigint n from agent_profiles where name like '%يم الدار%'"],
  ["enterprise_agents.agent_key", "select count(*)::bigint n from enterprise_agents where agent_key like 'qayyim-%'"],
  ["qayyim_sync_events.source_agent", "select count(*)::bigint n from qayyim_sync_events where source_agent like 'qayyim-%'"],
  ["qayyim_benchmark_runs.agent_key", "select count(*)::bigint n from qayyim_benchmark_runs where agent_key ilike 'qayyim%'"],
  ["total rows kept", "select (select count(*) from agent_messages) + (select count(*) from qayyim_sync_events) + (select count(*) from qayyim_benchmark_runs) as n"],
];
let bad = 0;
for (const [label, sql] of checks) {
  const [{ n }] = await p.$queryRawUnsafe(sql);
  const value = Number(n);
  const zeroExpected = label !== "total rows kept";
  const ok = zeroExpected ? value === 0 : value > 0;
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: ${value}`);
}
await p.$disconnect();
process.exit(bad ? 1 : 0);
```

- [ ] **Step 3: Run the verifier BEFORE applying — see it fail**

Run: `node scripts/p7-verify-values.mjs`
Expected: FAIL on the six zero-checks (the old values are still there).

- [ ] **Step 4: Apply**

```bash
node scripts/apply-p6-migration.mjs supabase/migrations/20260927_p7_identity_values.sql          # dry run
node scripts/apply-p6-migration.mjs supabase/migrations/20260927_p7_identity_values.sql --apply   # for real
```

- [ ] **Step 5: Run the verifier again — see it pass**

Run: `node scripts/p7-verify-values.mjs`
Expected: 7 lines PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260927_p7_identity_values.sql scripts/p7-verify-values.mjs
git commit -m "fix(ops): stored agent identity speaks the new keys (P7-M2)"
```

---

## Milestone 3 — move the code and the routes

### Task 5: the atomic key sweep (catalogs, literals, writers)

This is the commit Task 2 warned about: everything that speaks an agent key changes
together, after Milestone 2 put `ops-*` into the rows.

**Files:**
- Move: 53 files `lib/qayyim/**` → `lib/ops/**`; `tests/qayyim/**` → `tests/ops/**`
- Modify: the 39 files importing `@/lib/qayyim/`
- Modify: `lib/qayyim/agent-roles.ts` (keys), `lib/agents/AgentOrchestrator.ts` (type union, `AGENT_PERSONAS`, registry, `sender_name`, routing table), `lib/qayyim/orchestrator/MasterOrchestrator.ts`, `lib/qayyim/facade/*`, `lib/qayyim/api/utils.ts`, `lib/qayyim/self-model.ts`, `lib/qayyim/self-audit.ts`, `lib/qayyim/daily-round.ts`, `app/api/admin/agents/*`, `app/api/admin/qayyim/*`, `app/api/cron/qayyim-proactive`, `components/admin/**`
- Test: `tests/ops/identityWiring.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ops/identityWiring.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { AGENT_ROLES } from "@/lib/ops/agent-roles";
import { AGENT_KEYS } from "@/lib/ops/identity";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes(".test.") ? [full] : [];
  });
}

describe("the whole codebase speaks one key set", () => {
  it("keys the role catalog by the new keys only", () => {
    expect(Object.keys(AGENT_ROLES).sort()).toEqual([...AGENT_KEYS].sort());
  });

  it("no source file carries a retired agent key", () => {
    const hits = ["lib", "app", "components"]
      .flatMap(sources)
      .filter((f) => !f.includes("lib/ops/identity.ts"))
      .filter((f) => /qayyim-(core|cont|vis|seo|ux|ana|dev|qa)\b/.test(readFileSync(f, "utf8")));
    expect(hits, hits.join("\n")).toEqual([]);
  });

  it("message stamps come from the identity module", () => {
    expect(readFileSync("lib/agents/AgentOrchestrator.ts", "utf8")).toContain("storedSenderName(");
    expect(readFileSync("app/api/admin/agents/messages/route.ts", "utf8")).toContain("storedSenderName(");
  });
});
```

- [ ] **Step 2: Run it, see it fail** — `npx vitest run tests/ops/identityWiring.test.ts`.

- [ ] **Step 3: Move the trees, then sweep every key literal in one pass**

```bash
git mv lib/qayyim lib/ops
git mv tests/qayyim tests/ops
grep -rl "@/lib/qayyim/" --include=*.ts --include=*.tsx app components lib tests \
  | xargs perl -pi -e 's{\@/lib/qayyim/}{\@/lib/ops/}g'

# the keys themselves — one sweep over every source file
grep -rl "qayyim-core\|qayyim-cont\|qayyim-vis\|qayyim-seo\|qayyim-ux\|qayyim-ana\|qayyim-dev\|qayyim-qa" \
  --include=*.ts --include=*.tsx lib app components \
  | grep -v "lib/ops/identity.ts" \
  | xargs perl -pi -e '
      s/\bqayyim-core\b/ops-lead/g;     s/\bqayyim-cont\b/ops-content/g;
      s/\bqayyim-vis\b/ops-visual/g;    s/\bqayyim-seo\b/ops-seo/g;
      s/\bqayyim-ux\b/ops-ux/g;         s/\bqayyim-ana\b/ops-analytics/g;
      s/\bqayyim-dev\b/ops-dev/g;       s/\bqayyim-qa\b/ops-qa/g;
      s/\bQAYYIM-CORE\b/OPS-LEAD/g;
    '
```

- [ ] **Step 4: Replace the two raw upper-case stamps with the module**

In `lib/agents/AgentOrchestrator.ts` add `import { storedSenderName } from "@/lib/ops/identity";` and change `sender_name: selectedAgent.toUpperCase()` to `sender_name: storedSenderName(selectedAgent)`.

In `app/api/admin/agents/messages/route.ts` add the same import and change `(msg as any).agent_key?.toUpperCase()` to `(msg as any).agent_key ? storedSenderName((msg as any).agent_key) : msg.sender_name || 'Agent'`.

- [ ] **Step 5: Accept legacy input at the three doors**

Query params, saved localStorage and any row written before Milestone 2 can still carry the old key. Normalize once, at the edge:

```ts
import { legacyToOps } from "@/lib/ops/identity";
// app/admin/v2/agents/qayyim/page.tsx → agentFromUrl()
return AGENT_KEYS.includes(legacyToOps(raw) as OpsAgentKey) ? legacyToOps(raw) : LEADER_KEY;
```

Apply the same wrap in `app/api/admin/agents/chat/route.ts` (the zod enum check) and in `components/admin/agents/CommandConsole.tsx` / `FloatingAgentButton.tsx` where a stored key is read back.

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npx vitest run`
Expected: 0 type errors; all tests green, including the three assertions above.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(ops): the swarm's library lives under lib/ops (P7-M3)"
```

### Task 6: API routes move, old paths redirect

**Files:**
- Move: `app/api/admin/qayyim/**` (23 route files) → `app/api/admin/ops/**`
- Create: `app/api/admin/qayyim/[...legacy]/route.ts`
- Modify: `lib/url-manifest.ts` (the route manifest the swarm quotes)
- Test: `tests/ops/routeManifest.test.ts`

- [ ] **Step 1: Move the whole tree in one command**

```bash
mkdir -p app/api/admin/ops
for d in $(find app/api/admin/qayyim -name route.ts -exec dirname {} \; | sort); do
  target="app/api/admin/ops${d#app/api/admin/qayyim}"
  mkdir -p "$target" && git mv "$d"/* "$target"/
done
find app/api/admin/qayyim -type f | wc -l   # expect 0 before the shim is added
```

- [ ] **Step 2: Create the permanent redirect**

Create `app/api/admin/qayyim/[...legacy]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Saved preview links and Telegram deep links still carry the old path. A 308
 * keeps them working; a 404 would teach the owner that the swarm lost his data.
 * Removed in P7-M5 once nothing points here anymore.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const tail = request.nextUrl.pathname.replace(/^\/api\/admin\/qayyim/, "/api/admin/ops");
  return NextResponse.redirect(new URL(tail + request.nextUrl.search, request.url), 308);
}
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
```

- [ ] **Step 3: Write the manifest test**

Create `tests/ops/routeManifest.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((e) =>
    statSync(join(dir, e)).isDirectory() ? routes(join(dir, e)) : join(dir, e).endsWith("route.ts") ? [join(dir, e)] : []
  );
}

describe("the ops API surface", () => {
  it("owns every admin route the swarm exposes", () => {
    const moved = routes("app/api/admin/ops");
    expect(moved.length).toBeGreaterThanOrEqual(20);
    expect(moved.some((f) => f.includes("qayyim"))).toBe(false);
  });

  it("keeps exactly one compatibility shim on the retired path", () => {
    const shim = "app/api/admin/qayyim/[...legacy]/route.ts";
    expect(existsSync(shim)).toBe(true);
    expect(routes("app/api/admin/qayyim").filter((f) => !f.includes("[...legacy]"))).toEqual([]);
  });
});
```

- [ ] **Step 4: Verify**

Run: `npx vitest run tests/ops/routeManifest.test.ts && npm run typecheck`
Expected: PASS both, 0 type errors.

- [ ] **Step 5: Update every caller of the moved paths**

```bash
grep -rn "/api/admin/qayyim/" --include=*.ts --include=*.tsx app components lib scripts | wc -l
```

Replace each with `/api/admin/ops/` **except** the Playwright suite assertions that deliberately test the redirect (Task 6 Step 6).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(ops): the swarm's API moved to /api/admin/ops, old path redirects 308 (P7-M3)"
```

### Task 7: tool ids, v2 pages, and the cron path

**Files:**
- Modify: `lib/agents/intent-router.ts` (TOOL_CATALOG + dialect rules + `ALLOWED`)
- Modify: `lib/admin-tool-bridge.ts` (six `toolName === "qayyim_*"` branches)
- Modify: `lib/agent-tools/*.ts` where tools self-describe
- Move: `app/admin/v2/qayyim` → `app/admin/v2/ops`, `app/admin/qayyim` → redirect page
- Move: `app/api/cron/qayyim-daily` → `app/api/cron/ops-daily`, `app/api/cron/qayyim-proactive` → `app/api/cron/ops-proactive`
- Modify: `vercel.json` (cron path)
- Test: `tests/ops/toolNames.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { TOOL_CATALOG } from "@/lib/agents/intent-router";

const bridge = readFileSync("lib/admin-tool-bridge.ts", "utf8");

describe("tool ids carry no retired brand", () => {
  it("renames the six swarm tools", () => {
    const names = TOOL_CATALOG.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["ops_self", "ops_world", "ops_rivals", "ops_forecast", "ops_luxury_score", "ops_goals_risk"]));
    expect(names.filter((n) => /qayyim/i.test(n))).toEqual([]);
  });

  it("the bridge dispatches on the same names", () => {
    for (const n of ["ops_self", "ops_world", "ops_rivals", "ops_forecast", "ops_luxury_score", "ops_goals_risk"]) {
      expect(bridge, n).toContain(`"${n}"`);
    }
  });
});
```

- [ ] **Step 2: Run it, see it fail** — `npx vitest run tests/ops/toolNames.test.ts`.

- [ ] **Step 3: Rename in one sweep**

```bash
perl -pi -e 's/\bqayyim_whoami\b/ops_self/g; s/\bqayyim_world\b/ops_world/g; s/\bqayyim_rivals\b/ops_rivals/g;
             s/\bqayyim_forecast\b/ops_forecast/g; s/\bqayyim_luxury_score\b/ops_luxury_score/g;
             s/\bqayyim_goals_risk\b/ops_goals_risk/g;' \
  lib/agents/intent-router.ts lib/admin-tool-bridge.ts lib/agent-tools/*.ts lib/ops/*.ts tests/ops/*.ts
```

Then fix the dialect routing rules that quote the old ids in their comments, and re-run the test to green.

- [ ] **Step 4: Move the pages and the cron**

```bash
git mv app/admin/v2/qayyim app/admin/v2/ops
git mv app/api/cron/qayyim-daily app/api/cron/ops-daily
git mv app/api/cron/qayyim-proactive app/api/cron/ops-proactive
```

Create `app/admin/qayyim/page.tsx` (replaces the moved page) that renders a client redirect to `/admin/v2/ops`, and update `vercel.json`:

```json
{ "crons": [{ "path": "/api/cron/ops-daily", "schedule": "0 7 * * *" }] }
```

- [ ] **Step 5: Verify and commit**

```bash
npm run typecheck && npx vitest run
git add -A && git commit -m "refactor(ops): tools, pages and the cron path lose the retired brand (P7-M3)"
```

- [ ] **Step 6: Deploy and prove the redirects**

```bash
git push origin main && sleep 240
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://azenith-living.vercel.app/api/admin/qayyim/self"
# expect: 308 …/api/admin/ops/self
node scripts/qayyim-ui-test.mjs    # expect 27/27
```

---

## Milestone 4 — prose, prompts and the owner's surfaces

### Task 8: regenerate the eight agent prompts

**Files:**
- Modify: `lib/agents/AgentOrchestrator.ts:70-140` (name + prompt literals)
- Modify: `lib/qayyim/…` → now `lib/ops/QayyimAgentBase*` files that build prompts
- Test: `tests/ops/agentPrompts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { AGENT_KEYS, SWARM_NAME } from "@/lib/ops/identity";

const src = readFileSync("lib/agents/AgentOrchestrator.ts", "utf8");

describe("an agent introduces itself by role, not by the retired brand", () => {
  it("contains no old name", () => {
    expect(src).not.toMatch(/قيّم الدار/);
    expect(src).not.toMatch(/\bqayyim-(core|cont|vis|seo|ux|ana|dev|qa)\b/);
  });

  it("introduces every member through the identity module, not a literal", () => {
    for (const key of AGENT_KEYS) {
      expect(src, `missing the introduction for ${key}`).toContain(`agentLabel("${key}")`);
    }
    expect(src).toContain(SWARM_NAME);
  });
});
```

- [ ] **Step 2: See it fail**, then rewrite the catalog so names and prompts come from the module:

```ts
import { AGENT_KEYS, agentLabel, legacyToOps, SWARM_NAME } from "@/lib/ops/identity";

const AGENT_PROMPTS: Record<string, string> = {
  "ops-lead": `أنت ${agentLabel("ops-lead")}، منسق ${SWARM_NAME} لإدارة إطلالة أزينث ليفينج على الموقع.`,
  "ops-content": `أنت ${agentLabel("ops-content")} داخل ${SWARM_NAME}، كاتب النصوص الفاخرة لأزينث ليفينج.`,
  "ops-visual": `أنت ${agentLabel("ops-visual")} داخل ${SWARM_NAME}، أمين المعرض البصري لأزينث ليفينج.`,
  "ops-seo": `أنت ${agentLabel("ops-seo")} داخل ${SWARM_NAME}، مهندس الرؤية في محركات البحث لأزينث ليفينج.`,
  "ops-ux": `أنت ${agentLabel("ops-ux")} داخل ${SWARM_NAME}، محلل سلوك الزوار لأزينث ليفينج.`,
  "ops-analytics": `أنت ${agentLabel("ops-analytics")} داخل ${SWARM_NAME}، عالم البيانات الاستراتيجية لأزينث ليفينج.`,
  "ops-dev": `أنت ${agentLabel("ops-dev")} داخل ${SWARM_NAME}، مهندس التنفيذ التقني لأزينث ليفينج.`,
  "ops-qa": `أنت ${agentLabel("ops-qa")} داخل ${SWARM_NAME}، حارس الجودة والاختبار لأزينث ليفينج.`,
};
```

and set each entry's `name` to `agentLabel(legacyToOps(key))` instead of a literal.

- [ ] **Step 3: Verify** — `npx vitest run tests/ops && npx vitest run tests/admin-assistant-scenarios.matrix.ts` (the 30-case decision eval must stay green).

- [ ] **Step 4: Commit** — `git commit -m "refactor(ops): every agent introduces itself by role (P7-M4)"`

### Task 9: the last Arabic strings in the owner's surfaces

**Files (the 47 measured files):** `app/admin/v2/agents/page.tsx:95`, `app/admin/v2/ops/page.tsx:20`, `app/admin/page.tsx:553`, `app/admin/agents/page.tsx` (6 sites), `app/api/admin/agents/tasks/route.ts:148-155`, `app/api/admin/agents/simulate-scenario/route.ts`, `app/api/admin/ops/preview/[token]/route.ts:85`, `lib/ops/self-model.ts` (`brand`), `lib/ops/daily-story.ts`, `lib/ops/gap-contract.ts`, plus tests and docs.

- [ ] **Step 1: List what is left, and decide each one**

```bash
grep -rn "قيّم الدار\|Qayyim al-Dar" --include=*.ts --include=*.tsx app components lib | grep -v "\.test\."
```

Replace with `agentLabel(...)`, `SWARM_NAME`, or the plain store name. `SelfModel.brand` becomes `SWARM_NAME`.

- [ ] **Step 2: Add the guard that keeps it gone**

Create `tests/ops/noRetiredName.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) return full.includes("vanguard") ? [] : files(full);
    return /\.(ts|tsx)$/.test(full) && !full.includes(".test.") ? [full] : [];
  });
}

describe("the retired name is gone from shipped code", () => {
  for (const dir of ["app", "components", "lib"]) {
    it(`${dir} carries no «قيّم الدار»`, () => {
      const hits = files(dir).filter((f) => readFileSync(f, "utf8").includes("قيّم الدار"));
      expect(hits, hits.join("\n")).toEqual([]);
    });
  }
});
```

- [ ] **Step 3: Run it, fix the remaining hits until green**, then update `AGENTS.md`: the naming map becomes historical (old → new), and the line about keys says `ops-*` keys are the stored ones.

- [ ] **Step 4: Verify the whole gate and commit**

```bash
npm run typecheck && npx vitest run
git add -A && git commit -m "refactor(ops): the owner never reads the retired name again (P7-M4)"
```

### Task 10: prove the owner's experience changed

- [ ] **Step 1: Push, wait, then ask the live swarm who it is**

```bash
git push origin main && sleep 240
export INTERNAL_API_KEY="$(node --env-file=.env.local -e 'process.stdout.write(process.env.INTERNAL_API_KEY)')"
node scripts/qayyim-product-test.mjs    # expect 21/21
node scripts/qayyim-ui-test.mjs         # expect 27/27
```

- [ ] **Step 2: Read the two answers a human would read**

```bash
curl -s -X POST "https://azenith-living.vercel.app/api/admin/agents/chat" \
  -H "Content-Type: application/json" -H "x-internal-key: $INTERNAL_API_KEY" \
  -d '{"agent_key":"ops-lead","message":"انت مين؟"}' | head -c 400
```

Expected: the reply names «مدير تشغيل المحتوى» and «سرب أزينث», contains no «قيّم الدار», and the tool chip reads `ops_self`.

- [ ] **Step 3: Trigger the morning report and read the receipt**

```bash
MSYS_NO_PATHCONV=1 npx vercel cron run /api/cron/ops-daily
```

Then read the newest `context_update kind="daily_report"` row: `telegramSent` must be true and the Telegram title must read «مدير تشغيل المحتوى — صباح …».

---

## Milestone 5 — demolition

### Task 11: rename the tables, alias the old names

**Files:**
- Create: `supabase/migrations/20260927_p7_tables.sql`
- Create: `scripts/p7-verify-tables.mjs`

- [ ] **Step 1: Generate the exact list from the live database — do not guess**

```bash
node -e "
const fs=require('fs');const {PrismaClient}=require('@prisma/client');
const env={};for(const l of fs.readFileSync('.env.local','utf8').split(/\r?\n/)){const m=/^([A-Z0-9_]+)=(.*)\$/.exec(l.trim());if(m)env[m[1]]=m[2].trim();}
const p=new PrismaClient({datasources:{db:{url:env.DIRECT_URL}}});
p.\$queryRawUnsafe(\"select tablename from pg_tables where schemaname='public' and tablename like 'qayyim%' order by tablename\").then(r=>{console.log(r.map(x=>x.tablename).join('\n'));return p.\$disconnect()});
"
```

Write every returned name into the migration below as a `DO` block that loops — one statement per table, `IF EXISTS` guarded so re-running is a no-op.

- [ ] **Step 2: Write the migration**

```sql
-- P7: rename the swarm's tables. Triggers ride along with the table; the old
-- name survives as a view so any straggler query still answers instead of
-- throwing 42P01 mid-deploy. Views cannot hold row triggers — that is fine, the
-- trigger lives on the renamed table itself.
DO $$
DECLARE t text; n text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- paste the names from Step 1 here, quoted
  ]
  LOOP
    n := 'ops_' || substring(t from 8);
    IF to_regclass('public.' || t) IS NOT NULL AND to_regclass('public.' || n) IS NULL THEN
      EXECUTE format('ALTER TABLE public.%I RENAME TO %I', t, n);
    END IF;
  END LOOP;
END $$;
--SPLIT--
DO $$
DECLARE t text; n text;
BEGIN
  FOREACH t IN ARRAY ARRAY[ /* the same names */ ]
  LOOP
    n := 'ops_' || substring(t from 8);
    IF to_regclass('public.' || t) IS NULL AND to_regclass('public.' || n) IS NOT NULL THEN
      EXECUTE format('CREATE VIEW public.%I AS SELECT * FROM public.%I', t, n);
    END IF;
  END LOOP;
END $$;
--SPLIT--
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 3: Apply, then verify both names answer**

```bash
node scripts/apply-p6-migration.mjs supabase/migrations/20260927_p7_tables.sql --apply
node -e "…select count(*) from ops_sync_events… and from qayyim_sync_events…"
```

Expected: identical counts through the new table and the old view.

- [ ] **Step 4: Point the code at the new names**

```bash
grep -rl '"qayyim_' --include=*.ts lib app scripts | xargs perl -pi -e 's/"qayyim_/"ops_/g'
npm run typecheck && npx vitest run
```

- [ ] **Step 5: Commit and deploy**

```bash
git add -A && git commit -m "fix(ops): the swarm's tables are named ops_* (P7-M5)" && git push origin main
```

### Task 12: remove every compatibility alias

- [ ] **Step 1: After one full day of traffic on the new paths, drop the aliases**

```sql
-- supabase/migrations/20260928_p7_drop_aliases.sql
DO $$
DECLARE t text; v text;
BEGIN
  FOREACH t IN ARRAY ARRAY[ /* the same table names */ ]
  LOOP
    v := t;
    IF to_regclass('public.' || v) IS NOT NULL AND v LIKE 'qayyim%' THEN
      EXECUTE format('DROP VIEW public.%I', v);
    END IF;
  END LOOP;
END $$;
--SPLIT--
NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 2: Delete the redirect shim** — `git rm -r "app/api/admin/qayyim"` and the `app/admin/qayyim` redirect page; update `tests/ops/routeManifest.test.ts` to assert the retired path does not exist.

- [ ] **Step 3: Update the platform** — re-run `npx vercel cron list` and confirm only `/api/cron/ops-daily` remains; rename the Google service account display name to `azenith-ops`.

### Task 13: final proof and ledger

- [ ] **Step 1: The zero-search gate**

```bash
grep -rn "qayyim\|قيّم الدار" --include=*.ts --include=*.tsx --include=*.sql app components lib tests scripts supabase/migrations | grep -v "p7_" | grep -v "docs/"
```

Expected: no output.

- [ ] **Step 2: Full verification on production**

```bash
npm run typecheck && npx vitest run
node scripts/qayyim-ui-test.mjs && node scripts/qayyim-product-test.mjs \
  && node scripts/qayyim-deep-test.mjs && node scripts/qayyim-gate-test.mjs
```

Expected: 27/27 · 21/21 · 10/10 · 5/5.

- [ ] **Step 3: Write the P7 ledger block** in `docs/qayyim-phases/` with measured before/after, honest deviations, and any collateral.

- [ ] **Step 4: Update project memory** (`qayyim-initiative-status.md` + its index line) so no future session reintroduces the old name.

---

## Self-review notes (author, 2026-09-26)

- **Spec coverage:** identity layer (T1-2), values (T4), code+routes (T5-7), prose/prompts (T8-9), tables+aliases (T11-12), owner-facing proof (T10, T13) — every §5 milestone and §6 risk has a task; the `vercel.json` cron and the Google account name are in T7 and T12.
- **Deliberate ordering:** T4 (data) lands before T5-T7 (code) because the app resolves legacy keys through `legacyToOps` from T1 onward, so the two directions stay readable during the rollout window.
- **Known unknown resolved by measurement, not guessing:** the table list in T11 is generated from `pg_tables` in Step 1.
