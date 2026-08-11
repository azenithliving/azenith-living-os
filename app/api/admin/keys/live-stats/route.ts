/**
 * GET /api/admin/keys/live-stats
 * يقرأ مباشرة من الذاكرة - الأرقام الحقيقية اللي الـ server شغال بيها فعلاً
 * نفس مصدر "مراقبة الأحواض" بالظبط
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllLiveStats } from "@/lib/api-keys-service";

export async function GET(request: NextRequest) {
  try {
    const liveStats = await getAllLiveStats();

    // حساب إجماليات كلية
    let totalLive = 0;
    let totalActive = 0;
    let totalCooldown = 0;
    let totalDead = 0;
    let totalRequests = 0;

    for (const stats of Object.values(liveStats)) {
      totalLive += stats.live_total;
      totalActive += stats.live_active;
      totalCooldown += stats.live_cooldown;
      totalDead += stats.live_dead;
      totalRequests += stats.live_requests;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        total_loaded: totalLive,
        total_active: totalActive,
        total_cooldown: totalCooldown,
        total_dead: totalDead,
        total_requests: totalRequests,
      },
      byProvider: liveStats,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get live stats" },
      { status: 500 }
    );
  }
}
