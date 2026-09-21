import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Diagnostic Groq ping. Previously public and advertised key status.
 */
export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    {
      success: false,
      error: "مسار الاختبار العام أُغلق. افحص مفاتيح الذكاء من لوحة الإدارة المهيأة.",
    },
    { status: 410 },
  );
}
