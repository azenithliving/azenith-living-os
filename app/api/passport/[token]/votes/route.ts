/**
 * The family's vote desk, behind the same secret address as the sheet.
 *
 * GET  /api/passport/<token>/votes — what each picture has collected on this sheet.
 * POST /api/passport/<token>/votes — one tap: { image_key, image_url, voter, liked }.
 *
 * No account and no password: the token in the address is the whole login, exactly like the
 * sheet page itself, and it only ever speaks about the one sheet it was reached by. A voter is
 * a short label they type («أنا»، «مراتي»); the row is keyed by (sheet, picture, voter) so a
 * second tap changes a mind instead of adding a second vote.
 */
import { NextRequest, NextResponse } from "next/server";

import { looksLikePassportToken } from "@/lib/cad/passport";
import { findSketchByToken, readVotes, recordVote, stampPulseSent, tallyVotes, cleanVoter } from "@/lib/cad/family-votes";
import { heatOf, pulseFor, shouldPulse, type HeatSignals } from "@/lib/ops/lead-heat";
import { sendTelegramMessage } from "@/lib/telegram-config";

export const dynamic = "force-dynamic";

/** A sheet is a family, not a crowd; the ceiling is what stops a stranger filling the table. */
const MAX_VOTE_ROWS = 200;

async function resolve(request: NextRequest, token: string) {
  if (!looksLikePassportToken(token)) {
    return { error: NextResponse.json({ success: false, error: "العنوان غير صحيح" }, { status: 400 }) };
  }
  const sketch = await findSketchByToken(token);
  if (!sketch) {
    return { error: NextResponse.json({ success: false, error: "مفيش ورقة بهذا العنوان" }, { status: 404 }) };
  }
  return { sketch };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await resolve(request, token);
  if (found.error) return found.error;

  const rows = await readVotes(found.sketch.id);
  return NextResponse.json({
    success: true,
    tallies: tallyVotes(rows),
    people: [...new Set(rows.map((row) => row.voter))],
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await resolve(request, token);
  if (found.error) return found.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "طلب غير مفهوم" }, { status: 400 });
  }

  const imageKey = String(body?.image_key ?? "").trim().slice(0, 48);
  if (!imageKey) {
    return NextResponse.json({ success: false, error: "مفيش صورة متحددة" }, { status: 400 });
  }

  const rows = await readVotes(found.sketch.id);
  const known = new Set(rows.map((row) => row.voter));
  const voter = cleanVoter(body?.voter);
  if (rows.length >= MAX_VOTE_ROWS && !known.has(voter)) {
    return NextResponse.json({ success: false, error: "ورقة النهارده اكتملت — كلّمنا المتجر" }, { status: 429 });
  }

  const stored = await recordVote({
    sketchId: found.sketch.id,
    imageKey,
    imageUrl: body?.image_url ? String(body.image_url).slice(0, 600) : null,
    voter,
    liked: body?.liked !== false,
  });
  if (!stored) {
    return NextResponse.json({ success: false, error: "المتجر ما سجلش الصوت" }, { status: 500 });
  }

  const fresh = await readVotes(found.sketch.id);
  const voters = new Set(fresh.map((row) => row.voter)).size;

  /**
   * A second voter is proof the sheet left the customer's hands — the architecture's own signal
   * that the golden moment is now. The pulse is arithmetic, not a model, so it fires with zero
   * keys, and it is stamped once so the owner is not trained to ignore the bot.
   */
  const signals: HeatSignals = { voters, hasSketch: found.sketch.hasPlan, returns: 0 };
  if (shouldPulse(signals, found.sketch.pulseSentAt)) {
    const sent = await sendTelegramMessage(
      pulseFor({ room: found.sketch.room, city: found.sketch.city, voters, heat: heatOf(signals) })
    );
    const stamped = sent ? await stampPulseSent(found.sketch.id) : false;
    console.log(
      `[LeadPulse] sheet ${found.sketch.id}: voters ${voters}, heat ${heatOf(signals)}, telegram ${sent}, stamped ${stamped}`
    );
  }

  return NextResponse.json({
    success: true,
    tallies: tallyVotes(fresh),
    people: [...new Set(fresh.map((row) => row.voter))],
  });
}
