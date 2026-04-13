import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Create next-intl middleware
const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // First, handle internationalization
  const intlResponse = intlMiddleware(request);
  
  // If intl middleware returns a redirect/rewrite, respect it
  if (intlResponse.status !== 200) {
    return intlResponse;
  }

  // Then, handle Supabase session
  const { supabaseResponse, user } = await updateSession(request);

  // Check if accessing admin-gate (except login page)
  if (
    request.nextUrl.pathname.startsWith("/admin-gate") &&
    !request.nextUrl.pathname.startsWith("/admin-gate/login") &&
    !user
  ) {
    // No user, redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/admin-gate/login";
    return NextResponse.redirect(url);
  }

  // User is logged in, trying to access login page
  if (request.nextUrl.pathname.startsWith("/admin-gate/login") && user) {
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
