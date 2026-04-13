import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Create next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Skip middleware for API routes and static files
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/_vercel') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // First, handle internationalization
  const intlResponse = intlMiddleware(request);
  
  // If intl middleware returns a redirect, respect it
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  // Then, handle Supabase session
  const { supabaseResponse, user } = await updateSession(request);

  // Check if accessing admin-gate (except login page)
  if (
    pathname.startsWith("/admin-gate") &&
    !pathname.startsWith("/admin-gate/login") &&
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
    url.pathname = "/admin-gate";
    return NextResponse.redirect(url);
  }

  // Important: return the supabaseResponse to ensure cookies are set
  return supabaseResponse;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g., `favicon.ico`)
    '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
    // Keep existing matchers
    "/admin-gate/:path*",
    "/elite/:path*",
  ],
};
