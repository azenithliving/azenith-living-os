import "server-only";

import { recordAuditEvent } from "@/lib/ops/audit-record";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * The one owner of «change a store setting».
 *
 * The shape here is measured, not designed (live store, 2026-11-06): `site_settings` answers exactly
 * four columns — `key`, `value`, `updated_at`, `updated_by` — and its natural key is `key`. The code
 * that used to write settings spoke a different table: it filtered `site_settings.id`, wrote
 * `setting_value` and `current_revision_id`, and inserted its history into `content_revisions`, a
 * drawer the record has never heard of (PGRST205). Every one of those writes was refused, so the
 * employee tool «غيّر إعداد» failed on its first statement every time it was called.
 *
 * History rides on `audit_log`, which exists and already has one writer (`lib/ops/audit-record.ts`).
 * Inventing a second drawer for the same fact is how a store ends up with two answers to «what
 * changed, and what was it before».
 */
export const SETTING_COLUMNS = ["key", "value", "updated_at", "updated_by"] as const;
export const SETTING_HISTORY_KIND = "setting_change";

export type SettingWriteResult = {
  ok: boolean;
  applied: boolean;
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

  if (error) return { measured: false as const, value: null, reason: error };
  return { measured: true as const, value: data ? data.value : null };
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
  const actor = String(input.actor ?? "").trim() || "system";
  const refused = (message: string, extra: Partial<SettingWriteResult> = {}): SettingWriteResult => ({
    ok: false,
    applied: false,
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
    return refused(`المخزن ما ردّش على الإعداد «${key}» — فالتغيير ما اتعملش`);
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
        reason: input.reason ?? null,
        category: input.category ?? "general",
        executionId: input.executionId ?? null,
        status: "waiting",
      },
    });
    return {
      ok: true,
      applied: false,
      key,
      oldValue: current.value,
      newValue: input.value,
      historyId: history.ok ? history.id : null,
      message: `طلب تغيير الإعداد «${key}» اتسجّل، والقيمة لسه ما اتغيرتش`,
      ...(history.ok ? {} : { note: `السجل ما استقبلش الطلب: ${history.error}` }),
    };
  }

  const { data: written, error } = await supabase
    .from("site_settings")
    .upsert(
      {
        key,
        value: input.value as never,
        updated_at: new Date().toISOString(),
        updated_by: actor,
      } as never,
      { onConflict: "key" }
    )
    .select("key, value")
    .single<{ key: string; value: unknown }>();

  if (error) {
    console.error("[SiteSettingsDesk] write refused:", error);
    return refused(`الإعداد «${key}» ما اتغيرش — المخزن رفض الكتابة`);
  }
  if (!written) {
    return refused(`الإعداد «${key}» ما اتأكدش إنه اتغير — فما بنقولش «اتغير» من غير قراية`);
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
      reason: input.reason ?? null,
      category: input.category ?? "general",
      executionId: input.executionId ?? null,
      status: input.status ?? "applied",
    },
  });

  return {
    ok: true,
    applied: true,
    key,
    oldValue: current.value,
    newValue: written.value,
    historyId: history.ok ? history.id : null,
    message: `الإعداد «${key}» اتغير، والقراية من المخزن أكّدته.`,
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
  if (!id) return { ok: false, appliedCount: 0, keys: [], message: "مفيش رقم تنفيذ — فما رجّعناش حاجة" };

  const supabase = getSupabaseAdminClient();
  if (!supabase) return { ok: false, appliedCount: 0, keys: [], message: "مفتاح المتجر مش ضابط — الرجوع ما اتعملش" };

  const { data, error } = await supabase
    .from("audit_log")
    .select("details")
    .eq("event_type", SETTING_HISTORY_KIND)
    .eq("details->>executionId", id)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[SiteSettingsDesk] history read refused:", error);
    return { ok: false, appliedCount: 0, keys: [], message: "سجل التغييرات ما ردّش — الرجوع ما اتقارش" };
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
      message: "مفيش تغيير مسجّل للتنفيذ ده — فما رجّعناش حاجة",
    };
  }

  const keys: string[] = [];
  const failures: string[] = [];

  for (const [key, details] of toRollback) {
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

  const message = keys.length
    ? `رجّعنا ${keys.length} إعداد لقيمته قبل التنفيذ${failures.length ? ` · ${failures.length} ما رجعتش` : ""}.`
    : "الرجوع ما اتعملش — المخزن رفض الكتابة.";

  return {
    ok: keys.length > 0 && failures.length === 0,
    appliedCount: keys.length,
    keys,
    message,
    ...(failures.length ? { note: `ما رجعتش: ${failures.join("، ")}` } : {}),
  };
}
