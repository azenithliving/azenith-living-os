/**
 * GET  /api/admin/keys/desk — every free model the store can run on, how many of his keys
 *      answer right now, and how to get one where the answer is none.
 * POST /api/admin/keys/desk — ask the providers, in a bounded batch, whether his keys live.
 *
 * The counts are read from the pool and the verdicts from a real request to each company.
 * A key value never appears in either answer: the desk reports who is alive, not what the
 * key is. The batch is capped because a verification pass must not become the thing that
 * spends the ceiling it is measuring.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { KEY_DESK_PROVIDERS, deskVerdict } from "@/lib/ops/key-desk";
import { verifyKey } from "@/lib/ops/key-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The pool's own verdict column, written by the verifier; `notes` stays provenance. */
const ALIVE = "alive";
const WRITES = "writes";
const UNFUNDED = "unfunded";
const QUOTA = "quota";
const REFUSED = "refused";
const isQuarantined = (note: string | null) => String(note ?? "").startsWith("quarantined");

type PoolRow = { id: number; provider: string; is_active: boolean; notes: string | null; check_state: string | null; last_checked_at: string | null };

async function readPool(): Promise<{ rows: PoolRow[] | null; error: string }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { rows: null, error: "المتجر غير متصل دلوقتي" };
  const { data, error } = await supabase
    .from("api_keys")
    .select("id,provider,is_active,notes,check_state,last_checked_at")
    .limit(5000);
  if (error) return { rows: null, error: "السجل ما ردّش على قايمة المفاتيح" };
  return { rows: (data ?? []) as unknown as PoolRow[], error: "" };
}

function deskOf(rows: PoolRow[]) {
  return KEY_DESK_PROVIDERS.map((provider) => {
    const mine = rows.filter((r) => String(r.provider ?? "").toLowerCase() === provider.id);
    const checked = mine.filter((r) => r.check_state);
    const counts = {
      rows: mine.length,
      active: mine.filter((r) => r.is_active).length,
      alive: mine.filter((r) => r.check_state === ALIVE).length,
      writes: mine.filter((r) => r.check_state === WRITES).length,
      unfunded: mine.filter((r) => r.check_state === UNFUNDED).length,
      quota: mine.filter((r) => r.check_state === QUOTA).length,
      refused: mine.filter((r) => r.check_state === REFUSED).length,
      quarantined: mine.filter((r) => isQuarantined(r.notes)).length,
      unverified: mine.length - checked.length,
      lastCheck: checked.reduce<string | null>((latest, r) => (r.last_checked_at && (!latest || r.last_checked_at > latest) ? r.last_checked_at : latest), null),
    };
    return { ...provider, ...counts, verdict: deskVerdict(counts) };
  });
}

export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { rows, error } = await readPool();
  if (!rows) return NextResponse.json({ success: false, error }, { status: 500 });

  const desk = deskOf(rows);
  return NextResponse.json({
    success: true,
    providers: desk,
    totals: {
      keys: rows.length,
      // Two numbers, not one: who answers a hello, and who has actually written an answer.
      alive: rows.filter((r) => r.check_state === ALIVE).length,
      writes: rows.filter((r) => r.check_state === WRITES).length,
      unfunded: rows.filter((r) => r.check_state === UNFUNDED).length,
      refused: rows.filter((r) => r.check_state === REFUSED).length,
      quarantined: rows.filter((r) => isQuarantined(r.notes)).length,
      withLiveKey: desk.filter((p) => p.writes > 0).length,
      needingKey: desk.filter((p) => p.writes === 0).length,
    },
  });
}

/**
 * Verify a bounded batch. `provider` narrows it, `limit` is capped at 25 so one press on a
 * phone cannot turn into a thousand calls to somebody's API.
 */
export async function POST(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });

  let body: { provider?: string; limit?: number } = {};
  try {
    body = await request.json();
  } catch {
    /* an empty press verifies a mixed batch */
  }
  const provider = typeof body.provider === "string" ? body.provider.toLowerCase() : null;
  const limit = Math.min(25, Math.max(1, Number(body.limit ?? 12) || 12));

  let query = supabase.from("api_keys").select("id,provider,key,error_count").eq("is_active", true).limit(limit);
  if (provider) query = query.eq("provider", provider);
  const { data, error } = await query;
  if (error) return NextResponse.json({ success: false, error: "السجل ما جابش المفاتيح" }, { status: 500 });

  const rows = (data ?? []) as unknown as { id: number; provider: string; key: string; error_count: number | null }[];
  const states: Record<string, number> = {};
  for (const row of rows) {
    const outcome = await verifyKey(row.provider, row.key);
    states[outcome.state] = (states[outcome.state] ?? 0) + 1;
    const stamp = new Date().toISOString();
    const day = stamp.slice(0, 10);
    if (outcome.state === "alive") {
      await supabase
        .from("api_keys")
        .update({ is_active: true, check_state: ALIVE, last_checked_at: stamp, notes: `verified ${day}: alive`, last_error: null, error_count: 0, cooldown_until: null })
        .eq("id", row.id);
    } else if (outcome.state === "quota") {
      await supabase
        .from("api_keys")
        .update({
          check_state: QUOTA,
          last_checked_at: stamp,
          notes: `verified ${day}: valid, quota spent now`,
          last_error: "quota",
          cooldown_until: new Date(Date.now() + 3600e3).toISOString(),
        })
        .eq("id", row.id);
    } else if (outcome.state === "dead") {
      await supabase
        .from("api_keys")
        .update({
          is_active: false,
          check_state: REFUSED,
          last_checked_at: stamp,
          notes: `verified ${day}: refused by the provider`,
          last_error: outcome.note,
          error_count: Number(row.error_count ?? 0) + 1,
        })
        .eq("id", row.id);
    }
    // unreachable / unwritten: nothing is concluded, so nothing is written.
  }

  const after = await readPool();
  return NextResponse.json({
    success: true,
    checked: rows.length,
    states,
    providers: after.rows ? deskOf(after.rows) : [],
  });
}
