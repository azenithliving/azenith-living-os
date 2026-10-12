/**
 * shelf.ts — reads the customer's ready-products shelf out of the store's own records.
 *
 * The rule itself lives in `lib/shop/rule.ts` (no database, so a guard can test it). This half only
 * asks the table and turns a stored picture path into an address a browser can load.
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { coverOf, isDisplayable, priceOf, SHELF_BUCKET, type ShelfPiece } from "@/lib/shop/rule";

/** A stored path is not a web address — a bucket path gets minted, a real link passes through. */
function toUrl(supabase: NonNullable<ReturnType<typeof getSupabaseAdminClient>>, raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return supabase.storage.from(SHELF_BUCKET).getPublicUrl(raw.replace(/^\/+/, "")).data.publicUrl;
}

/**
 * The pieces a visitor is shown, newest first. A missing connection answers as an empty shelf —
 * the page then says «قريبًا», which is the truth, rather than an error the visitor never sees.
 */
export async function listShelf(limit = 24): Promise<ShelfPiece[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("products")
    .select("id,name,slug,sale_price,base_price,short_description,description,featured_image_url,gallery_images,created_at,is_active")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 60));

  if (error || !data) return [];

  const pieces: ShelfPiece[] = [];
  for (const row of data as Record<string, unknown>[]) {
    if (!isDisplayable(row)) continue;
    const gallery = Array.isArray(row.gallery_images) ? row.gallery_images : [];
    pieces.push({
      id: String(row.id),
      name: String(row.name ?? ""),
      slug: String(row.slug ?? ""),
      price: priceOf(row),
      shortDescription: String(row.short_description ?? ""),
      description: String(row.description ?? ""),
      coverUrl: toUrl(supabase, coverOf(row)),
      gallery: gallery
        .map((g) => (typeof g === "string" ? g : (g as { url?: string })?.url ?? ""))
        .filter(Boolean)
        .map((g) => toUrl(supabase, g)),
      createdAt: row.created_at ? String(row.created_at) : null,
    });
  }
  return pieces;
}
