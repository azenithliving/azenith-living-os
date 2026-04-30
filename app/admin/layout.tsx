import { redirect } from "next/navigation";
import AdminLayoutClient from "./layout-client";
import { createClient } from "@/utils/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/gate/login");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}

