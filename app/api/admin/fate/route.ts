import { NextRequest, NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";

const RETIRED_MESSAGE = "تم إيقاف أدوات التأثير الوهمية. استخدم مسار المبيعات والمحادثات الفعلي بدلاً منها.";

/**
 * This endpoint used to mutate visitor interfaces with fabricated offers,
 * false social proof, and a forced screen lock. Keep the route explicit for
 * old bookmarks, but never create or reactivate those mutations.
 */
export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    success: true,
    retired: true,
    message: RETIRED_MESSAGE,
    mutations: [],
    sessions: [],
  });
}

export async function POST(_request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ success: false, retired: true, error: RETIRED_MESSAGE }, { status: 410 });
}

export async function PATCH(_request: NextRequest) {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ success: false, retired: true, error: RETIRED_MESSAGE }, { status: 410 });
}
