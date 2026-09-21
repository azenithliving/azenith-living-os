import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Open web-search probe. Previously public and executed live queries.
 */
export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    {
      success: false,
      error: "مسار البحث التجريبي أُغلق. استخدم أدوات الإدارة المصرّح بها.",
    },
    { status: 410 },
  );
}
