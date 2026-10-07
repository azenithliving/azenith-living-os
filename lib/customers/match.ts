/**
 * match.ts — finding a customer from what someone typed.
 *
 * The owner photographs a paper and has to say whose it is. He is not going to remember a
 * key, and he is not going to scroll a list of every buyer he has ever had on a phone
 * screen: he types «محم» or the last four digits and presses the right one.
 *
 * The brake: this only ever ranks rows that are already in the roll. A query that matches
 * nothing returns nothing — no invented candidate, no «create new» shortcut that would
 * let a second ledger of people grow beside the real one.
 */
import { foldArabic, latinDigits } from "@/lib/arabic";
import { phoneForms, phoneKey } from "@/lib/customers/identity";
import { arDigits } from "@/lib/ops/metricLabels";

export type RollLine = {
  key: string;
  name: string | null;
  phone: string | null;
  email?: string | null;
};

export type RollMatch<T extends RollLine> = { line: T; why: string };

const digitsOf = (raw: unknown): string => latinDigits(raw).replace(/\D/g, "");

/**
 * Rank the roll against a query, best first. A phone match outranks a name match because
 * a number identifies a human and a name identifies maybe three.
 */
export function matchRoll<T extends RollLine>(lines: T[], query: string, limit = 8): RollMatch<T>[] {
  const text = String(query ?? "").trim();
  if (!text) return [];
  const folded = foldArabic(text);
  // His keyboard offers ٠١٢٣٤٥٦٧٨٩. Folded before any comparison, or the search would find
  // a name and silently never find a number.
  const typedPhone = phoneKey(latinDigits(text));
  const typedDigits = digitsOf(text);

  const scored: Array<{ line: T; score: number; why: string }> = [];
  for (const line of lines) {
    const name = foldArabic(line.name ?? "");
    const digits = digitsOf(line.phone ?? "");

    if (typedPhone && line.phone && phoneKey(line.phone) === typedPhone) {
      scored.push({ line, score: 100, why: "نفس الرقم" });
      continue;
    }
    if (typedDigits.length >= 3 && digits.endsWith(typedDigits)) {
      scored.push({ line, score: 90, why: "آخر الرقم" });
      continue;
    }
    const email = String(line.email ?? "").trim().toLowerCase();
    if (text.includes("@") && email && email.startsWith(folded)) {
      scored.push({ line, score: 85, why: "نفس الإيميل" });
      continue;
    }
    if (name && name.startsWith(folded)) {
      scored.push({ line, score: 60, why: "بداية الاسم" });
      continue;
    }
    if (name && folded.length >= 2 && name.includes(folded)) {
      scored.push({ line, score: 40, why: "جوّه الاسم" });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Same letters, two rows: the one carrying a mobile is the same person tomorrow, while a
    // bare name may be anybody — so it leads, and the owner sees the strongest reading first.
    const dialable = Number(Boolean(b.line.phone)) - Number(Boolean(a.line.phone));
    if (dialable !== 0) return dialable;
    return foldArabic(a.line.name ?? "").localeCompare(foldArabic(b.line.name ?? ""));
  });
  return scored.slice(0, limit).map(({ line, why }) => ({ line, why }));
}

/** The shortest honest description of a roll row on a phone screen: name, then last digits. */
export function rollLineLabel(line: RollLine): string {
  const name = String(line.name ?? "").trim();
  const digits = digitsOf(line.phone ?? "");
  // The last four are shown so he can recognise a man, not dial him — so they are his
  // numerals, and `arNum` would put a thousands separator inside a phone number.
  if (name && digits.length >= 4) return `${name} · ${arDigits(digits.slice(-4))}`;
  if (name) return name;
  // No name at all: the number is the only way to recognise him, so print the one he can dial —
  // the stored key drops the leading zero, and «1099999991» is not a number anyone calls.
  const dialable = phoneForms(line.phone ?? "");
  if (dialable) return arDigits(dialable.display);
  return String(line.email ?? "").trim() || "من غير اسم";
}
