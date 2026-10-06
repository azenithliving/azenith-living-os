import { roomLabel } from "@/lib/cad/dossier";
import { arDigits } from "@/lib/ops/metricLabels";

/**
 * The heat of a customer, and the line that wakes the owner up.
 *
 * The architecture names three proofs that a visitor is ready to be called — he raised his paper,
 * he handed the link to a second person, or he came back to the pictures more than three times —
 * and asks for a Telegram notice in the same minute. Before this module no rule anywhere raised a
 * customer to «ساخن جداً», so the golden moment passed with the owner asleep.
 *
 * Pure on purpose: a guard can read the rule, and a door that cannot reach a model still knows how
 * to count (the zero-key floor — this is arithmetic, not intelligence).
 */

export type Heat = "ساخن جداً" | "جدّي" | "بيتفرج";

export type HeatSignals = {
  /** Distinct people who voted on this sheet — a second one cannot exist unless the link was shared. */
  voters: number;
  /** The customer put his own measurements on the sheet. */
  hasSketch: boolean;
  /** How many times he came back to the pictures. */
  returns: number;
};

/** The fourth return, not the third: the paper says «أكثر من ٣ مرات». */
const HOT_AFTER_RETURNS = 3;

export function heatOf({ voters, hasSketch, returns }: HeatSignals): Heat {
  if (hasSketch || voters >= 2 || returns > HOT_AFTER_RETURNS) return "ساخن جداً";
  if (voters === 1) return "جدّي";
  return "بيتفرج";
}

export function pulseFor({
  room,
  city,
  voters,
  heat,
}: {
  room: string | null | undefined;
  city?: string | null;
  voters: number;
  heat: Heat;
}): string {
  const place = roomLabel(room) ?? "مكان على الورقة";
  const where = city && city.trim() ? ` في ${city.trim()}` : "";
  const proof =
    voters >= 2
      ? `شارك رابطه مع ${arDigits(voters)} من أهله وصوّتوا على الصور`
      : voters === 1
        ? "اختار صور ووقف عندها"
        : "رجع يتفرج على الصور أكتر من تلات مرات";
  return `🔥 عميل ${heat}: ${place}${where} — ${proof}. ملفه الذهبي مستنيك دلوقتي.`;
}

/**
 * One pulse per sheet. A rule that fires on every tap would train him to ignore the bot, which is
 * worse than not sending it — so the send is stamped and the stamp is what this reads.
 */
export function shouldPulse(signals: HeatSignals, sentAt: Date | string | null): boolean {
  if (sentAt) return false;
  return heatOf(signals) === "ساخن جداً";
}
