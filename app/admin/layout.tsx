import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AdminLayoutClient from "./layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log("[AdminLayout] Starting layout execution");

  try {
    const supabase = await createClient();
    const cookieStore = await cookies();

    console.log("[AdminLayout] Supabase client created, checking auth...");

    // التحقق من المصادقة
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    console.log("[AdminLayout] Auth check result:", { hasUser: !!user, hasError: !!authError });

    // Check if this is the verify-2fa page - allow unauthenticated access for combined login
    const headersList = await import("next/headers").then(m => m.headers());
    const pathname = headersList.get("x-pathname") || "";
    const isVerify2FAPage = pathname.includes("/admin/verify-2fa");

    // Check authentication - redirect to login if not authenticated (except for verify-2fa page)
    if ((authError || !user) && !isVerify2FAPage) {
      console.log("[AdminLayout] Not authenticated, redirecting to login");
      redirect("/admin-gate/login");
    }

    // For verify-2fa page, if not authenticated, render without admin checks
    if ((authError || !user) && isVerify2FAPage) {
      console.log("[AdminLayout] Unauthenticated access to verify-2fa, rendering without layout checks");
      return <>{children}</>;
    }

    console.log("[AdminLayout] User authenticated:", user!.id);

    // التحقق من حالة 2FA للمستخدم
    console.log("[AdminLayout] Checking 2FA status...");
    const { data: user2FA, error: user2FAError } = await supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", user!.id)
      .single();

    if (user2FAError) {
      console.log("[AdminLayout] 2FA check error (might be no record):", user2FAError.message);
    } else {
      console.log("[AdminLayout] 2FA status:", { enabled: user2FA?.is_enabled });
    }

    // Check 2FA status - redirect to verify-2fa if 2FA enabled but not verified
    if (user2FA?.is_enabled) {
      const verified2FA = cookieStore.get("admin_2fa_verified")?.value;
      console.log("[AdminLayout] 2FA cookie value:", verified2FA);

      if (verified2FA !== "true") {
        console.log("[AdminLayout] 2FA not verified, redirecting to verify-2fa");
        redirect("/admin/verify-2fa");
      }
      console.log("[AdminLayout] 2FA verified");
    } else {
      console.log("[AdminLayout] 2FA not enabled for user, allowing access");
    }

    console.log("[AdminLayout] Rendering AdminLayoutClient");
    return <AdminLayoutClient>{children}</AdminLayoutClient>;

  } catch (error) {
    console.error("[AdminLayout] Unexpected error:", error);
    // Re-throw to let Next.js error boundary handle it
    throw error;
  }
}
