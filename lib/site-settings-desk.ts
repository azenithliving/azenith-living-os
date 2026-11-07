import "server-only";

import { recordAuditEvent } from "@/lib/ops/audit-record";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { arDigits } from "@/lib/ops/metricLabels";
import { factLabel } from "@/lib/settings/facts";

/**
 * The one owner of «change a store setting».
 *
 * The shape here is measured, not designed (live store, 2026-11-06): `site_settings` is
 * `key` text primary key · `value` jsonb · `updated_at` timestamptz · `updated_by` **uuid with a
 * foreign key to `users(id)`**. So the desk writes three columns and leaves `updated_by` alone: the
 * name of whoever changed the setting is not a customer row, and inventing one to fill a column is
 * how the owner's customer table ends up holding an employee. The actor belongs to the history
 * drawer instead, which has an `actor` column that accepts it.
 *
 * The code this replaces spoke a different table entirely: it filtered `site_settings.id`, wrote
 * `setting_value` and `current_revision_id`, and inserted its history into `content_revisions`, a
 * drawer the record has never heard of (PGRST205). Every one of those writes was refused, so the
 * employee tool «غيّر إعداد» failed on its first statement every time it was called.
 *
 * History rides on `audit_log`, which exists and already has one writer (`lib/ops/audit-record.ts`).
 * Inventing a second drawer for the same fact is how a store ends up with two answers to «what
 * changed, and what was it before».
 */
export const SETTING_WRITE_COLUMNS = ["key", "value", "updated_at"] as const;
export const SETTING_HISTORY_KIND = "setting_change";

export type SettingWriteResult = {
  ok: boolean;
  applied: boolean;
  canRollback: boolean;
  key: string;
  oldValue: unknown;
  newValue: unknown;
  historyId: string | null;
  message: string;
  note?: string;
};

export type RollbackResult = {
  ok: boolean;
  appliedCount: number;
  keys: string[];
  newKeys: string[];
  message: string;
  note?: string;
};

type SettingsClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

async function readCurrentValue(supabase: SettingsClient, key: string) {
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle<{ value: unknown }>();

  if (error) return { measured: false as const, existed: false, value: null, reason: error };
  // `existed` is recorded because rolling back a key that did not exist before means DELETING a row,
  // and deletion is the owner's word, not the desk's. Without this flag the rollback would have to
  // guess from a null value — and a stored null is not the same fact as a missing row.
  return { measured: true as const, existed: data !== null, value: data ? data.value : null };
}

/**
 * Writes one setting and records the change. `apply: false` records a waiting change without
 * touching the live value — that is what the approval flow needs, and it is the same desk, so a
 * pending change and an applied one cannot disagree about the column names.
 */
export async function writeSiteSetting(input: {
  key: string;
  value: unknown;
  actor: string;
  reason?: string;
  category?: string;
  executionId?: string | null;
  apply?: boolean;
  status?: "applied" | "rolled_back";
}): Promise<SettingWriteResult> {
  const key = String(input.key ?? "").trim();
  const label = factLabel(key) ?? "الإعداد";
  const actor = String(input.actor ?? "").trim() || "system";
  const refused = (message: string, extra: Partial<SettingWriteResult> = {}): SettingWriteResult => ({
    ok: false,
    applied: false,
    canRollback: false,
    key,
    oldValue: null,
    newValue: input.value,
    historyId: null,
    message,
    ...extra,
  });

  if (!key) return refused("مفيش اسم إعداد — مفيش حاجة تتغير");

  const supabase = getSupabaseAdminClient();
  if (!supabase) return refused("مفتاح المتجر مش ضابط — الإعداد ما اتغيرش");

  const current = await readCurrentValue(supabase, key);
  if (!current.measured) {
    // A value nobody could read is a change nobody can describe afterwards, and rollback would be
    // guessing. The refusal is named instead.
    return refused(`المخزن ما ردّش على ${label} — فالتغيير ما اتعملش`);
  }

  const apply = input.apply !== false;

  if (!apply) {
    const history = await recordAuditEvent({
      kind: SETTING_HISTORY_KIND,
      action: `طلب تغيير الإعداد «${key}»`,
      actor,
      outcome: "success",
      details: {
        table: "site_settings",
        settingKey: key,
        oldValue: current.value,
        newValue: input.value,
        existedBefore: current.existed,
        reason: input.reason ?? null,
        category: input.category ?? "general",
        executionId: input.executionId ?? null,
        status: "waiting",
      },
    });
    if (!history.ok) {
      return refused(`طلب تغيير ${label} ما اتسجّلش — والقيمة لسه ما اتغيرتش`, {
        oldValue: current.value,
        note: `السجل ما استقبلش الطلب: ${history.error}`,
      });
    }
    return {
      ok: true,
      applied: false,
      canRollback: false,
      key,
      oldValue: current.value,
      newValue: input.value,
      historyId: history.id,
      message: `طلب تغيير ${label} اتسجّل، والقيمة لسه ما اتغيرتش`,
    };
  }

  const { data: written, error } = await supabase
    .from("site_settings")
    .upsert(
      {
        key,
        value: input.value as never,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "key" }
    )
    .select("key, value, updated_at")
    .single<{ key: string; value: unknown; updated_at: string }>();

  if (error) {
    console.error("[SiteSettingsDesk] write refused:", error);
    return refused(`${label} ما اتغيرش — المخزن رفض الكتابة`, { oldValue: current.value });
  }
  if (!written) {
    return refused(`${label} ما اتأكدش إنه اتغير — فما بنقولش «اتغير» من غير قراية`, { oldValue: current.value });
  }

  const history = await recordAuditEvent({
    kind: SETTING_HISTORY_KIND,
    action: `تغيير الإعداد «${key}»`,
    actor,
    outcome: "success",
    details: {
      table: "site_settings",
      settingKey: key,
      oldValue: current.value,
      newValue: written.value,
      existedBefore: current.existed,
      reason: input.reason ?? null,
      category: input.category ?? "general",
      executionId: input.executionId ?? null,
      status: input.status ?? "applied",
    },
  });

  const canRollback = current.existed && history.ok && Boolean(String(input.executionId ?? "").trim());
  const undoNote = !current.existed
    ? "الإعداد ده اتعمل جديد؛ الرجوع عنه محتاج مسح السطر بكلمة المالك."
    : !history.ok
      ? "السجل ما استقبلش التغيير، فالرجوع التلقائي مش متاح."
      : !canRollback
        ? "مفيش رقم تنفيذ للرجوع، فالرجوع التلقائي مش متاح."
        : "";

  return {
    ok: true,
    applied: true,
    canRollback,
    key,
    oldValue: current.value,
    newValue: written.value,
    historyId: history.ok ? history.id : null,
    message: `${label} اتغير، والقراية من المخزن أكّدته.${undoNote ? ` ${undoNote}` : ""}`,
    ...(history.ok ? {} : { note: `السجل ما استقبلش التغيير: ${history.error} — القيمة اتغيرت فعلًا` }),
  };
}

