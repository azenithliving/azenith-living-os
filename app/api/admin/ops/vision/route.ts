import { NextRequest, NextResponse } from "next/server";
import { askGoogleVision } from "@/lib/ai-orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // base64 payload cap

/**
 * POST /api/admin/ops/vision  { image: dataURL|string, question?: string }
 * Real vision on the uploaded screenshot (P5-M4) — proxy already gates
 * /api/admin/* behind an admin session or x-internal-key.
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
      "أنت 'قيّم الدار' — خبير تجربة المستخدم والهوية البصرية لموقع أزينث ليفينج (أثاث فاخر، مصري، RTL). " +
      "حلّل الصورة المرفقة واقعيًا فقط: لا تختلق عناصر غير موجودة فيها. " +
      `المطلوب: ${question}\n` +
      "أجب بالعربية المصرية في 3-6 نقاط عملية قصيرة.";

    const result = await askGoogleVision(prompt, base64, mime);
    if (!result.success || !result.content) {
      return NextResponse.json({ success: false, error: result.error || "تعذر تحليل الصورة" }, { status: 502 });
    }
    return NextResponse.json({ success: true, analysis: result.content });
  } catch (error: any) {
    console.error("[Qayyim Vision] Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal error" }, { status: 500 });
  }
}
