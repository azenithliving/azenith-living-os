/**
 * POST /api/ai/analyze-vision — read a picture a customer uploaded, with the store's own readers.
 *
 * This door is opened by the elite advisor, so it cannot hide behind the admin gate — which is
 * exactly why it needed a ceiling of its own. Measured on the published site the night before it
 * was written: the sensitive doors answer with rate-limit headers, and this one answered 400 with
 * none. An unlimited, unauthenticated door into a model is a stranger spending the owner's keys,
 * and the door used to ask one company by name and print that company's raw error back.
 *
 * Three rules now hold here:
 *  - only a `data:` image the browser already has, never a URL the server would go and fetch
 *    (that is a request into the store's own network with someone else's payload);
 *  - the vision chain answers — google, then anthropic, then openai — not one named model;
 *  - when no reader answers, the reply is the capability's floor in Arabic, and the reason the
 *    provider gave stays in the log where a machine can read it.
 */

import { NextRequest, NextResponse } from "next/server";
import { askVisionAny } from "@/lib/ai-orchestrator";
import { modelFloorLine, modelFailureReason } from "@/lib/ops/capability-tiers";
import { answeredByLabel } from "@/lib/ops/key-desk";

export const dynamic = "force-dynamic";

/** The same ceiling the store's other picture doors carry. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PROMPT_CHARS = 8_000;
const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

const DATA_IMAGE = /^data:(image\/(png|jpe?g|webp|gif));base64,([\s\S]+)$/;

/** A base64 payload decoded just far enough to know its real byte weight. */
function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export async function POST(request: NextRequest) {
  let body: { prompt?: unknown; imageUrl?: unknown; options?: { maxTokens?: unknown } } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "مرفق صورة ومطلوب نص" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : "";
  const image = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!prompt || !image) {
    return NextResponse.json({ success: false, error: "مرفق صورة ومطلوب نص" }, { status: 400 });
  }

  const found = DATA_IMAGE.exec(image);
  if (!found) {
    return NextResponse.json(
      { success: false, error: "الصورة لازم تكون مرفقة مع الطلب، مش رابط يجيبه السيرفر" },
      { status: 400 }
    );
  }

  const [, declaredMime, ext, base64] = found;
  const mime = MIME_BY_EXT[ext] ?? declaredMime;
  if (decodedBytes(base64) > MAX_IMAGE_BYTES) {
    return NextResponse.json({ success: false, error: "حجم الصورة أكبر من المسموح" }, { status: 400 });
  }

  const maxTokens = Math.min(2000, Math.max(120, Number(body.options?.maxTokens ?? 1024) || 1024));
  const result = await askVisionAny(prompt, base64, mime, { maxTokens });

  if (result.success && result.content.trim()) {
    return NextResponse.json({
      success: true,
      content: result.content,
      answered_by: answeredByLabel(result.reader),
    });
  }

  const reason = modelFailureReason(result.error);
  console.error("[AI Vision API] no reader answered:", String(result.error ?? "").slice(0, 200));
  return NextResponse.json(
    { success: false, error: modelFloorLine("image-analysis", reason), answered_by: "ولا قارئ — والوصف ما اخترعوش" },
    { status: 503 }
  );
}
