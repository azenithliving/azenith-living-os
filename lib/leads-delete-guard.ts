/**
 * The delete guard for customer records.
 *
 * Measured on live data (2026-09-29): two of the seven delete statements the old
 * door issued were `id IN (session keys)` — Postgres rejects them with
 * "invalid input syntax for type uuid", and the door ignored the error, so it
 * reported success while those rows stayed. Every identifier space is split here
 * before anything is queried, and deletion only targets primary keys that were
 * measured first.
 */
export type LedgerIds = {
  consultantSessions: string[];
  users: string[];
  requests: string[];
  visitorTelemetry: string[];
};

export const LEDGER_ORDER: (keyof LedgerIds)[] = [
  "consultantSessions",
  "users",
  "requests",
  "visitorTelemetry",
];

export type LedgerTotals = Record<keyof LedgerIds, number> & { total: number };

/** The words the owner sees — a ledger is named by what lives in it. */
export const LEDGER_LABELS: Record<keyof LedgerIds, string> = {
  consultantSessions: "محادثات المستشار",
  users: "ملفات العملاء",
  requests: "طلبات التسعير",
  visitorTelemetry: "حركة الزوار في الموقع",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function splitKeys(keys: string[]): { uuids: string[]; sessions: string[] } {
  const uuids: string[] = [];
  const sessions: string[] = [];
  for (const raw of keys) {
    if (typeof raw !== "string") continue;
    const key = raw.trim();
    if (key.length === 0) continue;
    (UUID_PATTERN.test(key) ? uuids : sessions).push(key);
  }
  return { uuids, sessions };
}

export function emptyPlan(): LedgerIds {
  return { consultantSessions: [], users: [], requests: [], visitorTelemetry: [] };
}

function distinctIds(rows: Array<{ id?: string | null } | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    if (row?.id) ids.add(row.id);
  }
  return Array.from(ids).sort();
}

/** Primary keys are unioned per ledger, so one record never gets deleted twice. */
export function buildPlan(found: {
  consultantSessions: Array<{ id?: string | null } | null>;
  users: Array<{ id?: string | null } | null>;
  requests: Array<{ id?: string | null } | null>;
  visitorTelemetry: Array<{ id?: string | null } | null>;
}): LedgerIds {
  return {
    consultantSessions: distinctIds(found.consultantSessions),
    users: distinctIds(found.users),
    requests: distinctIds(found.requests),
    visitorTelemetry: distinctIds(found.visitorTelemetry),
  };
}

export function planTotals(plan: LedgerIds): LedgerTotals {
  const counts = LEDGER_ORDER.reduce(
    (acc, ledger) => ({ ...acc, [ledger]: plan[ledger].length }),
    {} as Record<keyof LedgerIds, number>,
  );
  return { ...counts, total: LEDGER_ORDER.reduce((sum, ledger) => sum + plan[ledger].length, 0) };
}

export function planIsEmpty(plan: LedgerIds): boolean {
  return planTotals(plan).total === 0;
}

/** The owner confirms a number; a number that moved since is refused, not trusted. */
export function declaredRowsMatch(declared: unknown, plan: LedgerIds):
  | { ok: true; total: number }
  | { ok: false; reason: "missing-declaration" | "count-changed"; declared: number | null; measured: number } {
  const { total } = planTotals(plan);
  if (typeof declared !== "number" || !Number.isInteger(declared)) {
    return { ok: false, reason: "missing-declaration", declared: null, measured: total };
  }
  if (declared !== total) {
    return { ok: false, reason: "count-changed", declared, measured: total };
  }
  return { ok: true, total };
}

/** Rows that survived the sweep — the only proof that the delete really happened. */
export function residueOf(plan: LedgerIds, stillThere: LedgerIds): LedgerIds {
  const residue = emptyPlan();
  for (const ledger of LEDGER_ORDER) {
    const remaining = new Set(stillThere[ledger]);
    residue[ledger] = plan[ledger].filter((id) => remaining.has(id));
  }
  return residue;
}

export function hasResidue(residue: LedgerIds): boolean {
  return !planIsEmpty(residue);
}
