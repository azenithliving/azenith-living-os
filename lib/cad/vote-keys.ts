/**
 * vote-keys.ts — the arithmetic of the family decision room, with nothing behind it.
 *
 * Split out of `family-votes` on purpose: the customer's page is a browser bundle, and the file
 * that opens the store's record pulls a server-only client with it. Measured the moment the two
 * lived in one import: the private sheet page answered 500 with `supabase-admin` in the client
 * component stack. Keys, names and tallies are pure; the door keeps the database.
 */

export type VoteRow = {
  image_key: string;
  image_url: string | null;
  voter: string;
  liked: boolean;
  updated_at: string;
};

export type PictureTally = {
  image_key: string;
  url: string | null;
  likes: number;
  voters: string[];
};

/** A voter who taps without writing a name is still a vote, and must not be dropped for it. */
export const ANON_VOTER = "ضيف";

/** The label is printed on the owner's desk, so it is one line, short, and without markup. */
export function cleanVoter(raw: unknown): string {
  const text = String(raw ?? "")
    .replace(/[\u0000-\u001f<>"'`]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 24);
  return text || ANON_VOTER;
}

/** A picture's stable key: its bank id when the bank still has it, otherwise its address. */
export function imageKeyOf(image: { id?: number | string | null; url: string }): string {
  const id = image.id === null || image.id === undefined ? "" : String(image.id).trim();
  if (id) return `i${id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40)}`;
  let hash = 5381;
  for (let i = 0; i < image.url.length; i += 1) hash = ((hash << 5) + hash + image.url.charCodeAt(i)) >>> 0;
  return `u${hash.toString(36)}`;
}

/**
 * Group the rows into what each picture got. Only likes count, and pictures with the same number
 * of likes keep a stable order so the grid does not shuffle under someone's finger.
 */
export function tallyVotes(rows: VoteRow[]): PictureTally[] {
  const byKey = new Map<string, PictureTally>();
  for (const row of rows) {
    if (!row?.image_key) continue;
    const entry = byKey.get(row.image_key) ?? { image_key: row.image_key, url: row.image_url ?? null, likes: 0, voters: [] };
    if (!entry.url && row.image_url) entry.url = row.image_url;
    if (row.liked && !entry.voters.includes(row.voter)) {
      entry.voters.push(row.voter);
      entry.likes = entry.voters.length;
    }
    byKey.set(row.image_key, entry);
  }
  return [...byKey.values()].sort((a, b) => b.likes - a.likes || a.image_key.localeCompare(b.image_key));
}

/** The pieces the family keeps coming back to — what the owner's desk leads with. */
export function topPicks(tallies: PictureTally[], count = 3): PictureTally[] {
  return tallies.filter((tally) => tally.likes > 0).slice(0, count);
}
