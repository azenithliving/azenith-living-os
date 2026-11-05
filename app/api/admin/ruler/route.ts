/**
 * /api/admin/ruler — the one door that answers «وصلت فين؟».
 *
 * Before this, every agent answered the question from whichever plan file it had read, which is how
 * the owner got four different numbers for one project. The answer now comes from the measured
 * ledgers through `lib/build/ruler-view`, and a source that did not answer is named in `missing`
 * instead of showing up as a zero that looks like an answer.
 *
 * The master list lives outside the repository, so on the hosted build it usually does not answer —
 * the screen then says «ما اتقارش: القائمة الجامعة» rather than inventing a capability count.
 */

import { NextRequest, NextResponse } from "next/server";

import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";
import { loadRulerView } from "@/lib/build/ruler-view";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
  } catch (error) {
    if (error instanceof AdminApiAuthError) {
      return NextResponse.json(
        { success: false, error: "لازم تكون داخل بلوحة التحكم قبل ما المِسطرة تتقرا" },
        { status: error.status },
      );
    }
    throw error;
  }

  const view = loadRulerView({ ledgerDir: "docs/ledger" });
  return NextResponse.json({ success: true, ...view });
}
