/**
 * The store's own Arabic voice, served from our own address.
 *
 * Measured on the owner's phone 2026-10-06: the system text-to-speech settings show Google as the
 * engine and العربية as its language, and Arabic voice data installed — yet the browser handed the
 * page 122 voices with none of them Arabic, so nothing was read. A capability that depends on what
 * one browser chooses to expose is not a capability, so the spoken brief now has a second source:
 * audio the store makes and serves from its own origin.
 *
 * $0, no key, no card — the same public voice Google serves its own translator page with. The door
 * sits under `/api/admin`, so the gate in `proxy.ts` is what lets him through it, and the text is
 * shaped by the same function the browser voice uses: no vowel marks, digits the engine can say.
 */
import { NextRequest, NextResponse } from "next/server";

import { speakableSummary } from "@/lib/ops/voice-continuous";

export const dynamic = "force-dynamic";

/** A spoken brief is short by design; the cap is what stops this door becoming a relay. */
const MAX_CHARS = 700;
const UPSTREAM_TIMEOUT_MS = 8_000;
/** Under this the answer is an error page, not a voice. */
const MIN_AUDIO_BYTES = 512;

function upstreamUrl(text: string): string {
  const query = new URLSearchParams({ ie: "UTF-8", q: text, tl: "ar", client: "tw-ob" });
  return `https://translate.google.com/translate_tts?${query.toString()}`;
}

export async function GET(request: NextRequest) {
  const raw = new URL(request.url).searchParams.get("text") ?? "";
  const text = speakableSummary(raw, MAX_CHARS);

  if (!text.trim()) {
    return NextResponse.json({ success: false, error: "مفيش كلام يُنطق" }, { status: 400 });
  }

  try {
    const upstream = await fetch(upstreamUrl(text), {
      headers: {
        "user-agent": "Mozilla/5.0",
        referer: "https://translate.google.com/",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: "no-store",
    });

    const bytes = await upstream.arrayBuffer();

    if (!upstream.ok || bytes.byteLength < MIN_AUDIO_BYTES) {
      console.warn(`[Speech] the voice service answered ${upstream.status} with ${bytes.byteLength} bytes`);
      return NextResponse.json({ success: false, error: "خدمة الصوت ما رجعتش حاجة تُسمع" }, { status: 502 });
    }

    return new NextResponse(bytes, {
      headers: {
        "content-type": "audio/mpeg",
        "content-length": String(bytes.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.warn("[Speech] the voice service did not answer:", error);
    return NextResponse.json({ success: false, error: "خدمة الصوت ما ردتش" }, { status: 502 });
  }
}
