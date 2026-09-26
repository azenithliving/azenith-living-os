import { NextRequest, NextResponse } from "next/server";

/**
 * Saved preview links, the swarm's own tool calls and Telegram deep links were
 * all written against `/api/admin/qayyim`. A 308 keeps every one of them
 * working; a 404 would teach the owner that the swarm lost his data.
 *
 * The segment is optional, not a plain catch-all, because the busiest retired
 * path is the facade itself — `/api/admin/qayyim?action=list_drafts` — and
 * `[...legacy]` only matches URLs with at least one segment after it.
 *
 * Removed in P7-M5 once nothing points here anymore.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // The query travels inside the URL object rather than pasted on, so the
  // facade's own path cannot come out the other end with it written twice.
  const target = new URL(request.nextUrl.href);
  target.pathname = target.pathname.replace(/^\/api\/admin\/qayyim/, "/api/admin/ops");
  return NextResponse.redirect(target, 308);
}
export const POST = GET;
export const PATCH = GET;
export const DELETE = GET;
