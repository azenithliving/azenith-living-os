import { NextResponse } from "next/server";

import { requireAdminApi } from "@/lib/admin-api-guard";

/**
 * Retired: recursive optimization previously made unreviewed changes through
 * a side-channel.  Explicit reviewed decisions remain under /decision.
 */
export async function POST() {
  const { unauthorized } = await requireAdminApi();
  if (unauthorized) return unauthorized;

  return NextResponse.json(
    { success: false, error: "The unreviewed recursive-optimization endpoint has been retired." },
    { status: 410 },
  );
}

