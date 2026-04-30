"use client";

import { useState } from "react";
import { Building2, Users, Mail, Factory, Settings, FileText, LayoutDashboard, Crown } from "lucide-react";
import {
  MetricCard,
  TenantTable,
  ActivityFeed,
  DistributionChart
} from "./master-dashboard-components";

interface MasterControlCenterProps {
  snapshot: {
    totalTenants: number;
    totalLeads: number;
    totalSubscribers: number;
    totalRequests: number;
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
    recentActivity: Array<{
      id: string;
      type: "lead" | "request" | "booking" | "subscriber";
      tenantName: string;
      description: string;
      timestamp: string;
    }>;
    topRoomTypes: Array<{ type: string; count: number }>;
  };
}

const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(" ");

export default function MasterControlCenter({ snapshot }: MasterControlCenterProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "companies" | "content" | "settings">("overview");

  const tabs = [
    { id: "overview" as const, label: "نظرة عامة", icon: LayoutDashboard },
    { id: "companies" as const, label: "الشركات", icon: Building2 },
    { id: "content" as const, label: "المحتوى", icon: FileText },
    { id: "settings" as const, label: "الإعدادات", icon: Settings },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#C5A059] blur-lg opacity-30 rounded-full animate-pulse" />
            <div className="relative p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
              <Crown className="w-6 h-6 text-[#1a1a1a]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">مركز القيادة السيادي</h1>
            <p className="text-white/50 text-sm">لوحة التحكم الموحدة • {new Date().toLocaleDateString('ar-SA')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400 border border-emerald-500/30">
            ● النظام يعمل
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/10 w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-medium",
                activeTab === tab.id
                  ? "bg-[#C5A059] text-[#1a1a1a]"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Metrics Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                title="إجمالي الشركات"
                value={snapshot.totalTenants}
                trend={{ value: 2, isPositive: true }}
                icon={<Building2 className="h-5 w-5" />}
                color="gold"
              />
              <MetricCard
                title="العملاء النشطين"
                value={snapshot.totalLeads}
                trend={{ value: 12, isPositive: true }}
                icon={<Users className="h-5 w-5" />}
                color="blue"
              />
              <MetricCard
                title="مشتركي النشرة"
                value={snapshot.totalSubscribers}
                trend={{ value: 5, isPositive: true }}
                icon={<Mail className="h-5 w-5" />}
                color="purple"
              />
              <MetricCard
                title="إجمالي الطلبات"
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
                    <h3 className="text-lg font-medium text-white">نظرة عامة على الشركات</h3>
                    <button 
                      onClick={() => setActiveTab("companies")}
                      className="text-sm text-[#C5A059] hover:underline"
                    >
                      عرض الكل
                    </button>
                  </div>
                  <TenantTable tenants={snapshot.tenants.slice(0, 5)} />
                </div>

                {/* Factory Pipeline Preview */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">خط إنتاج المصنع</h3>
                    <span className="text-sm text-[#C5A059]">Kanban غير متوفر</span>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center text-sm">
                    {["التصميم", "النجارة", "التنجيد", "الجودة", "التوصيل"].map((stage) => (
                      <div key={stage} className="rounded-xl border border-white/10 bg-white/5 p-3">
                        <div className="text-2xl font-semibold text-[#C5A059]">0</div>
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
                  <h3 className="mb-4 text-lg font-medium text-white">آخر النشاطات</h3>
                  <ActivityFeed activities={snapshot.recentActivity.slice(0, 5)} />
                </div>

                {/* Lead Distribution */}
                <DistributionChart 
                  title="توزيع العملاء" 
                  data={snapshot.topRoomTypes.map(t => ({ 
                    label: t.type, 
                    value: t.count 
                  }))} 
                />

                {/* Quick Actions */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <h3 className="mb-4 text-lg font-medium text-white">إجراءات سريعة</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveTab("content")}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white transition hover:border-[#C5A059] hover:bg-white/10 text-right"
                    >
                      <span className="text-[#C5A059]">📝</span>
                      محرر المحتوى المرئي
                    </button>
                    <button
                      onClick={() => setActiveTab("settings")}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white transition hover:border-[#C5A059] hover:bg-white/10 text-right"
                    >
                      <span className="text-[#C5A059]">👥</span>
                      إدارة الفريق والصلاحيات
                    </button>
                    <button
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white transition hover:border-[#C5A059] hover:bg-white/10 text-right"
                    >
                      <span className="text-[#C5A059]">🧠</span>
                      بحيرة الذكاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Companies Tab */}
        {activeTab === "companies" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-medium text-white">إدارة الشركات</h3>
                  <p className="text-sm text-white/50 mt-1">جميع الشركات المستأجرة في النظام</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-[#C5A059] text-[#1a1a1a] rounded-xl text-sm font-medium hover:bg-[#d8b56d] transition">
                    + إضافة شركة
                  </button>
                </div>
              </div>
              <TenantTable tenants={snapshot.tenants} />
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === "content" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-xl font-medium text-white mb-6">إدارة المحتوى</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  { title: "الصفحات", count: 12, icon: "📄" },
                  { title: "المقالات", count: 24, icon: "📝" },
                  { title: "الصور", count: 156, icon: "🖼️" },
                  { title: "الفيديوهات", count: 8, icon: "🎬" },
                  { title: "النماذج", count: 5, icon: "📋" },
                  { title: "التصنيفات", count: 18, icon: "🏷️" },
                ].map((item) => (
                  <div key={item.title} className="rounded-xl border border-white/10 bg-white/5 p-4 hover:border-[#C5A059]/50 transition cursor-pointer">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{item.icon}</span>
                      <span className="text-2xl font-bold text-white">{item.count}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/70">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <h3 className="text-xl font-medium text-white mb-6">الإعدادات العامة</h3>
              <div className="space-y-4">
                {[
                  { title: "إعدادات النظام", desc: "الإعدادات الأساسية للمنصة", icon: "⚙️" },
                  { title: "الأمان", desc: "إعدادات الأمان والحماية", icon: "🔒" },
                  { title: "التكاملات", desc: "ربط مع الخدمات الخارجية", icon: "🔗" },
                  { title: "الإشعارات", desc: "إدارة الإشعارات والتنبيهات", icon: "🔔" },
                  { title: "النسخ الاحتياطي", desc: "إدارة النسخ الاحتياطي", icon: "💾" },
                ].map((setting) => (
                  <div key={setting.title} className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/5 hover:border-[#C5A059]/30 transition cursor-pointer">
                    <span className="text-2xl">{setting.icon}</span>
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{setting.title}</h4>
                      <p className="text-sm text-white/50">{setting.desc}</p>
                    </div>
                    <span className="text-white/30">←</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
