/**
 * phantom-names.ts — every name in the code that the record does not answer.
 *
 * supabase-js returns a refused query as a *value*, so a missing column does not throw: the caller
 * reads `data` as empty and the owner sees a zero that looks like a measurement. The only way to
 * keep that from coming back is to compare the names the code uses against the columns the record
 * actually answered with, and print the difference.
 *
 * Conservative by design: a name it cannot read as a plain literal (an embedded resource, a cast,
 * an alias, a star, a computed count) is skipped rather than guessed, so the list it produces is a
 * list an agent can act on.
 */
import { arDigits } from "../ops/metricLabels.ts";

export type CodeRef = {
  file: string;
  table: string;
  column: string;
  kind: "select" | "filter" | "insert";
  /** Character index of the `.from(` that produced this name — the scan names the function around it. */
  at: number;
};

export type Phantom = {
  file: string;
  table: string;
  column: string;
  kind: "select" | "filter" | "insert" | "missing-table";
  at: number;
  /**
   * Every `.from(` in this file that asked this name. A name counts once per file, so a dormant first
   * caller cannot decide for a live one — each place is judged on its own and the strongest wins.
   */
  sites: number[];
};

const FROM =
  /\.from\(\s*(?:(["'`])([a-zA-Z0-9_]+)\1|([A-Za-z_$][A-Za-z0-9_$]*))\s*\)/g;
const CONSTANT = /(?:const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*["'`]([a-zA-Z0-9_]+)["'`]/g;
const FILTER_CALL = /\.(?:eq|neq|in|order|not|gte|lte|gt|lt|ilike|like|is|contains|matches)\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g;
const OR_CALL = /\.or\(\s*["'`]([^"'`]*)["'`]/g;
const OR_TOKEN = /([a-zA-Z0-9_]+)\.(?:eq|neq|gte|lte|gt|lt|like|ilike|in|is)\./g;
const WRITE_CALL = /\.(?:insert|upsert|update)\(\s*\{/g;

/** Split a select list at depth zero, dropping anything the scan may not interpret. */
function plainSelectColumns(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of list) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out
    .map((token) => token.trim())
    .filter((token) => /^[a-zA-Z0-9_]+$/.test(token) && token !== "count");
}

function firstObjectKeys(slice: string): string[] {
  const start = slice.indexOf("{");
  if (start < 0) return [];
  let depth = 0;
  for (let i = start; i < slice.length; i++) {
    if (slice[i] === "{") depth += 1;
    else if (slice[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        const body = slice.slice(start + 1, i);
        if (body.includes("{") || body.includes("}")) return [];
        return [...body.matchAll(/(?:^|,)\s*([a-zA-Z0-9_]+)\s*(?::|,|$)/g)].map((m) => m[1]);
      }
    }
  }
  return [];
}

function tableConstants(source: string): Map<string, string> {
  const constants = new Map<string, string>();
  for (const [, name, value] of source.matchAll(CONSTANT)) constants.set(name, value);
  return constants;
}

/**
 * How many `.from(` places in a file name a table the scan can read.
 *
 * The scan reports only what it resolves, so without this number an unread place looks the same as a
 * clean one — and a table held in a variable the scan cannot follow is unread, not answered.
 */
export function fromSiteCensus(source: string): { sites: number; resolved: number; blind: number } {
  const sites = (source.match(/\.from\(/g) ?? []).length;
  const constants = tableConstants(source);
  let resolved = 0;
  for (const match of source.matchAll(FROM)) if (match[2] || constants.get(match[3] ?? "")) resolved += 1;
  return { sites, resolved, blind: sites - resolved };
}

export function refsFromSource(file: string, source: string): CodeRef[] {
  const refs: CodeRef[] = [];
  const constants = tableConstants(source);

  const froms = [...source.matchAll(FROM)];

  froms.forEach((match, index) => {
    const table = match[2] ?? constants.get(match[3] ?? "") ?? null;
    const from = match.index ?? 0;
    // The next .from( ends this query whether or not we understood its table: an unresolved variable
    // is silence, never a finding charged to whatever literal came before it.
    const to = index + 1 < froms.length ? (froms[index + 1].index ?? source.length) : source.length;
    if (!table) return;
    const slice = source.slice(from + match[0].length, to);

    for (const select of slice.matchAll(/\.select\(\s*["'`]([^"'`]*)["'`]/g)) {
      for (const column of plainSelectColumns(select[1])) refs.push({ file, table, column, kind: "select", at: from });
    }
    for (const filter of slice.matchAll(FILTER_CALL)) {
      refs.push({ file, table, column: filter[1], kind: "filter", at: from });
    }
    for (const or of slice.matchAll(OR_CALL)) {
      for (const token of or[1].matchAll(OR_TOKEN)) refs.push({ file, table, column: token[1], kind: "filter", at: from });
    }
    for (const write of slice.matchAll(WRITE_CALL)) {
      const after = slice.slice((write.index ?? 0) + write[0].length - 1);
      for (const column of firstObjectKeys(after)) refs.push({ file, table, column, kind: "insert", at: from });
    }
  });

  return refs;
}

export function findPhantoms(refs: CodeRef[], columns: Record<string, string[]>): Phantom[] {
  const byName = new Map<string, Phantom>();

  const addSite = (key: string, phantom: Phantom) => {
    const existing = byName.get(key);
    if (existing) {
      if (!existing.sites.includes(phantom.at)) existing.sites.push(phantom.at);
      return;
    }
    byName.set(key, phantom);
  };

  for (const ref of refs) {
    const tableColumns = columns[ref.table];
    if (!tableColumns) {
      addSite(`${ref.file}#${ref.table}`, {
        file: ref.file,
        table: ref.table,
        column: "",
        kind: "missing-table",
        at: ref.at,
        sites: [ref.at],
      });
      continue;
    }
    if (tableColumns.includes(ref.column)) continue;
    addSite(`${ref.file}#${ref.table}#${ref.column}#${ref.kind}`, { ...ref, sites: [ref.at] });
  }

  return [...byName.values()];
}

export function tallyPhantoms(phantoms: Phantom[]): { total: number; distinct: number; byKind: Record<string, number> } {
  const byKind: Record<string, number> = {};
  for (const phantom of phantoms) byKind[phantom.kind] = (byKind[phantom.kind] ?? 0) + 1;
  // The same missing column asked in two files is two places to fix, but one name to explain.
  const distinct = new Set(phantoms.map((phantom) => `${phantom.table}#${phantom.column}`)).size;
  return { total: phantoms.length, distinct, byKind };
}

/**
 * Split a refusal list by whether an owner surface reaches the file that asks it.
 *
 * `deadPaths` comes from the census: doors nobody calls, furniture no screen mounts. A name asked by
 * dead code is a retirement candidate, not a bug the owner lives with — and counting the two together
 * is how a phase looks impossible. A file the census never counted stays on the live side: unknown
 * means unproven, and unproven gets looked at, not filed away.
 */
export function splitByReachability<P extends { file: string }>(
  phantoms: P[],
  deadPaths: string[],
): { live: P[]; deadCode: P[] } {
  const dead = new Set(deadPaths);
  const live: P[] = [];
  const deadCode: P[] = [];
  for (const phantom of phantoms) (dead.has(phantom.file) ? deadCode : live).push(phantom);
  return { live, deadCode };
}

const LABELS: Record<string, string> = {
  select: "اختيار",
  filter: "فلترة",
  insert: "إدخال",
  "missing-table": "جدول مش موجود",
};

export function formatRefusalLine(tally: { total: number; distinct: number; byKind: Record<string, number> } | null): string {
  if (!tally) return "ما اتقارش: مِقياس الرفض الصامت ما اتشغّلش — المخزن ما ردّش";
  if (tally.total === 0) return "رفض صامت: صفر — كل اسم في الكود له ردّ من المخزن";
  const parts = Object.entries(tally.byKind).map(([kind, count]) => `${LABELS[kind] ?? kind} ${arDigits(count)}`);
  return `رفض صامت: ${arDigits(tally.total)} موضع في الكود ما لوش ردّ عند المخزن (${arDigits(tally.distinct)} اسم مختلف) · ${parts.join(" · ")}`;
}
