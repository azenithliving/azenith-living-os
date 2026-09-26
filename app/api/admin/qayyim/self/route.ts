/**
 * Qayyim Swarm — the swarm's own self-model, as JSON.
 *
 * GET /api/admin/qayyim/self
 *
 * `lib/qayyim/self-model.ts` is server-only (it reads the service-role DAL), so
 * the command palette and the «اسأل عن نفسك» screen cannot import it — this is
 * the door. Guarded like every other /api/admin route by the session check in
 * the proxy.
 */

import { NextResponse } from "next/server";
import { buildSelfModel, toSelfView } from "@/lib/qayyim/self-model";
import { getCompanyId } from "@/lib/qayyim/api/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const companyId = await getCompanyId();
    const model = await buildSelfModel(companyId || null);
    return NextResponse.json({ success: true, model: toSelfView(model) });
  } catch (error: any) {
    console.error("[Qayyim Self API] GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
