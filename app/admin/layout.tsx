import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Check for Supabase session
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  // If no session, redirect to login
  if (authError || !user) {
    redirect("/admin/login");
  }

  return <>{children}</>;
}

