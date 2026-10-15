/**
 * memory.ts — writing and reading the customer's memory in the store's record.
 *
 * Measured 2026-10-15: the shop had never stored one taste fact about a person. The old store
 * (`user_preferences`) was written by code naming six columns the table does not have, so every write
 * was refused with 42703 and the refusal was swallowed in a `catch` that only printed to the console.
 * What the store does learn lives on one paper or one advisor session — 150 sessions, 2 carrying a
 * style, 0 carrying his phone — so his taste died with the tab and a returning customer was a stranger
 * again.
 *
 * Facts are kept under `customer_key`, the roll's own key (`phone:…`, `email:…`, `name:…`) formed only
 * by `lib/cad/sketch-link.ts` and never guessed from a photo. Text, not vectors: the store must
 * remember him with zero model keys. The words, the labels and the sentence live in `memory-words.ts`.
 */
import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { linkFromPhone, parseSketchLink } from "@/lib/cad/sketch-link";
import { cleanValue, isMemoryKind, type Fact, type MemoryRow } from "@/lib/customers/memory-words";

export * from "@/lib/customers/memory-words";

export type RememberResult = { wrote: number; stored: number; failures: string[] };

/**
 * Write his facts one at a time. A fact he already gave keeps its first day and only refreshes the last
 * one, because «أول مرة قالها» is the half the owner reads as history.
 *
 * Every number returned is read back out of the table, and a refusal is named — the old silence is
 * exactly what this file replaces.
 */
export async function rememberFacts(
  customerKey: string | null | undefined,
  companyId: string | null | undefined,
  facts: Fact[]
): Promise<RememberResult> {
  const link = parseSketchLink(customerKey);
  const supabase = getSupabaseAdminClient();
  if (!link || !companyId || !supabase) {
    return { wrote: 0, stored: 0, failures: ["مفيش مفتاح عميل صحيح أو متجر — الذاكرة ما اتكتبتش"] };
  }

  const failures: string[] = [];
  let wrote = 0;

  for (const fact of facts) {
    const value = cleanValue(fact.value);
    if (!value || !isMemoryKind(fact.kind)) {
      failures.push(`سطر مرفوض (${fact.kind}): مفيش قيمة`);
      continue;
    }
    const now = new Date().toISOString();
    const { count, error: asked } = await supabase
      .from("customer_memory")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("customer_key", link.key)
      .eq("kind", fact.kind)
      .eq("value", value);
    if (asked) {
      failures.push(`السجل ما ردّش (${fact.kind}): ${asked.message}`);
      continue;
    }

    if ((count ?? 0) > 0) {
      const { error: touched } = await supabase
        .from("customer_memory")
        .update({ last_seen_at: now, source: fact.source })
        .eq("company_id", companyId)
        .eq("customer_key", link.key)
        .eq("kind", fact.kind)
        .eq("value", value);
      if (touched) failures.push(`تحديث مرفوض (${fact.kind}): ${touched.message}`);
      else wrote += 1;
      continue;
    }

    const { error: inserted } = await supabase.from("customer_memory").insert({
      company_id: companyId,
      customer_key: link.key,
      kind: fact.kind,
      value,
      source: fact.source,
      evidence: cleanValue(fact.evidence ?? null),
      first_seen_at: now,
      last_seen_at: now,
    });
    if (inserted) failures.push(`كتابة مرفوضة (${fact.kind}): ${inserted.message}`);
    else wrote += 1;
  }

  const { data: rows, error } = await supabase
    .from("customer_memory")
    .select("id")
    .eq("company_id", companyId)
    .eq("customer_key", link.key);
  if (error) failures.push(`الرجوع من السجل مرفوض: ${error.message}`);
  const stored = rows?.length ?? 0;
  console.log(`[CustomerMemory] ${link.key}: wrote ${wrote} · stored ${stored} · refused ${failures.length}`);
  return { wrote, stored, failures };
}

/**
 * The same write for a door that only holds the digits he typed. The key is formed by the roll's own
 * reader, so a number that is not an Egyptian mobile stores nothing rather than storing a stranger.
 */
export async function rememberForPhone(
  rawPhone: unknown,
  companyId: string | null | undefined,
  facts: Fact[]
): Promise<RememberResult> {
  const link = linkFromPhone(rawPhone);
  if (!link) return { wrote: 0, stored: 0, failures: ["الرقم المكتوب مش موبايل مصري — مفيش ذاكرة اتكتبت"] };
  return rememberFacts(link.key, companyId, facts);
}

/** Everything the store holds about him, newest first. A refusal is named, never drawn as an empty memory. */
export async function recallFacts(
  customerKey: string | null | undefined,
  companyId: string | null | undefined
): Promise<{ rows: MemoryRow[]; failure: string | null }> {
  const link = parseSketchLink(customerKey);
  const supabase = getSupabaseAdminClient();
  if (!link || !companyId || !supabase) return { rows: [], failure: null };
  const { data, error } = await supabase
    .from("customer_memory")
    .select("kind,value,source,evidence,first_seen_at,last_seen_at")
    .eq("company_id", companyId)
    .eq("customer_key", link.key)
    .order("last_seen_at", { ascending: false })
    .limit(40);
  if (error) return { rows: [], failure: `سجل الذاكرة ما ردّش: ${error.message}` };
  return { rows: (data ?? []) as unknown as MemoryRow[], failure: null };
}
