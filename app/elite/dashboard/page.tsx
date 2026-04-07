/**
 * ELITE DASHBOARD PAGE
 * Client project center for Elite users
 * 
 * CLASSIFICATION: ISOLATE
 * Elite-specific dashboard - main project management interface
 */

import { redirect } from "next/navigation";
import { getEliteSession } from "@/lib/elite/auth";
import { getEliteDashboardData } from "@/app/elite/actions/elite-actions";
import { EliteDashboardClient } from "@/components/elite/dashboard/elite-dashboard-client";

interface DashboardPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function EliteDashboardPage({ searchParams }: DashboardPageProps) {
  // Check authentication
  const session = await getEliteSession();
  
  if (!session) {
    redirect("/elite/login");
  }
  
  // Load dashboard data
  const data = await getEliteDashboardData(session.clientAccessId);
  const params = await searchParams;
  
  return (
    <EliteDashboardClient 
      data={data} 
      activeTab={params.tab || "overview"}
      onLogout={async () => {
        "use server";
        const { logoutEliteUser } = await import("@/app/elite/actions/elite-actions");
        await logoutEliteUser();
      }}
    />
  );
}
