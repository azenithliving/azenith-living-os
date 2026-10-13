/**
 * format.ts — the arithmetic of a phone number, with no database in it.
 *
 * Split from `lib/store-numbers.ts` because the footer is a browser component and the file that
 * reads the store record carries `server-only`: importing the reader from a client component drags a
 * service credential into the bundle, which is how this store has broken a build twice before.
 */

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

/** The number the way a customer reads and dictates it: local Egyptian form. */
export function localForm(value: string): string {
  const digits = normalizeWhatsApp(value) ?? String(value ?? "").replace(/\D/g, "");
  return digits.startsWith("20") && digits.length === 12 ? `0${digits.slice(2)}` : digits;
}

/** The only place a store WhatsApp address is written. */
export function whatsappHref(value: string | null, message?: string): string | null {
  if (!value) return null;
  const text = message?.trim();
  return `https://wa.me/${value}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
