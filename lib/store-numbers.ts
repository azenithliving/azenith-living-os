/**
 * store-numbers.ts — the one owner of the numbers a customer reaches the store on.
 *
 * Measured 2026-10-13: the same fact had four producers. The store record (`companies.whatsapp`)
 * held a number ending 9584; the server env agreed; `lib/tenant.ts` queried a `tenants` table that
 * does not exist (the error is swallowed, so its hardcoded fallback answered); and the browser config
 * read `WHATSAPP_DEFAULT_NUMBER` while the home page read a *different* variable
 * (`NEXT_PUBLIC_WHATSAPP_NUMBER`) that is not set on the published site at all. The result on the
 * published pages: the home page, /rooms, /about, /start and /request carried zero WhatsApp links,
 * and the 18 «اطلب عرض سعر فوري» buttons on /furniture opened a number ending 2345 — in local form,
 * without the country code, which wa.me cannot open.
 *
 * The owner is one row in the store's own settings record, edited from the cockpit. Every surface
 * reads it through this file, and a link is only ever built in international form.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** The settings key the list lives under. */
export const NUMBERS_KEY = "contact_numbers";

export type StoreNumber = {
  /** International digits, no plus: 201090819584. */
  value: string;
  /** What he calls it: «المبيعات»، «الورشة»… */
  label: string;
  /** The one a customer is sent to by default. */
  primary: boolean;
};

/** Egyptian mobile in local form: 010/011/012/015 + 8 digits. */
const EGYPT_LOCAL = /^01[0125]\d{8}$/;

/**
 * Digits a WhatsApp link can open. A local Egyptian number gets the country code; an already
 * international one passes through; anything else answers null rather than a broken link.
 */
export function normalizeWhatsApp(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (EGYPT_LOCAL.test(digits)) return `20${digits.slice(1)}`;
  if (/^201[0125]\d{8}$/.test(digits)) return digits;
  return digits.length >= 10 ? digits : null;
}

/** The only place a store WhatsApp address is written. */
export function whatsappHref(value: string | null, message?: string): string | null {
  if (!value) return null;
  const text = message?.trim();
  return `https://wa.me/${value}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

function readList(value: unknown): StoreNumber[] {
  const raw = Array.isArray(value) ? value : [];
  const out: StoreNumber[] = [];
  for (const item of raw) {
    const record = (item ?? {}) as Record<string, unknown>;
    const value = normalizeWhatsApp(record.value ?? record.number ?? record.whatsapp);
    if (!value) continue;
    out.push({
      value,
      label: typeof record.label === "string" && record.label.trim() ? record.label.trim() : "رقم المتجر",
      primary: record.primary === true,
    });
  }
  // Exactly one primary: the first flagged, otherwise the first in the list.
  if (out.length > 0 && !out.some((n) => n.primary)) out[0].primary = true;
  if (out.length > 1) {
    let seen = false;
    for (const n of out) {
      if (!n.primary) continue;
      if (seen) n.primary = false;
      seen = true;
    }
    if (!out.some((n) => n.primary)) out[0].primary = true;
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
