/**
 * restore-plan.ts — the safety of the one door that can write over the owner's record.
 *
 * Restoring is not a button; it is a set of refusals. A table the copy never held cannot be restored.
 * A copy whose own read-back disagreed is not a copy. A day the stamp does not carry has no object.
 * And without the owner's word carried in explicitly, the only rows that may go back are the ones
 * carrying the instrument's own marker — so a drill can prove the road without touching his data.
 */
import { SNAPSHOT_TARGETS, type SnapshotTarget } from "./snapshot-scope.ts";

export type SnapshotStamp = {
  day: string;
  tables: number;
  rows: number;
  bytes: number;
  failures: string[];
} | null;

export type RestorePlan =
  | { ok: true; scope: "marker"; table: string; day: string; target: SnapshotTarget; marker: string }
  | { ok: true; scope: "whole-table"; table: string; day: string; target: SnapshotTarget; ownerWord: string }
  | { ok: false; reason: string };

export function planRestore(input: {
  day: string;
  table: string;
  stamp: SnapshotStamp;
  marker?: string;
  ownerWord?: string;
}): RestorePlan {
  const target = SNAPSHOT_TARGETS.find((t) => t.table === input.table);
  if (!target) {
    return { ok: false, reason: `الجدول «${input.table}» ما اتنسختش في الطقم — الاسترجاع مرفوض` };
  }
  if (!input.stamp) {
    return { ok: false, reason: "ختم النسخة ما اتقارش — مفيش ما نرجع منه" };
  }
  if (input.stamp.failures.length > 0) {
    return {
      ok: false,
      reason: `النسخة ما اتأكدتش: ${input.stamp.failures[0]} — الاسترجاع من نسخة مش مضمونة أخطر من مفيش نسخة`,
    };
  }
  if (input.stamp.day !== input.day) {
    return {
      ok: false,
      reason: `اليوم ${input.day} مالوش نسخة عند آخر ختم (${input.stamp.day}) — مفيش تخمين على يوم تاني`,
    };
  }

  const word = (input.ownerWord ?? "").trim();
  if (word) {
    return { ok: true, scope: "whole-table", table: input.table, day: input.day, target, ownerWord: word };
  }
  const marker = (input.marker ?? "").trim();
  if (!marker) {
    return { ok: false, reason: "استرجاع الجدول كله محتاج كلمة المالك؛ ومن غير سطر علامة ما ينفعش نكتب حاجة" };
  }
  return { ok: true, scope: "marker", table: input.table, day: input.day, target, marker };
}

/** Only the rows that are actually missing. A row that exists is never overwritten. */
export function rowsToInsert<Key extends string>(
  rows: Record<Key, unknown>[],
  existing: Record<Key, unknown>[],
  key: Key,
): Record<Key, unknown>[] {
  for (const row of rows) {
    if (!(key in row)) throw new Error(`سطر من النسخة مالوش عمود «${key}» — ما فيهوش مفتاح نقارن بيه`);
  }
  const present = new Set(existing.map((row) => String(row[key])));
  return rows.filter((row) => !present.has(String(row[key])));
}
