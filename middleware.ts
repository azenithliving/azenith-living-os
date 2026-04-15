import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import {
  generalRateLimiter,
  sensitiveRateLimiter,
  getClientIP,
  shouldRateLimit,
  shouldSkipRateLimit,
  isRateLimitingEnabled,
} from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for static files and non-API routes early
  if (shouldSkipRateLimit(pathname)) {
    // Continue with session handling for non-rate-limited routes
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  // Check if this path needs rate limiting
  const { shouldLimit, isSensitive } = shouldRateLimit(pathname);

  // Apply rate limiting if enabled and path should be limited
  if (shouldLimit && isRateLimitingEnabled()) {
    const clientIP = getClientIP(request);
    const limiter = isSensitive ? sensitiveRateLimiter : generalRateLimiter;

    if (limiter) {
      const { success, limit, remaining, reset } = await limiter.limit(clientIP);

      if (!success) {
        // Rate limit exceeded - return 429 Too Many Requests
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message: isSensitive
              ? "You have exceeded the sensitive API rate limit. Please wait before trying again."
              : "You have exceeded the API rate limit. Please wait before trying again.",
            limit,
            remaining: 0,
            resetAt: new Date(reset).toISOString(),
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Limit": limit.toString(),
              "X-RateLimit-Remaining": remaining.toString(),
              "X-RateLimit-Reset": reset.toString(),
              "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
            },
          }
        );
      }

      // Rate limit passed - add rate limit headers to response
      const { supabaseResponse } = await updateSession(request);
      supabaseResponse.headers.set("X-RateLimit-Limit", limit.toString());
      supabaseResponse.headers.set("X-RateLimit-Remaining", remaining.toString());
      supabaseResponse.headers.set("X-RateLimit-Reset", reset.toString());
      return supabaseResponse;
    }
  }

  // Handle Supabase session for all other routes
  const { supabaseResponse, user } = await updateSession(request);

  // Check if accessing admin routes (except login pages)
  if (
    (pathname.startsWith("/admin-gate") || pathname.startsWith("/admin")) &&
    !pathname.startsWith("/admin-gate/login") &&
    !pathname.startsWith("/admin/verify-2fa") &&
    !user
  ) {
    // No user, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/admin-gate/login";
    return NextResponse.redirect(url);
  }

  // User is logged in, trying to access login page
  if (pathname.startsWith("/admin-gate/login") && user) {
    // Redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  // Important: return the supabaseResponse to ensure cookies are set
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Admin routes
    "/admin-gate/:path*",
    "/admin/:path*",
    "/elite/:path*",
    // Protected API routes - rate limited
    "/api/pexels/:path*",
    "/api/room-sections/:path*",
    "/api/curate-images/:path*",
    "/api/elite-gallery/:path*",
    // Sensitive API routes - stricter rate limits
    "/api/content-generator/:path*",
    "/api/enhance-image/:path*",
    // Catch-all for API routes to ensure middleware runs
    "/api/:path*",
  ],
};
