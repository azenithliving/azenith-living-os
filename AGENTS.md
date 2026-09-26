<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Who is who: naming map (read before touching any name)

P7 retired the product name «قيّم الدار». One module owns every identity: `lib/ops/identity.ts`
(`AGENT_KEYS`, `LEADER_TITLE`, `SWARM_NAME`, `agentLabel`, `legacyToOps`, `storedSenderName`).

- **`ops-lead` … `ops-qa`** — the live agent KEYS, stored in `agent_messages`, `agent_profiles`,
  `agent_tasks` and the sync-event table. `lib/ops/**`, `app/api/admin/ops/**`,
  `app/admin/v2/ops`, `app/admin/v2/agents/ops`, `/api/cron/ops-daily` and tool ids (`ops_world`…)
  all moved with them.
- **`qayyim-*`, `QAYYIM-*`, «قيّم الدار»** — retired. The retired→live mapping lives only in
  `identity.ts`, and the API doors still accept a retired key so a stale browser tab or an old
  Telegram link keeps working. `/api/admin/qayyim/**` and the two `/admin/**/qayyim` pages are
  forwarders, not surfaces. A guard forbids the Arabic name in shipped code:
  `tests/ops/noRetiredName.test.ts`.
- **Tables `qayyim_*`** — still named that way until P7-M5 renames them; `qayyim_rivals` names a
  table while `ops_rivals` names the tool, and that split is guarded on purpose.
- **«مدير تشغيل المحتوى»** — the leader's job title (`LEADER_TITLE`): the only human name for it, in
  chat headers, cards, Telegram messages and reports. **«سرب أزينث»** (`SWARM_NAME`) is the swarm;
  **«وكيل …»** are the eight role labels from `agentLabel(key)`.

So: a task saying "content operations manager" or «مدير تشغيل المحتوى» means the leader and its
surfaces; `ops-*` means the key. Searching for the retired names and concluding the feature does
not exist is the mistake this map exists to prevent — look up the mapping in `identity.ts` instead.

Deliberately still carrying the old word, each with its reason: `lib/ops/Qayyim*Agent.ts` and
`lib/ops/facade/QayyimFacade.ts` (class and file names, no user sees them), `lib/qayyim-ops.ts`,
`lib/ops/governance/policies/qayyim.rego`, and `scripts/qayyim-smoke.mjs` (an npm alias in
package.json points at it, and package.json is not edited).
