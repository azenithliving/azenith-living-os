/**
 * read.ts — the one owner of the numbers a customer reaches the store on.
 *
 * Measured 2026-10-13: the same fact had four producers. The store record (`companies.whatsapp`)
 * held a number ending 9584; the server env agreed; `lib/tenant.ts` queried a `tenants` table that
 * does not exist (the error is swallowed, so its hardcoded fallback answered); and the browser config
 * read `WHATSAPP_DEFAULT_NUMBER` while the home page read a *different* variable
 * (`NEXT_PUBLIC_WHATSAPP_NUMBER`) that is not set on the published site at all. The published result:
 * the home page, /rooms, /about, /start and /request carried zero WhatsApp links, and the 18
 * «اطلب عرض سعر فوري» buttons on /furniture opened a number ending 2345 — in local form, without the
 * country code, which wa.me cannot open.
 *
 * The owner is one row in the store's own settings record, edited from the cockpit. The arithmetic
 * lives in `format.ts` so a browser component can share the rule without dragging this reader — and
 * the service credential behind it — into the bundle.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { normalizeWhatsApp, NUMBERS_KEY, type StoreNumber } from "@/lib/store-numbers/format";

export { localForm, normalizeWhatsApp, whatsappHref, NUMBERS_KEY, type StoreNumber } from "@/lib/store-numbers/format";

function readList(value: unknown): StoreNumber[] {
  const raw = Array.isArray(value) ? value : [];
  const out: StoreNumber[] = [];
  for (const item of raw) {
    const record = (item ?? {}) as Record<string, unknown>;
    const value = normalizeWhatsApp(record.value ?? record.number ?? record.whatsapp);
    if (!value) continue;
    if (out.some((n) => n.value === value)) continue;
    out.push({
      value,
      label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : "رقم المتجر",
      primary: record.primary === true,
    });
  }
  // Exactly one primary: the first flagged, otherwise the first in the list.
  if (out.length > 0 && !out.some((n) => n.primary)) out[0].primary = true;
  let seen = false;
  for (const n of out) {
    if (!n.primary) continue;
    if (seen) n.primary = false;
    seen = true;
  }
  return out;
}

async function legacyCompanyNumber(): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data } = await supabase.from("companies").select("whatsapp").not("whatsapp", "is", null).limit(1).maybeSingle();
  return normalizeWhatsApp((data as { whatsapp?: string } | null)?.whatsapp);
}

/** Every number the store answers with, primary first. Never invented, never a broken link. */
export async function getStoreNumbers(): Promise<StoreNumber[]> {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data } = await supabase.from("site_settings").select("value").eq("key", NUMBERS_KEY).maybeSingle();
    const list = readList((data as { value?: unknown } | null)?.value);
    if (list.length > 0) return [...list].sort((a, b) => Number(b.primary) - Number(a.primary));
  }

  // Nothing saved yet: the store record answers, and the server env is the last word before silence.
  const legacy = await legacyCompanyNumber();
  const fallback = legacy ?? normalizeWhatsApp(process.env.WHATSAPP_DEFAULT_NUMBER ?? null);
  if (!fallback) return [];
  return [{ value: fallback, label: "الرقم الرئيسي", primary: true }];
}

/** The single number a button sends a customer to. */
export async function getPrimaryWhatsApp(): Promise<string | null> {
  const list = await getStoreNumbers();
  return list.find((n) => n.primary)?.value ?? null;
}
