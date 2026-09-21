import { NextRequest, NextResponse } from "next/server";
import { getAllLiveStats } from "@/lib/api-keys-service";
import { AdminApiAuthError, requireAdminApiAccess } from "@/lib/admin-api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdminApiAccess(request);
    const liveStats = await getAllLiveStats();
    const summary = Object.values(liveStats).reduce((total, stats) => ({ total_loaded: total.total_loaded + stats.live_total, total_active: total.total_active + stats.live_active, total_cooldown: total.total_cooldown + stats.live_cooldown, total_dead: total.total_dead + stats.live_dead, total_requests: total.total_requests + stats.live_requests }), { total_loaded: 0, total_active: 0, total_cooldown: 0, total_dead: 0, total_requests: 0 });
    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), summary, byProvider: liveStats });
  } catch (error) {
    if (error instanceof AdminApiAuthError) return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    return NextResponse.json({ success: false, error: "Failed to get live stats" }, { status: 500 });
  }
}
