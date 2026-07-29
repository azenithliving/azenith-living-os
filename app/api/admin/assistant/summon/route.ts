import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendAdminTelegramSummon, type AdminSummonReason } from "@/lib/admin-telegram-summon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function isAllowed(req: NextRequest) {
  const secret = process.env.ADMIN_ASSISTANT_SUMMON_SECRET;
  const provided = req.headers.get("x-internal-secret") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (secret && provided === secret) return true;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}

export async function POST(req: NextRequest) {
  if (!(await isAllowed(req))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "المساعد الموحد يحتاجك";
  const message =
    typeof body.message === "string"
      ? body.message.trim()
      : "يوجد أمر يحتاج مراجعتك داخل لوحة الأدمن.";
  const href = typeof body.href === "string" ? body.href : "/admin/assistant";
  const reason = typeof body.reason === "string" ? (body.reason as AdminSummonReason) : "needs_owner";

  const result = await sendAdminTelegramSummon({
    title,
    message,
    href,
    reason,
  });

  return NextResponse.json({ success: result.success, result });
}
