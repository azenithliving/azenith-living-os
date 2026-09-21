/**
 * Manufacturing price calculation.
 *
 * Catalogue markups, labour-hour guesses, and default wood prices are not a
 * quote. Use the BOM calculator, which only prices materials that exist on a
 * design and have an inventory unit cost.
 */

import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-api-guard";

export async function POST() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    {
      success: false,
      error: "لا يُحتسب سعر من جداول افتراضية. استخدم حساب قائمة المواد المرتبط بالمخزون والكميات المسجّلة في التصميم.",
    },
    { status: 410 },
  );
}
