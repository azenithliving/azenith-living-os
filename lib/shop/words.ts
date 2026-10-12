import { arNum } from "@/lib/ops/metricLabels";

/**
 * words.ts — the customer's own wording for the ready-products shelf.
 *
 * Split from `shelf.ts` because that half reads the database and is server-only: an owner's screen
 * that imports the price sentence must not drag a service credential into the browser bundle. One
 * number, one currency word — a price is read off the screen, never summed there, so it is written
 * in his Arabic numerals with the word «جنيه» spelled out.
 */

/** One number, one currency word. */
export function priceLine(value: number): string {
  return `${arNum(Math.round(value))} جنيه`;
}

/** The line a visitor reads while the shelf is still empty. */
export const SHELF_EMPTY_LINE = "الرفّ لسه فاضي — أول قطعة نجهّزها هننزلها هنا";
