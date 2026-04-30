"use client";

import { Building2, TrendingUp, Users, Mail, Phone, Clock, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon: React.ReactNode;
  color?: "gold" | "blue" | "green" | "purple";
}

export function MetricCard({ title, value, subtitle, trend, icon, color = "gold" }: MetricCardProps) {
  const colorClasses = {
    gold: "border-brand-primary/20 bg-brand-primary/[0.08]",
    blue: "border-blue-500/20 bg-blue-500/[0.08]",
    green: "border-emerald-500/20 bg-emerald-500/[0.08]",
    purple: "border-purple-500/20 bg-purple-500/[0.08]",
  };

  return (
    <div className={`rounded-[2rem] border ${colorClasses[color]} p-6`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-white/50">{title}</p>
          <p className="mt-3 text-4xl font-semibold text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
          {subtitle && <p className="mt-2 text-xs text-white/40">{subtitle}</p>}
          {trend && (
            <div className={`mt-2 flex items-center gap-1 text-sm ${trend.isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {trend.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              <span>{trend.value}%</span>
            </div>
          )}
        </div>
        <div className="rounded-full bg-white/10 p-3 text-white/70">
          {icon}
        </div>
      </div>
    </div>
  );
}

interface TenantTableProps {
  tenants: Array<{
    id: string;
    name: string;
    domain: string;
    whatsapp: string | null;
    leadCount: number;
    requestCount: number;
    bookingCount: number;
    createdAt: string;
  }>;
  onSelectTenant?: (tenantId: string) => void;
  selectedTenantId?: string | null;
}

export function TenantTable({ tenants, onSelectTenant, selectedTenantId }: TenantTableProps) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">الشركات المستأجرة</h2>
          <p className="mt-1 text-sm text-white/60">جميع الشركات النشطة في النظام</p>
        </div>
        <div className="rounded-full bg-brand-primary/10 px-4 py-2 text-sm text-brand-primary">
          {tenants.length} شركة
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-right text-sm text-white/50">
              <th className="pb-4 pr-4">الشركة</th>
              <th className="pb-4">الدومين</th>
              <th className="pb-4">العملاء</th>
              <th className="pb-4">الطلبات</th>
              <th className="pb-4">الحجوزات</th>
              <th className="pb-4">واتساب</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr
                key={tenant.id}
                onClick={() => onSelectTenant?.(tenant.id)}
                className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.02] ${
                  selectedTenantId === tenant.id ? "bg-brand-primary/[0.05]" : ""
                }`}
              >
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{tenant.name}</p>
                      <p className="text-xs text-white/40">
                        {new Date(tenant.createdAt).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="py-4 text-sm text-white/60">{tenant.domain}</td>
                <td className="py-4">
                  <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-400">
                    {tenant.leadCount}
                  </span>
                </td>
                <td className="py-4">
                  <span className="rounded-full bg-purple-500/10 px-3 py-1 text-sm text-purple-400">
                    {tenant.requestCount}
                  </span>
                </td>
                <td className="py-4">
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-400">
                    {tenant.bookingCount}
                  </span>
                </td>
                <td className="py-4">
                  {tenant.whatsapp ? (
                    <a
                      href={`https://wa.me/${tenant.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-4 w-4" />
                      {tenant.whatsapp}
                    </a>
                  ) : (
                    <span className="text-sm text-white/30">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ActivityFeedProps {
  activities: Array<{
    id: string;
    type: "lead" | "request" | "booking" | "subscriber";
    tenantName: string;
    description: string;
    timestamp: string;
  }>;
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const typeConfig = {
    lead: { icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
    request: { icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-500/10" },
    booking: { icon: Clock, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    subscriber: { icon: Mail, color: "text-amber-400", bg: "bg-amber-500/10" },
  };

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-2xl font-semibold text-white">آخر النشاطات</h2>
      <p className="mt-1 text-sm text-white/60">التحديثات الأخيرة عبر جميع الشركات</p>

      <div className="mt-6 space-y-4">
        {activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/40">لا توجد نشاطات حديثة</p>
        ) : (
          activities.map((activity) => {
            const config = typeConfig[activity.type];
            const Icon = config.icon;

            return (
              <div key={activity.id} className="flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white">{activity.tenantName}</p>
                    <span className="text-xs text-white/40">
                      {new Date(activity.timestamp).toLocaleString("ar-EG", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/60">{activity.description}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface DistributionChartProps {
  title: string;
  data: Array<{ label: string; value: number; color?: string }>;
}

export function DistributionChart({ title, data }: DistributionChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const colors = [
    "bg-brand-primary",
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-amber-500",
  ];

  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
      <h2 className="text-xl font-semibold text-white">{title}</h2>

      <div className="mt-6 space-y-4">
        {data.map((item, index) => {
          const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0;

          return (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-white/70">{item.label}</span>
                <span className="text-white/50">
                  {item.value} ({percentage}%)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${colors[index % colors.length]}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
