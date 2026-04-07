"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const hasSessionCookie = cookieStore
    .getAll()
    .some(({ name }) => name.startsWith("sb-") || name.includes("supabase") || name.includes("auth"));

  if (!hasSessionCookie) {
    redirect("/start?access=dashboard");
  }

  return <>{children}</>;
}

