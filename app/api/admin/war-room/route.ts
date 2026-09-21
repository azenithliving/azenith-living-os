import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Retired: this feed combined simulated market, defense, and optimization
 * metrics with static values, so it could not serve as an operational source.
 */
export async function GET() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    { success: false, error: "The legacy simulated war-room feed has been retired." },
    { status: 410 },
  );
}

