/**
 * migration-sql.ts — the two decisions the schema applier makes before it touches the record.
 *
 * Splitting: this repo's migrations separate statements with `--SPLIT--` lines, and a `";\n"` split
 * alone destroys dollar-quoted bodies (a `DO $$ … $$` block became three invalid fragments the first
 * time this was tried). Comment lines are stripped per statement, because a leftover `--` line makes
 * the fragment invalid on its own.
 *
 * Guarding: the owner's brake says no table and no row is ever dropped. A guard that only runs after
 * connecting is too late, so this is pure text, tested against the shapes that actually occur —
 * including a `delete` hidden inside a quoted body.
 */
const SPLIT_MARKER = /^--SPLIT--\s*$/m;
const DOLLAR_QUOTED = /\$\w*\$/;
const FK_ACTION = /\bon\s+delete\s+(cascade|set\s+null|set\s+default|restrict|no\s+action)\b/gi;
const DESTRUCTIVE = /\b(drop|truncate|delete)\b/i;

export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  for (const chunk of sql.split(SPLIT_MARKER)) {
    const clean = chunk
      .split(/\r?\n/)
      .filter((line) => !/^\s*--/.test(line))
      .join("\n")
      .trim();
    if (!clean) continue;
    if (DOLLAR_QUOTED.test(clean)) {
      out.push(clean);
      continue;
    }
    const statements = [...clean.matchAll(/[^;]+;/g)].map((m) => m[0].trim());
    out.push(...statements);
    const tail = clean.slice(clean.lastIndexOf(";") + 1).trim();
    if (tail) out.push(tail);
  }
  return out;
}

export type DestructiveHit = { word: string; statement: string };

/** Every statement that would remove a table, a column, a policy, or rows. */
export function findDestructive(statements: string[]): DestructiveHit[] {
  const hits: DestructiveHit[] = [];
  for (const statement of statements) {
    const withoutFkActions = statement.replace(FK_ACTION, " ");
    const match = DESTRUCTIVE.exec(withoutFkActions);
    if (match) hits.push({ word: match[1].toLowerCase(), statement });
  }
  return hits;
}
