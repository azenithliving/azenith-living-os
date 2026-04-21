import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import {
  generalRateLimiter,
  sensitiveRateLimiter,
  getClientIP,
  shouldRateLimit,
  isRateLimitingEnabled,
} from "@/lib/rate-limit";

/**
 * SOVEREIGN PROXY ENGINE v1.0
 * Migrated from deprecated middleware to the Next.js 16 Proxy standard.
 * Handles dimensional security, rate limiting, and session persistence.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search, origin } = request.nextUrl;
  const referer = request.headers.get('referer');
  let rateLimitHeaders: Record<string, string> | null = null;
  const isAdminLoginApi = pathname === "/api/admin/verify-2fa";

  // 1. GATEKEEPER LEAK DETECTION (Sovereign Mesh)
  // Catch requests escaping from proxied dimensions (Referer: Mirror API)
  if (referer && referer.includes('/api/omnipotent/mirror') && 
      !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
    
    const refererUrl = new URL(referer);
    let targetUrlParam = refererUrl.searchParams.get('url');
    
    // RECOVERY: If direct URL param is missing from referer, it's a deep leak
    // Extract origin from refererUrl.searchParams.get('url') or guess from history
    if (!targetUrlParam) {
       console.log(`[GATEKEEPER] Deep leak detected: ${pathname} | Attempting Origin Recovery...`);
    }

    if (targetUrlParam) {
      try {
        const targetOrigin = new URL(targetUrlParam).origin;
        const finalTargetUrl = targetOrigin + pathname + search;
        
        // Safety check: Prevent circular loops to localhost
        if (targetOrigin.includes(request.nextUrl.host)) {
           return NextResponse.next();
        }

        const mirrorUrl = new URL('/api/omnipotent/mirror', origin);
        mirrorUrl.searchParams.set('url', finalTargetUrl);
        ['profileId', 'region', 'lang'].forEach(p => {
          const val = refererUrl.searchParams.get(p);
          if (val) mirrorUrl.searchParams.set(p, val);
        });

        console.log(`[GATEKEEPER] Leaked request captured: ${pathname} -> Mirroring to ${targetOrigin}`);
        return NextResponse.rewrite(mirrorUrl);
      } catch (e) {
        console.error(`[PROXY ERROR] Leak Processing Failed:`, e);
      }
    }
  }

  // 2. INTERNAL WHITELIST (Skip for static assets)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/static") ||
    pathname.match(/\.(jpeg|jpg|png|gif|svg|ico|css|js|woff|woff2)$/i)
  ) {
    return NextResponse.next();
  }

  // 3. SESSION & SECURITY
  const { supabaseResponse, user } = await updateSession(request);
  const { shouldLimit, isSensitive } = shouldRateLimit(pathname);

  // Apply rate limiting if enabled
  if (shouldLimit && isRateLimitingEnabled()) {
    const clientIP = getClientIP(request);
    const limiter = isSensitive ? sensitiveRateLimiter : generalRateLimiter;
    if (limiter) {
      const { success, limit, remaining, reset } = await limiter.limit(clientIP);
      if (!success) {
        return new NextResponse(
          JSON.stringify({
            error: "Too Many Requests",
            message: isSensitive ? "Sensitive API rate limit exceeded." : "API rate limit exceeded.",
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
    if (!rateLimitHeaders) return response;
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  };

  // Admin API Protection
  const isGenesisApi = pathname === "/api/admin/eternal/genesis";
  const isLocalhost = request.headers.get("host")?.includes("localhost");

  if (pathname.startsWith("/api/admin") && !isAdminLoginApi && !user && !(isGenesisApi && isLocalhost)) {
    return applyResponseHeaders(new NextResponse(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    ));
  }

  // Admin Dashboard Protection
  if (
    (pathname.startsWith("/admin-gate") || pathname.startsWith("/admin")) &&
    !pathname.startsWith("/admin-gate/login") &&
    !pathname.startsWith("/admin/verify-2fa") &&
    !user
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/gate/login";
    return applyResponseHeaders(NextResponse.redirect(url));
  }

  if (pathname.startsWith("/admin-gate/login") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return applyResponseHeaders(NextResponse.redirect(url));
  }

  if (pathname.startsWith("/api/admin") && user) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-admin-user-id", user.id);
    if (user.email) requestHeaders.set("x-admin-user-email", user.email);

    const forwardedResponse = NextResponse.next({
      request: { headers: requestHeaders },
    });

    supabaseResponse.cookies.getAll().forEach((cookie) => {
      forwardedResponse.cookies.set(cookie);
    });

    return applyResponseHeaders(forwardedResponse);
  }

  return applyResponseHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
