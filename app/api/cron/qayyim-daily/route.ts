/**
 * Qayyim Daily Proactive Round — HTTP surface.
 * Cron: daily at 7:00 AM UTC
 *
 * The round itself lives in `lib/qayyim/daily-round.ts` so the commander's own
 * turn can use it as a backstop when the platform scheduler stays silent.
 */

import { NextRequest, NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { executeDailyRound } from "@/lib/qayyim/daily-round";

export const maxDuration = 60;

async function handle(request: NextRequest) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  // `?only=` runs one weekly organ on demand (still behind the cron secret):
  // Sunday-only and Monday-only code should be provable today, not next weekend.
  const only = new URL(request.url).searchParams.get("only");
  const step = only === "audit" || only === "canary" ? only : undefined;
  try {
    return NextResponse.json(await executeDailyRound({ only: step }));
  } catch (error: any) {
    console.error("[Qayyim Daily Cron] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
