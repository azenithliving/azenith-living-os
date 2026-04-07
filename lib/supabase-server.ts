import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  try {
    // Log all cookies for debugging
    const allCookies = cookieStore.getAll();
    console.log("[Supabase Server] All cookies:", allCookies.length);
    allCookies.forEach((cookie) => {
      console.log(`  - ${cookie.name}: ${cookie.value.substring(0, 50)}...`);
    });

    // Find auth cookies - Supabase uses sb-<project-ref>-auth-token
    const authCookies = allCookies.filter((c) => c.name.startsWith('sb-'));
    console.log("[Supabase Server] Supabase auth cookies found:", authCookies.length);

    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, {
                  ...options,
                  maxAge: 60 * 60 * 24 * 7, // 7 days
                  sameSite: "lax",
                  secure: process.env.NODE_ENV === "production",
                })
              );
            } catch (error) {
              console.error("[Supabase Server] Error setting cookies:", error);
            }
          },
        },
      },
    );
  } catch (err) {
    console.error("[Supabase Server] Failed to create client:", err);
    throw err;
  }
}
