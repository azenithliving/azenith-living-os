import { NextRequest, NextResponse } from "next/server";
import { runSovereignMindCycle } from "@/lib/admin-sovereign-mind";
import { resolveMasterAdminEmails } from "@/lib/admin-env-resolver";
import { assertCronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 120;

async function run(request: NextRequest) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;

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
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
