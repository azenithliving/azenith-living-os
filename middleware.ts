import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import {
  generalRateLimiter,
  sensitiveRateLimiter,
  getClientIP,
  shouldRateLimit,
  isRateLimitingEnabled,
} from "@/lib/rate-limit";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let rateLimitHeaders: Record<string, string> | null = null;
  const isAdminLoginApi = pathname === "/api/admin/verify-2fa";

  // Skip entirely for static files to save execution time
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/static") ||
    pathname.match(/\.(jpeg|jpg|png|gif|svg|ico|css|js|woff|woff2)$/i)
  ) {
    return NextResponse.next();
  }

  // Handle Supabase session for all routes first
  const { supabaseResponse, user } = await updateSession(request);

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

      rateLimitHeaders = {
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      };
    }
  }

  const applyResponseHeaders = (response: NextResponse) => {
    if (!rateLimitHeaders) {
      return response;
    }

    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };

  // Protect admin API routes with the same admin session used by the dashboard.
  if (pathname.startsWith("/api/admin") && !isAdminLoginApi && !user) {
    return applyResponseHeaders(new NextResponse(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    ));
  }

  // Check if accessing admin routes (except login pages)
  if (
    (pathname.startsWith("/admin-gate") || pathname.startsWith("/admin")) &&
    !pathname.startsWith("/admin-gate/login") &&
    !pathname.startsWith("/admin/verify-2fa") &&
    !user
  ) {
    // No user, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/gate/login";
    return applyResponseHeaders(NextResponse.redirect(url));
  }

  // User is logged in, trying to access login page
  if (pathname.startsWith("/admin-gate/login") && user) {
    // Redirect to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return applyResponseHeaders(NextResponse.redirect(url));
  }

  if (pathname.startsWith("/api/admin") && user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-user-id", user.id);

    if (user.email) {
      requestHeaders.set("x-admin-user-email", user.email);
    }

    const forwardedResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      forwardedResponse.cookies.set(cookie);
    });

    return applyResponseHeaders(forwardedResponse);
  }

  // Important: return the supabaseResponse to ensure cookies are set
  return applyResponseHeaders(supabaseResponse);
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
