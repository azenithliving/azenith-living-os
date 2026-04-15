import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import AdminLayoutClient from "./layout-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check for admin_auth cookie
  const cookieStore = await cookies();
  const adminAuth = cookieStore.get("admin_auth");

  // If no cookie or not "true", redirect to gate login
  if (!adminAuth || adminAuth.value !== "true") {
    redirect("/gate/login");
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}

