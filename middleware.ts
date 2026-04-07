import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
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
    "/admin-gate/:path*",
  ],
};
