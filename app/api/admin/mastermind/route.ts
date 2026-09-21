import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";

async function retired() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    {
      success: false,
      error: "The legacy Mastermind controls have been retired. The read-only dashboard statistics remain available at /api/admin/mastermind/stats.",
    },
    { status: 410 },
  );
}

export const GET = retired;
export const POST = retired;

