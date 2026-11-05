/**
 * snapshot-scope.ts — what the store's own copy holds, and what it says about what it does not.
 *
 * The copy exists because of a measured loss (306 chat rows, 2026-10-19) and because the plan has no
 * automatic restore point. Until today it copied eleven tables while the business record sat outside
 * it — measured 2026-11-05: 160 rows of orders, leads, drawn papers and sections were not copied.
 *
 * The rule this module enforces: a table is either copied, or named with a reason. Silence is the
 * defect. An empty table is not a loss; it is reported separately so nobody reads «٠» as «خلصنا».
 */

import { arDigits } from "./metricLabels.ts";

export interface SnapshotTarget {
  table: string;
  /** A stable single-column ordering key, so paging cannot skip a row or count one twice. */
  order: string;
}

/** The swarm's memory, the owner's orders, and the business record he cannot re-make. */
export const SNAPSHOT_TARGETS: SnapshotTarget[] = [
  // The eleven that were already copied.
  { table: "agent_messages", order: "id" },
  { table: "agent_conversations", order: "id" },
  { table: "agent_profiles", order: "id" },
  { table: "agent_tasks", order: "id" },
  { table: "consultant_sessions", order: "id" },
  { table: "consultant_learnings", order: "id" },
  { table: "consultant_pending_questions", order: "id" },
  { table: "customer_memory", order: "id" },
  { table: "ops_semantic_memory", order: "id" },
  { table: "ops_sync_events", order: "id" },
  { table: "site_settings", order: "key" },
  // The business record, added after measuring each one's primary key on the live record.
  { table: "sales_orders", order: "id" },
  { table: "sales_order_items", order: "id" },
  { table: "leads", order: "id" },
  { table: "products", order: "id" },
  { table: "product_categories", order: "id" },
  { table: "inventory_items", order: "id" },
  { table: "bookings", order: "id" },
  { table: "payments", order: "id" },
  { table: "production_jobs", order: "id" },
  { table: "room_sketches", order: "id" },
  { table: "room_sections", order: "id" },
  { table: "ops_drafts", order: "id" },
];

/** Tables left out on purpose, each with the reason the owner reads. */
export const SNAPSHOT_EXCLUSIONS: { table: string; reason: string }[] = [
  {
    table: "image_bank",
    reason: "١٣،٦٣١،٤٨٨ بايت مقابل ٥،٥٠٥،٠٢٤ لكل المنسوخ، وخط الحصاد بيعيد عملها (قياس ٢٠٢٦-١٠-٢٣)",
  },
  {
    table: "sheet_visits",
    reason: "مفتاحها مركّب (ورقة + جهاز)، والنسخة بترتّب بعمود واحد — ما تدخلش الطقم غير لما يبقى ليها مفتاح ترتيب صحيح",
  },
  {
    table: "lead_conversions",
    reason: "مفتاحها ما اتقارش بعد — مستنية قياس عمود الترتيب قبل ما تدخل الطقم",
  },
];

/** Families that are copies-of-copies or residue, excluded by pattern with one reason each. */
export const SNAPSHOT_EXCLUSION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /^_p\d+_backup_/, reason: "نسخة يدوية من مرحلة قديمة — هي نسخة، مش أصل" },
  { pattern: /(^|_)backups?(_|$)/, reason: "جدول بيشيل نسخ جوه المخزن؛ النسخة اللي بنرجع منها هي اللي في الدرج" },
  { pattern: /^qayyim_/, reason: "اسم متقاعد؛ الجدول نفسه ما بقاش يتقرا من ولا سطح" },
  { pattern: /^_drill_/, reason: "سطور أدوات القياس نفسها" },
];

export type RecordTable = { table: string; rows: number; columns?: string[] };

/**
 * A table whose own columns carry a credential never enters the copy — the file's brake says the
 * bucket must not hold secrets. This is read from the record's columns, not guessed from a name.
 */
const CREDENTIAL_COLUMN = /(^|_)(api_?key|key|token|secret|password|passwd|hash|signature)($|_)/i;

export type CoverageVerdict = {
  copied: SnapshotTarget[];
  excludedNames: string[];
  credentialTables: string[];
  emptyUncovered: string[];
  /** Tables that hold rows and are neither copied nor named — the list that must stay empty. */
  unexplained: string[];
  rowsCopied: number;
  rowsUnexplained: number;
};

export function coverageVerdict(recordTables: RecordTable[]): CoverageVerdict {
  const copiedNames = new Set(SNAPSHOT_TARGETS.map((t) => t.table));
  const excludedNames = new Set(SNAPSHOT_EXCLUSIONS.map((e) => e.table));
  const copied: SnapshotTarget[] = [];
  const excluded: string[] = [];
  const credentialTables: string[] = [];
  const emptyUncovered: string[] = [];
  const unexplained: string[] = [];
  let rowsCopied = 0;
  let rowsUnexplained = 0;

  for (const entry of recordTables) {
    if (copiedNames.has(entry.table)) {
      const target = SNAPSHOT_TARGETS.find((t) => t.table === entry.table)!;
      copied.push(target);
      rowsCopied += entry.rows;
      continue;
    }
    if (entry.table !== "site_settings" && (entry.columns ?? []).some((c) => CREDENTIAL_COLUMN.test(c))) {
      credentialTables.push(entry.table);
      continue;
    }
    if (excludedNames.has(entry.table) || SNAPSHOT_EXCLUSION_PATTERNS.some((p) => p.pattern.test(entry.table))) {
      excluded.push(entry.table);
      continue;
    }
    if (entry.rows === 0) {
      emptyUncovered.push(entry.table);
      continue;
    }
    unexplained.push(entry.table);
    rowsUnexplained += entry.rows;
  }

  return {
    copied,
    excludedNames: excluded,
    credentialTables,
    emptyUncovered,
    unexplained,
    rowsCopied,
    rowsUnexplained,
  };
}

const AR = (n: number) => arDigits(n);

export function formatCoverageLine(verdict: CoverageVerdict | null): string {
  if (!verdict) return "ما اتقارش: غطاء النسخة — المخزن ما ردّش";
  const head = `النسخة بتاخد ${AR(verdict.copied.length)} جدول (${AR(verdict.rowsCopied)} سطر)`;
  const keys = verdict.credentialTables.length
    ? ` · ${AR(verdict.credentialTables.length)} جدول فيه مفتاح مستبعد`
    : "";
  if (verdict.unexplained.length === 0) {
    return `${head}${keys} · مفيش جدول عليه سطور ومفيش سبب مكتوب · فاضي من غير سطور: ${AR(verdict.emptyUncovered.length)}`;
  }
  return `${head}${keys} · ومفيش سبب مكتوب لـ${AR(verdict.unexplained.length)} جدول (${AR(verdict.rowsUnexplained)} سطر)`;
}
