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
};

export type Phantom = {
  file: string;
  table: string;
  column: string;
  kind: "select" | "filter" | "insert" | "missing-table";
};

const FROM = /\.from\(\s*["'`]([a-zA-Z0-9_]+)["'`]\s*\)/g;
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

export function refsFromSource(file: string, source: string): CodeRef[] {
  const refs: CodeRef[] = [];
  const froms = [...source.matchAll(FROM)];

  froms.forEach((match, index) => {
    const table = match[1];
    const from = match.index ?? 0;
    const to = index + 1 < froms.length ? (froms[index + 1].index ?? source.length) : source.length;
    const slice = source.slice(from + match[0].length, to);

    for (const select of slice.matchAll(/\.select\(\s*["'`]([^"'`]*)["'`]/g)) {
      for (const column of plainSelectColumns(select[1])) refs.push({ file, table, column, kind: "select" });
    }
    for (const filter of slice.matchAll(FILTER_CALL)) {
      refs.push({ file, table, column: filter[1], kind: "filter" });
    }
    for (const or of slice.matchAll(OR_CALL)) {
      for (const token of or[1].matchAll(OR_TOKEN)) refs.push({ file, table, column: token[1], kind: "filter" });
    }
    for (const write of slice.matchAll(WRITE_CALL)) {
      const after = slice.slice((write.index ?? 0) + write[0].length - 1);
      for (const column of firstObjectKeys(after)) refs.push({ file, table, column, kind: "insert" });
    }
  });

  return refs;
}

export function findPhantoms(refs: CodeRef[], columns: Record<string, string[]>): Phantom[] {
  const found: Phantom[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    const tableColumns = columns[ref.table];
    if (!tableColumns) {
      const key = `${ref.file}#${ref.table}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ file: ref.file, table: ref.table, column: "", kind: "missing-table" });
      }
      continue;
    }
    if (tableColumns.includes(ref.column)) continue;
    const key = `${ref.file}#${ref.table}#${ref.column}#${ref.kind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ ...ref });
  }

  return found;
}

export function tallyPhantoms(phantoms: Phantom[]): { total: number; byKind: Record<string, number> } {
  const byKind: Record<string, number> = {};
  for (const phantom of phantoms) byKind[phantom.kind] = (byKind[phantom.kind] ?? 0) + 1;
  return { total: phantoms.length, byKind };
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

export function formatRefusalLine(tally: { total: number; byKind: Record<string, number> } | null): string {
  if (!tally) return "ما اتقارش: مِقياس الرفض الصامت ما اتشغّلش — المخزن ما ردّش";
  if (tally.total === 0) return "رفض صامت: صفر — كل اسم في الكود له ردّ من المخزن";
  const parts = Object.entries(tally.byKind).map(([kind, count]) => `${LABELS[kind] ?? kind} ${arDigits(count)}`);
  return `رفض صامت: ${arDigits(tally.total)} اسم في الكود ما لوش ردّ من المخزن · ${parts.join(" · ")}`;
}
