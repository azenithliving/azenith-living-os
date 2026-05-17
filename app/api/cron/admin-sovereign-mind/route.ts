import { NextRequest, NextResponse } from "next/server";
import { runSovereignMindCycle } from "@/lib/admin-sovereign-mind";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerEmail = process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim();

  const result = await runSovereignMindCycle({
    ownerEmail,
  });

  return NextResponse.json({
    success: true,
    proposalsCreated: result.proposalsCreated,
    thoughts: result.thoughts,
    timestamp: result.timestamp,
  });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    status: "ready",
    description: "Sovereign Mind — background observe/think/propose with owner approval",
    schedule: "every 6 hours (configure in vercel.json)",
  });
}
