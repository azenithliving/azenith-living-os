/**
 * visit-keys.ts — the arithmetic of «he came back», with nothing behind it.
 *
 * Split from `sheet-visits` for the same reason `vote-keys` was: the customer's page is a browser
 * bundle, and the file that opens the store's record pulls a server-only client into it. Key shape
 * and counting are pure; the door keeps the database.
 *
 * A return is deliberately not a page load. Six phones on one link, a page that reloads after every
 * colour tap, and a customer refreshing to find a picture again would all print interest that is
 * not there. Only the store applies the window — see `register_sheet_visit` — because two tabs
 * opening in the same second must still count one visit.
 */

/** Half an hour of silence is what separates one look from the next. */
export const RETURN_GAP_MINUTES = 30;

/**
 * The label one phone keeps for itself: long enough not to collide with another device, made of
 * characters a URL header carries safely, and never anything that says who.
 */
const DEVICE_KEY = /^[A-Za-z0-9_-]{8,40}$/;

export function cleanDeviceKey(raw: unknown): string | null {
  const text = String(raw ?? "").trim();
  return DEVICE_KEY.test(text) ? text : null;
}

/** A fresh label for a phone that has never opened this sheet. */
export function newDeviceKey(): string {
  const web = (globalThis as { crypto?: Crypto }).crypto;
  if (web?.getRandomValues) {
    const bytes = new Uint8Array(12);
    web.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // A browser with no randomness source still gets a private label; a guessable one would let a
  // stranger's opens be counted as somebody else's returns.
  let out = "";
  while (out.length < 24) out += Math.random().toString(36).slice(2);
  return out.slice(0, 24);
}

export type VisitRow = { visit_count?: number | string | null };

/**
 * How many times the sheet was come back to. Each device's first open is not a return, and a row
 * that read back as zero can never borrow one from its neighbour.
 */
export function returnsFromRows(rows: VisitRow[]): number {
  return (rows ?? []).reduce(
    (sum, row) => sum + Math.max(0, Number(row?.visit_count ?? 0) - 1),
    0
  );
}
