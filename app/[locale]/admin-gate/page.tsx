import { redirect } from "next/navigation";
import { Building2, Users, Mail, Factory } from "lucide-react";

import { createClient } from "@/utils/supabase/server";
import { isMasterAdmin } from "@/lib/admin";
import { getMasterDashboardSnapshot } from "@/lib/admin-data";
import {
  MetricCard,
  TenantTable,
  ActivityFeed,
  DistributionChart
} from "@/components/admin/master-dashboard-components";

export default async function AdminGateDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await isMasterAdmin();

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
        <h2 className="text-xl font-semibold text-red-200">Access Denied</h2>
        <p className="mt-2 text-white/60">
          Only authorized master admins can access this portal.
        </p>
      </div>
    );
  }

  const snapshot = await getMasterDashboardSnapshot();

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Sovereign Command Center</h1>
            <p className="text-white/50">Master Admin Dashboard • {new Date().toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
              ● System Operational
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Tenants"
            value={snapshot.totalTenants}
            trend={{ value: 2, isPositive: true }}
            icon={<Building2 className="h-5 w-5" />}
            color="gold"
          />
          <MetricCard
            title="Active Leads"
            value={snapshot.totalLeads}
            trend={{ value: 12, isPositive: true }}
            icon={<Users className="h-5 w-5" />}
            color="blue"
          />
          <MetricCard
            title="Newsletter Subscribers"
            value={snapshot.totalSubscribers}
            trend={{ value: 5, isPositive: true }}
            icon={<Mail className="h-5 w-5" />}
            color="purple"
          />
          <MetricCard
            title="Total Requests"
            value={snapshot.totalRequests}
            trend={{ value: 8, isPositive: true }}
            icon={<Factory className="h-5 w-5" />}
            color="green"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Tenants Table */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Tenant Overview</h3>
                <button className="text-sm text-brand-primary hover:underline">
                  View All
                </button>
              </div>
              <TenantTable tenants={snapshot.tenants} />
            </div>

            {/* Factory Pipeline Preview */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Factory Pipeline</h3>
                <a 
                  href="/admin-gate/factory" 
                  className="text-sm text-brand-primary hover:underline"
                >
                  Open Kanban
                </a>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                {["Design", "Carpentry", "Upholstery", "QC", "Delivery"].map((stage) => (
                  <div key={stage} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-2xl font-semibold text-brand-primary">
                      0
                    </div>
                    <div className="text-xs text-white/50">{stage}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Activity */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="mb-4 text-lg font-medium text-white">Recent Activity</h3>
              <ActivityFeed activities={snapshot.recentActivity.slice(0, 5)} />
            </div>

            {/* Lead Distribution */}
            <DistributionChart 
              title="Lead Distribution" 
              data={snapshot.topRoomTypes.map(t => ({ 
                label: t.type, 
                value: t.count 
              }))} 
            />

            {/* Quick Actions */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="mb-4 text-lg font-medium text-white">Quick Actions</h3>
              <div className="space-y-2">
                <a
                  href="/admin-gate/cms"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white transition hover:border-brand-primary hover:bg-white/10"
                >
                  <span className="text-brand-primary">📝</span>
                  Visual CMS Editor
                </a>
                <a
                  href="/admin-gate/team"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white transition hover:border-brand-primary hover:bg-white/10"
                >
                  <span className="text-brand-primary">👥</span>
                  Manage Team & RBAC
                </a>
                <a
                  href="/admin-gate/intelligence"
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white transition hover:border-brand-primary hover:bg-white/10"
                >
                  <span className="text-brand-primary">🧠</span>
                  Intelligence Lake
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

