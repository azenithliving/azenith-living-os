import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AdminLayoutClient from "./layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const cookieStore = await cookies();

  // التحقق من المصادقة
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/admin-gate/login");
  }

  // التحقق من حالة 2FA للمستخدم
  const { data: user2FA } = await supabase
    .from("user_2fa")
    .select("is_enabled")
    .eq("user_id", user.id)
    .single();

  // إذا كان 2FA مفعلًا، تحقق مما إذا كان المستخدم قد تم التحقق منه في هذه الجلسة
  if (user2FA?.is_enabled) {
    const verified2FA = cookieStore.get("admin_2fa_verified")?.value;

    if (verified2FA !== "true") {
      // المستخدم لم يتم التحقق من 2FA، قم بإعادة توجيهه إلى صفحة التحقق
      redirect("/admin/verify-2fa");
    }
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
