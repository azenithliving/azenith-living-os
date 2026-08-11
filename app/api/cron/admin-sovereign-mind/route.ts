import { NextRequest, NextResponse } from "next/server";
import { runSovereignMindCycle } from "@/lib/admin-sovereign-mind";
import { resolveCronSecret, resolveMasterAdminEmails } from "@/lib/admin-env-resolver";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const cronSecret = resolveCronSecret();
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const masterEmails = await resolveMasterAdminEmails();
  const ownerEmail = masterEmails[0] ?? process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim();

  const result = await runSovereignMindCycle({ ownerEmail });

  return NextResponse.json({
    success: true,
    proposalsCreated: result.proposalsCreated,
    thoughts: result.thoughts,
    timestamp: result.timestamp,
  });
}

export async function GET(request: NextRequest) {
  const cronSecret = resolveCronSecret();
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    status: "ready",
    description: "Sovereign Mind — background observe/think/propose with owner approval",
    schedule: "every 6 hours via vercel.json cron",
  });
}
