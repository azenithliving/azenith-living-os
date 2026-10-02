/**
 * family-votes.ts — the store's record of what the family chose.
 *
 * The plan asks for the couple or the family to open the customer's own address together and
 * tap like on the pieces they prefer, and for those preferences to reach the owner's sheet.
 * No account and no password: the token in the address is the whole login, and a voter is a
 * short label they type themselves («أنا»، «مراتي»، «أحمد»).
 *
 * One row per (sheet, picture, voter) so a second tap changes a mind instead of piling up a
 * number nobody can trust. The picture's bank id is the key, with a url hash behind it for a
 * picture the bank no longer holds, because a family's decision has to keep pointing at the
 * same thing after the bank is re-curated.
 *
 * The pure half — keys, names, tallies — lives in `vote-keys.ts`, because this file reaches the
 * database and the customer's page must not carry that into the browser.
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { cleanVoter, type VoteRow } from "@/lib/cad/vote-keys";

export * from "@/lib/cad/vote-keys";

/** Whose sheet is this, from the address in the bar. Only the number and the key leave here. */
export async function findSketchByToken(token: string): Promise<{ id: number; customerKey: string | null } | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("room_sketches")
    .select("id,customer_key")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return { id: Number(data.id), customerKey: data.customer_key ? String(data.customer_key) : null };
}

export async function readVotes(sketchId: number): Promise<VoteRow[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("family_votes")
    .select("image_key,image_url,voter,liked,updated_at")
    .eq("sketch_id", sketchId)
    .order("updated_at", { ascending: true })
    .limit(500);
  if (error) {
    console.warn("[FamilyVotes] the vote desk did not answer:", error.message);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    image_key: String(row.image_key),
    image_url: row.image_url ? String(row.image_url) : null,
    voter: cleanVoter(row.voter),
    liked: Boolean(row.liked),
    updated_at: String(row.updated_at),
  }));
}

/**
 * Every vote a customer's papers have collected, for the owner's desk. Read by the list of his
 * sketch ids, because the family votes belong to a paper, and a customer may hold several.
 */
export async function readVotesForSketches(sketchIds: number[]): Promise<VoteRow[]> {
  const ids = sketchIds.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return [];
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("family_votes")
    .select("image_key,image_url,voter,liked,updated_at")
    .in("sketch_id", ids)
    .order("updated_at", { ascending: true })
    .limit(1000);
  if (error) {
    console.warn("[FamilyVotes] the owner's desk could not read the votes:", error.message);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    image_key: String(row.image_key),
    image_url: row.image_url ? String(row.image_url) : null,
    voter: cleanVoter(row.voter),
    liked: Boolean(row.liked),
    updated_at: String(row.updated_at),
  }));
}

/**
 * One tap, one row. Returning false means the store's record refused, and the page has to say
 * so rather than paint a heart that nobody stored.
 */export async function recordVote(input: {
  sketchId: number;
  imageKey: string;
  imageUrl?: string | null;
  voter: string;
  liked: boolean;
}): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !input.imageKey) return false;
  const { error } = await supabase.from("family_votes").upsert(
    {
      sketch_id: input.sketchId,
      image_key: input.imageKey.slice(0, 48),
      image_url: input.imageUrl ? String(input.imageUrl).slice(0, 600) : null,
      voter: cleanVoter(input.voter),
      liked: Boolean(input.liked),
    },
    { onConflict: "sketch_id,image_key,voter" }
  );
  if (error) {
    console.warn("[FamilyVotes] the vote was not stored:", error.message);
    return false;
  }
  return true;
}
