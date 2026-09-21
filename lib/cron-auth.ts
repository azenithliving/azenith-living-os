import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function configuredCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? secret : null;
}

function secretsMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length) {
    timingSafeEqual(expectedBuffer, expectedBuffer);
    return false;
  }
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

/**
 * Vercel Cron sends GET with `Authorization: Bearer $CRON_SECRET`.
 * Fail closed when the secret is missing so the job cannot be triggered publicly.
 */
export function assertCronAuthorized(request: NextRequest): NextResponse | null {
  const expected = configuredCronSecret();
  if (!expected) {
    return NextResponse.json(
      {
        success: false,
        configured: false,
        error: "Cron is not configured. Set CRON_SECRET; Vercel Cron will then call this path with that bearer token.",
      },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  if (!secretsMatch(authorization, `Bearer ${expected}`)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
