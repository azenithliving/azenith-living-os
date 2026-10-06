/**
 * sheet-visits.ts — the store's memory of who came back to which sheet.
 *
 * The heat rule's third proof («رجع يتفرج على الصور أكتر من تلات مرات») had no counter anywhere:
 * the votes desk was passing a literal zero, so a customer who looked at his pictures for a week
 * without raising a paper or sharing the link stayed invisible to the owner.
 *
 * One row per (sheet, device), holding the count and the last time that device was seen. The window
 * is applied by the store in the same statement as the write, because two phones opening the sheet
 * at once would otherwise each claim the same return.
 */
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { cleanDeviceKey, RETURN_GAP_MINUTES, returnsFromRows } from "@/lib/cad/visit-keys";

/** A sheet is a family, not a crowd; the ceiling is what stops a stranger filling the table. */
const MAX_DEVICES_PER_SHEET = 100;

/**
 * One open, one line in the store. Returns the count the store actually holds for that device, or
 * null when nothing was written — a failed visit read must never cost the customer his sheet.
 */
export async function recordVisit(sketchId: number, rawKey: unknown): Promise<number | null> {
  const deviceKey = cleanDeviceKey(rawKey);
  if (!deviceKey || !Number.isFinite(sketchId)) return null;
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("register_sheet_visit", {
      p_sketch: sketchId,
      p_device: deviceKey,
      p_gap_minutes: RETURN_GAP_MINUTES,
    });
    if (error) {
      console.warn("[SheetVisits] the store refused the open:", error.message);
      return null;
    }
    const counted = Number(data);
    if (!Number.isFinite(counted)) return null;
    // Written and read back in the same statement: the number printed here is the store's, not ours.
    console.log(`[SheetVisits] sheet ${sketchId} open counted ${counted}`);
    return counted;
  } catch (error) {
    console.warn("[SheetVisits] the visit door could not reach the store:", error);
    return null;
  }
}

/**
 * How many returns this sheet has collected across every device holding its address. Zero on a
 * failed read, because an unreadable row is not evidence of interest.
 */
export async function countReturns(sketchId: number): Promise<number> {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !Number.isFinite(sketchId)) return 0;
  try {
    const { data, error } = await supabase
      .from("sheet_visits")
      .select("visit_count")
      .eq("sketch_id", sketchId)
      .limit(MAX_DEVICES_PER_SHEET);
    if (error) {
      console.warn("[SheetVisits] the return counter did not answer:", error.message);
      return 0;
    }
    return returnsFromRows(data ?? []);
  } catch (error) {
    console.warn("[SheetVisits] the return counter could not reach the store:", error);
    return 0;
  }
}
