/**
 * Who wrote a chat row, and what actually ran under it.
 *
 * Measured 2026-10-09 over his 862 agent rows: 636 carry a desk record and 224 carry an
 * empty object. The empty ones are not all "nothing ran" — three of them (2026-10-07
 * 00:21 → 00:30) produced real page drafts with a preview token, because the code that
 * ran the desk was the swarm, not the router, and only the router ever wrote a record.
 * So an absent record and an honest "nothing ran" were the same shape, and no guard could
 * tell a genuine deed from a fabricated one.
 *
 * This module makes the difference a fact on the row: every write path states which path
 * it is, and names every desk it asked to run with the outcome it got back. Nothing ran is
 * now written as `desks: []` — a statement, not a blank.
 *
 * The Arabic name of a capability stays owned by the palette; the desks that are not
 * commands he can type (the swarm, the two audits) are named here, and
 * `tests/ops/provenance.test.ts` keeps the two name sets apart so neither can shadow the other.
 */
import { CAPABILITY_LABELS } from "./palette";

/** A desk the turn asked to run, and whether it came back with something. */
export type DeskRun = { desk: string; ok: boolean };

/** Which code path put this row in the table — the row's own witness. */
export type RowVia =
  | "orchestrator"
  | "messages-door"
  | "conversations-door"
  | "proactive-cron";

/** Desks that run inside the leader's turn and are not palette commands. */
export const SWARM_DESK = "swarm_run";
export const SITE_AUDIT_DESK = "site_audit";
export const VISITOR_AUDIT_DESK = "visitor_audit";
/** The live reading of the shop the leader is handed before it answers. */
export const WORLD_DESK = "world_read";

const DESK_LABELS: Record<string, string> = {
  [SWARM_DESK]: "سرب تعديل الصفحات",
  [SITE_AUDIT_DESK]: "الفحص الشامل للموقع",
  [VISITOR_AUDIT_DESK]: "فحص تجربة الزوار",
  [WORLD_DESK]: "قراءة عالم الدار الحيّة",
};

/** The desk ids this module names — none of them a command the palette owns. */
export const PROVENANCE_DESK_IDS = Object.keys(DESK_LABELS);

/**
 * The one Arabic name a desk has on his screen. Unknown ids answer `null` — a machine
 * identifier is never printed in his sentence, and an unnamed desk stays unnamed instead
 * of becoming a guess.
 */
export function deskLabel(desk: string | null | undefined): string | null {
  if (!desk) return null;
  const command = CAPABILITY_LABELS[desk];
  if (command) return command.split(":")[0].trim();
  return DESK_LABELS[desk] ?? null;
}

/** Names of every desk that ran, in order, unlabelled ones dropped. */
export function deskNames(desks: DeskRun[]): string[] {
  const names: string[] = [];
  for (const run of desks) {
    const label = deskLabel(run.desk);
    if (label && !names.includes(label)) names.push(label);
  }
  return names;
}

/**
 * The envelope stored in `agent_messages.context`.
 *
 * `tool`/`success` repeat the primary desk because the surfaces and the row readers
 * already use those keys — a new key nobody reads is a record nobody has.
 */
export function provenanceEnvelope(
  via: RowVia,
  desks: DeskRun[]
): Record<string, unknown> {
  const primary = pickPrimaryDesk(desks);
  return {
    via,
    desks,
    ...(primary ? { tool: primary.desk, success: primary.ok } : {}),
  };
}

/** The desk that answers for the row: one that succeeded, else the first attempted. */
export function pickPrimaryDesk(desks: DeskRun[]): DeskRun | null {
  return desks.find((d) => d.ok) ?? desks[0] ?? null;
}

/**
 * What ran under a row, read from whatever shape it was written in.
 * Rows from before this record keep their meaning: a lone `tool` key is one desk.
 */
export function readDesks(context: unknown): DeskRun[] {
  const ctx = context as Record<string, any> | null;
  if (!ctx || typeof ctx !== "object") return [];
  if (Array.isArray(ctx.desks)) {
    return ctx.desks
      .filter((d: any) => d && typeof d.desk === "string")
      .map((d: any) => ({ desk: String(d.desk), ok: d.ok !== false }));
  }
  if (typeof ctx.tool === "string" && ctx.tool) {
    return [{ desk: ctx.tool, ok: ctx.success !== false }];
  }
  return [];
}

/**
 * The line his screen prints under the employee's name.
 * `null` when the row carries no record at all — the absence of a record is not evidence
 * that nothing ran, and the surface must not say otherwise about rows written before this.
 */
export function deskLineFor(context: unknown): string | null {
  const desks = readDesks(context);
  if (!desks.length) return null;
  const names = deskNames(desks);
  if (!names.length) return null;
  return names.join(" · ");
}
