import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";

async function retired() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    { success: false, error: "The legacy simulated supreme-control API has been retired." },
    { status: 410 },
  );
}

export const GET = retired;
export const POST = retired;

