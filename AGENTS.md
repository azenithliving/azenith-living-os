<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# How to talk to the human owner (always applies, every session)

The owner reads Arabic only, is not a programmer, and uses a phone. Every reply — status, findings,
questions, summaries — follows this. It is not optional and it is not "for beginner sessions only".

1. **Arabic first, and only Arabic sentences.** Never mix English words into an Arabic sentence.
   Reading a sentence with English terms in it feels like reading code to the owner.
2. **File names, commands, branches, table names, URLs — never in the middle of a sentence.** If one
   of them must appear, put it alone on its own line in a code block, with an Arabic explanation
   under it in plain words. If the Arabic explanation works without it, drop it entirely.
3. **Short.** A normal answer is a few sentences. No numbered lists of risks, no tables, no headers
   inside a chat reply, no "summary of what you said". Long answers are the main failure mode here.
4. **Plain language, no jargon.** Say "the site goes live" not "deploy", say "the saved data" not
   "the schema", say "the old naming" not "the retired identifiers". Explain any term you cannot
   avoid the first time, in one short clause.
5. **Analogies over mechanisms.** The owner decides, so describe consequences ("if both sessions
   publish, the second overwrites the first"), not internals.
6. **End with one clear next step or one clear question.** Not a list of options. If there is a real
   decision to make, ask it directly and simply.
7. **Technical work stays technical, but reported simply.** Run the tests, read the code, use the
   tools — then describe what happened in the two or three sentences a non-programmer would use.

This section is for the assistant and is safe to keep in the repo; it changes nothing in the app.

# Who is who: naming map (read before touching any name)

P7 retired the product name «قيّم الدار». One module owns every identity: `lib/ops/identity.ts`
(`AGENT_KEYS`, `LEADER_TITLE`, `SWARM_NAME`, `agentLabel`, `legacyToOps`, `storedSenderName`).

- **`ops-lead` … `ops-qa`** — the live agent KEYS, stored in `agent_messages`, `agent_profiles`,
  `agent_tasks` and `ops_sync_events`. `lib/ops/**`, `app/api/admin/ops/**`,
  `app/admin/v2/ops`, `app/admin/v2/agents/ops`, `/api/cron/ops-daily` and tool ids (`ops_world`…)
  all moved with them, and the swarm's fifteen tables are `ops_*` since P7-M5.
- **`qayyim-*`, `QAYYIM-*`, `qayyim_*` tables, «قيّم الدار»** — retired. The retired→live mapping
  lives only in `identity.ts`; the HTTP doors still accept a retired key so a stale browser tab or
  an old Telegram link keeps working. The fifteen alias views over the old table names were dropped
  in **P7-T12 (2026-09-28)**, so a `qayyim_*` relation no longer resolves anywhere. `/api/admin/qayyim/**` and the two
  `/admin/**/qayyim` pages are forwarders, not surfaces — kept on purpose, because the owner's older
  Telegram messages deep-link to them. Guards that keep the name out of anything shipped or served:
  `tests/ops/noRetiredName.test.ts` (the Arabic name in code, plus the reply-boundary scrub that
  stops a model re-naming itself with it), the table guard in `tests/ops/toolNames.test.ts`, and
  `tests/ops/ownerSurfaceNames.test.ts` (the retired KEY inside Arabic copy on the owner's screens).
- **Database internals still wearing the old word** — roughly 65 index, primary-key, policy and
  trigger names (`qayyim_drafts_pkey`, `service_role_qayyim_rivals`, `update_qayyim_drafts_updated_at`).
  They follow their table by internal id, appear on no surface, and are read by no code; renaming them
  is churn with zero owner-visible gain. The count and the reason live in
  `docs/qayyim-phases/P7-identity-retirement.md` — do not rediscover them as a bug.
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