type HistoryRow = { details?: Record<string, unknown> | null };

/**
 * Puts an execution's settings back the way they were.
 *
 * The newest recorded change per key decides: if that row is already a rollback, the key is left
 * alone — otherwise pressing the button twice would walk the value back and forth.
 */
export async function rollbackSettingsForExecution(
  executionId: string,
  actor: string
): Promise<RollbackResult> {
  const id = String(executionId ?? "").trim();
  if (!id) return { ok: false, appliedCount: 0, keys: [], newKeys: [], message: "مفيش رقم تنفيذ — فما رجّعناش حاجة" };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, appliedCount: 0, keys: [], newKeys: [], message: "مفتاح المتجر مش ضابط — الرجوع ما اتعملش" };

  const { data, error } = await supabase
    .from("audit_log")
    .select("details")
    .eq("event_type", SETTING_HISTORY_KIND)
    .eq("details->>executionId", id)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[SiteSettingsDesk] history read refused:", error);
    return { ok: false, appliedCount: 0, keys: [], newKeys: [], message: "سجل التغييرات ما ردّش — الرجوع ما اتقارش" };
  }

  const newestPerKey = new Map<string, Record<string, unknown>>();
  for (const row of (data as HistoryRow[] | null) ?? []) {
    const details = row?.details;
    const key = typeof details?.settingKey === "string" ? details.settingKey : "";
    if (!key || details?.table !== "site_settings") continue;
    if (!newestPerKey.has(key)) newestPerKey.set(key, details);
  }

  const toRollback = [...newestPerKey.entries()].filter(([, details]) => details.status === "applied");
  if (toRollback.length === 0) {
    return {
      ok: false,
      appliedCount: 0,
      keys: [],
      newKeys: [],
      message: "مفيش تغيير مسجّل للتنفيذ ده — فما رجّعناش حاجة",
    };
  }

  const keys: string[] = [];
  const newKeys: string[] = [];
  const failures: string[] = [];

  for (const [key, details] of toRollback) {
    if (details.existedBefore === false) {
      // The key was created by this execution. Putting it back means deleting its row, and deleting
      // from the record is the owner's decision — so the desk says which key is waiting for him
      // instead of quietly writing a null the record would refuse, or erasing his data on its own.
      newKeys.push(key);
      continue;
    }

    const out = await writeSiteSetting({
      key,
      value: details.oldValue,
      actor,
      reason: `تراجع عن التنفيذ ${id}`,
      category: typeof details.category === "string" ? details.category : "general",
      executionId: id,
      status: "rolled_back",
    });
    if (out.applied) keys.push(key);
    else failures.push(key);
  }

  const settingName = (key: string) => factLabel(key) ?? "إعداد غير مسمّى";
  const waitingSentence = newKeys.length
    ? ` · ${arDigits(newKeys.length)} إعداد اتعمل جديد، والرجوع عنه حذف سطر وده قرار المالك`
    : "";
  const message = keys.length
    ? `رجّعنا ${arDigits(keys.length)} إعداد لقيمته قبل التنفيذ${failures.length ? ` · ${arDigits(failures.length)} ما رجعتش` : ""}${waitingSentence}.`
    : newKeys.length
      ? `الرجوع ما اتعملش: ${arDigits(newKeys.length)} إعداد اتعمل جديد، والرجوع عنه حذف سطر من المخزن — وده قرار المالك.`
      : "الرجوع ما اتعملش — المخزن رفض الكتابة.";

  const notes = [
    ...(newKeys.length ? [`مستني كلمة المالك: ${newKeys.map(settingName).join("، ")}`] : []),
    ...(failures.length ? [`ما رجعتش: ${failures.map(settingName).join("، ")}`] : []),
  ];

  return {
    ok: keys.length > 0 && failures.length === 0 && newKeys.length === 0,
    appliedCount: keys.length,
    keys,
    newKeys,
    message,
    ...(notes.length ? { note: notes.join(" · ") } : {}),
  };
}
