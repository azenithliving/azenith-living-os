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

    if (authError) {
      console.error("[AdminLayout] Auth error:", authError.message);
      redirect("/admin-gate/login");
    }

    if (!user) {
      console.log("[AdminLayout] No user found, redirecting to login");
      redirect("/admin-gate/login");
    }

    console.log("[AdminLayout] User authenticated:", user.id);

    // التحقق من حالة 2FA للمستخدم
    console.log("[AdminLayout] Checking 2FA status...");
    const { data: user2FA, error: user2FAError } = await supabase
      .from("user_2fa")
      .select("is_enabled")
      .eq("user_id", user.id)
      .single();

    if (user2FAError) {
      console.log("[AdminLayout] 2FA check error (might be no record):", user2FAError.message);
    } else {
      console.log("[AdminLayout] 2FA status:", { enabled: user2FA?.is_enabled });
    }

    // إذا كان 2FA مفعلًا، تحقق مما إذا كان المستخدم قد تم التحقق منه في هذه الجلسة
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
