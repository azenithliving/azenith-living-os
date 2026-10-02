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
import { verifyKey, verifyWrites } from "@/lib/ops/key-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The pool's own verdict column, written by the verifier; `notes` stays provenance. */
const ALIVE = "alive";
const WRITES = "writes";
const UNFUNDED = "unfunded";
const QUOTA = "quota";
const REFUSED = "refused";
const isQuarantined = (note: string | null) => String(note ?? "").startsWith("quarantined");

/**
 * Fold the two questions into one verdict.
 *
 * `null` means nothing was learned — a network that did not answer is not a dead key, and a
 * provider this file has no shape for is not a refusal. Those rows are left exactly as they
 * were, which is the only honest thing to do with an absence of evidence.
 */
function verdictOf(hello: string, write: string | null): string | null {
  if (write === "writes") return WRITES;
  if (write === "unfunded") return UNFUNDED;
  if (write === "quota") return QUOTA;
  if (write === "dead") return REFUSED;
  if (write === "alive") return ALIVE;
  if (hello === "alive") return ALIVE;
  if (hello === "quota") return QUOTA;
  if (hello === "dead") return REFUSED;
  return null;
}

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
 * Two presses live here.
 *
 * `action: "add"` — the owner said he will bring more keys himself, through this screen, so
 * the screen takes one: store it, ask the provider whether it knows the key, then ask the key
 * to write four tokens, and tell him in his language which of the two happened. The key is
 * never echoed back and never logged.
 *
 * Otherwise — verify a bounded batch. `provider` narrows it, `limit` is capped at 25 so one
 * press on a phone cannot turn into a thousand calls to somebody's API.
 */
export async function POST(request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const supabase = getSupabaseAdminClient();
  if (!supabase) return NextResponse.json({ success: false, error: "المتجر غير متصل دلوقتي" }, { status: 503 });

  let body: { provider?: string; limit?: number; action?: string; key?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* an empty press verifies a mixed batch */
  }

  if (body.action === "add") {
    const provider = String(body.provider ?? "").trim().toLowerCase();
    const keyValue = String(body.key ?? "").trim();
    if (!provider || !keyValue) {
      return NextResponse.json({ success: false, error: "اختار المزود اولًا ثم الصق المفتاح" }, { status: 400 });
    }
    const guide = KEY_DESK_PROVIDERS.find((p) => p.id === provider);
    if (!guide) return NextResponse.json({ success: false, error: "المزود ده مش في المكتب" }, { status: 400 });
    if (keyValue.length < 12) {
      return NextResponse.json({ success: false, error: "اللي اتلص ده أقصر من مفتاح" }, { status: 400 });
    }

    const day = new Date().toISOString().slice(0, 10);
    const found = await supabase.from("api_keys").select("id").eq("provider", provider).eq("key", keyValue).maybeSingle();
    let id = found.data?.id as number | undefined;
    let added = false;
    if (!id) {
      const inserted = await supabase
        .from("api_keys")
        .insert({ provider, key: keyValue, is_active: true, notes: `added from the desk ${day}` })
        .select("id")
        .single();
      id = inserted.data?.id as number | undefined;
      added = Boolean(id);
    }
    if (!id) return NextResponse.json({ success: false, error: "السجل رفض الحفظ" }, { status: 500 });

    const hello = await verifyKey(provider, keyValue);
    const write = hello.state === "alive" ? await verifyWrites(provider, keyValue) : { state: hello.state, status: hello.status, ms: 0, note: hello.note, model: null };
    const verdict = verdictOf(hello.state, write.state);

    await supabase
      .from("api_keys")
      .update({
        is_active: verdict === WRITES || verdict === QUOTA || verdict === ALIVE,
        check_state: verdict,
        write_model: write.model ?? null,
        last_checked_at: new Date().toISOString(),
        notes: `added from the desk ${day}`,
        last_error: verdict === WRITES ? null : String(write.note ?? verdict).slice(0, 120),
        error_count: verdict === WRITES ? 0 : 1,
        cooldown_until: verdict === QUOTA ? new Date(Date.now() + 3600e3).toISOString() : null,
      })
      .eq("id", id);

    const after = await readPool();
    return NextResponse.json({
      success: true,
      added,
      provider,
      label: guide.label,
      verdict,
      message:
        verdict === WRITES
          ? `${guide.label}: المفتاح كتب رد فعليًا، واتحط في الدور.`
          : verdict === QUOTA
            ? `${guide.label}: المفتاح سليم بس سقفه خلص دلوقتي — اتحط في الدور الاحتياطي.`
            : verdict === UNFUNDED
              ? `${guide.label}: المزود عرف المفتاح، بس الحساب بلا رصيد — مش هيشتغل.`
              : verdict === ALIVE
                ? `${guide.label}: المزود عرف المفتاح، بس ما قدرناش نسأله يكتب.`
                : `${guide.label}: المزود ما عرفش المفتاح ده.`,
      providers: after.rows ? deskOf(after.rows) : [],
    });
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
    // The hello is only the first question. A key that lists its models and then refuses to
    // write is an account with no credit — and counting it as capacity is the mistake this
    // desk exists to stop making.
    const write = outcome.state === "alive" ? await verifyWrites(row.provider, row.key) : { state: outcome.state, status: outcome.status, ms: 0, note: outcome.note, model: null };
    const verdict = verdictOf(outcome.state, write.state);
    if (!verdict) continue;
    states[verdict] = (states[verdict] ?? 0) + 1;
    const stamp = new Date().toISOString();
    await supabase
      .from("api_keys")
      .update({
        is_active: verdict === WRITES || verdict === QUOTA || verdict === ALIVE,
        check_state: verdict,
        write_model: write.model ?? null,
        last_checked_at: stamp,
        notes: `verified ${stamp.slice(0, 10)}: ${verdict}`,
        last_error: verdict === WRITES ? null : String(write.note ?? verdict).slice(0, 120),
        error_count: verdict === WRITES ? 0 : Number(row.error_count ?? 0) + 1,
        cooldown_until: verdict === QUOTA ? new Date(Date.now() + 3600e3).toISOString() : null,
      })
      .eq("id", row.id);
  }

  const after = await readPool();
  return NextResponse.json({
    success: true,
    checked: rows.length,
    states,
    providers: after.rows ? deskOf(after.rows) : [],
  });
}
