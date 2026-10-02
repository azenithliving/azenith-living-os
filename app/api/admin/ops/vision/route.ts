import { NextRequest, NextResponse } from "next/server";
import { askVisionAny } from "@/lib/ai-orchestrator";
import { modelFloorLine, modelFailureReason } from "@/lib/ops/capability-tiers";
import { answeredByLabel } from "@/lib/ops/key-desk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // base64 payload cap

/**
 * POST /api/admin/ops/vision  { image: dataURL|string, question?: string }
 * Real vision on the uploaded screenshot (P5-M4) — the gate already holds /api/admin/* behind an
 * admin session or the internal key.
 *
 * It used to ask one company's reader by name and print whatever came back, so a spent ceiling at
 * that one company was the owner's dead end, and the provider's English sentence arrived as his
 * answer. The chain of readers answers now, and a refusal is the capability's floor in Arabic.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = String(body?.image || "");
    const question = String(body?.question || "صف ما في هذه الصورة من عناصر تصميم/محتوى وحدد أي أخطاء بصرية أو لغوية بدقة.");

    const match = raw.match(/^data:(image\/(png|jpeg|webp|gif));base64,([\s\S]+)$/);
    const mime = match ? match[1] : "image/png";
    const base64 = match ? match[3] : raw;

    if (!base64 || base64.length > MAX_IMAGE_BYTES) {
      return NextResponse.json({ success: false, error: "صورة غير صالحة أو أكبر من 4MB" }, { status: 400 });
    }

    const prompt =
      "أنت وكيل التجربة — خبير تجربة المستخدم والهوية البصرية لموقع أزينث ليفينج (أثاث فاخر، مصري، RTL). " +
      "حلّل الصورة المرفقة واقعيًا فقط: لا تختلق عناصر غير موجودة فيها. " +
      `المطلوب: ${question}\n` +
      "أجب بالعربية المصرية في 3-6 نقاط عملية قصيرة.";

    const result = await askVisionAny(prompt, base64, mime);
    if (result.success && result.content.trim()) {
      return NextResponse.json({ success: true, analysis: result.content, answered_by: answeredByLabel(result.reader) });
    }

    console.error("[Ops Vision] no reader answered:", String(result.error ?? "").slice(0, 200));
    return NextResponse.json(
      { success: false, error: modelFloorLine("image-analysis", modelFailureReason(result.error)) },
      { status: 503 }
    );
  } catch (error) {
    console.error("[Qayyim Vision] Error:", error);
    return NextResponse.json({ success: false, error: modelFloorLine("image-analysis", "failed") }, { status: 500 });
  }
}
