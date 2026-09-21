import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Retired: this endpoint previously attempted to rewrite application code from
 * a chat prompt.  That behavior was neither reviewable nor safe to expose.
 */
export async function POST() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    {
      success: false,
      error: "The legacy self-modifying tool has been retired. Use the reviewed admin assistant workflow instead.",
    },
    { status: 410 },
  );
}

