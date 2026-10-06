import { arDigits } from "@/lib/ops/metricLabels";

/**
 * The owner's Telegram copy — one place that decides what an alert looks like on his phone.
 *
 * Measured 2026-10-06 from his own screenshots: every notice that reached him was English labels
 * over a UTC timestamp («ADMIN LOGIN WITH 2FA · Time: 2026-10-06T10:12:37.142Z» while his phone
 * clock said ١:١٢ م), and the morning story carried Latin digits. He reads Arabic, counts in his
 * own numerals, and lives on a phone — so the shape of a notice belongs here, not in eleven call
 * sites that each invent their own English.
 *
 * Values he might copy (an e-mail, an IP, a key id) stay exactly as they are; numbers, labels and
 * times are his.
 */

const CAIRO = "Africa/Cairo";

const clock = new Intl.DateTimeFormat("ar-EG", {
  timeZone: CAIRO,
  dateStyle: "short",
  timeStyle: "short",
});

/** The instant as his phone shows it: «٦/١٠/٢٠٢٦، ١:١٢ م». Never a UTC string he has to convert. */
export function telegramTime(when: Date | string | number = new Date()): string {
  const at = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(at.getTime())) return "وقت غير مقروء";
  return clock.format(at);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fieldValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return arDigits(String(value));
  return escapeHtml(String(value));
}

/**
 * One alert: an icon, an Arabic title, and the facts as Arabic-labelled lines.
 *
 * `note` is the sentence that tells him what to do, and it is the only line allowed to read like
 * prose — the rest is data, and data on his screen is a label and a value.
 */
export function telegramAlert(
  icon: string,
  title: string,
  fields: Array<[label: string, value: unknown]>,
  note?: string
): string {
  const lines = [`<b>${icon} ${escapeHtml(title)}</b>`, ""];
  for (const [label, value] of fields) {
    if (value === undefined) continue;
    lines.push(`• ${escapeHtml(label)}: ${fieldValue(value)}`);
  }
  if (note) {
    lines.push("", escapeHtml(note));
  }
  return lines.join("\n");
}
