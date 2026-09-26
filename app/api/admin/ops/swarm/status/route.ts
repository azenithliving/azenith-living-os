/**
 * GET /api/admin/ops/swarm/status
 * مراقبة السرب الداخلية — 7 وكلاء خفيين + القائد
 * تُستدعى فقط داخل /admin/v2/qayyim
 */

import { NextRequest, NextResponse } from "next/server";
import { qayyimFacade } from "@/lib/ops/facade/QayyimFacade";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("company_id");
    const status = await qayyimFacade.getSwarmStatus(companyId);
    return NextResponse.json({ success: true, ...status, timestamp: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const status = await qayyimFacade.getSwarmStatus(body.company_id);
    return NextResponse.json({ success: true, ...status, timestamp: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
