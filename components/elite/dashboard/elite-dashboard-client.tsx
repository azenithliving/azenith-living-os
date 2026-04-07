"use client";

/**
 * ELITE DASHBOARD CLIENT
 * Client-side dashboard interface
 * 
 * CLASSIFICATION: ISOLATE
 * Elite-specific dashboard with project management UI
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { EliteHeader } from "@/components/elite/layout/elite-header";
import { 
  LayoutDashboard, 
  Clock, 
  CreditCard, 
  FileText, 
  Calendar, 
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ChevronLeft,
  ExternalLink,
  LogOut
} from "lucide-react";
import type { ClientAccessDetails, PermissionSet } from "@/lib/elite/access-control";
import type { ProjectInsight, BehaviorState } from "@/lib/elite/feature-engine";

interface DashboardData {
  access: ClientAccessDetails;
  permissions: PermissionSet;
  project: Record<string, unknown> | null;
  payments: Record<string, unknown>[];
  insight: ProjectInsight;
  behavior: BehaviorState;
}

interface EliteDashboardClientProps {
  data: DashboardData;
  activeTab: string;
  onLogout: () => Promise<void>;
}

const tabs = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "progress", label: "تقدم المشروع", icon: Clock },
  { id: "payments", label: "المدفوعات", icon: CreditCard },
  { id: "documents", label: "المستندات", icon: FileText },
  { id: "meetings", label: "الاجتماعات", icon: Calendar },
  { id: "support", label: "الدعم", icon: HelpCircle },
];

export function EliteDashboardClient({ data, activeTab, onLogout }: EliteDashboardClientProps) {
  const [currentTab, setCurrentTab] = useState(activeTab);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await onLogout();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "pending":
      case "upcoming":
        return <Clock3 className="h-5 w-5 text-amber-500" />;
      case "overdue":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-white/40" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "paid":
        return "bg-green-500/10 text-green-400 border-green-500/30";
      case "pending":
      case "upcoming":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "overdue":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      default:
        return "bg-white/5 text-white/60 border-white/10";
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Header */}
      <EliteHeader showUserMenu userName={data.access.phone} onLogout={handleLogout} />

      <div className="pt-24 pb-12 px-6" dir="rtl">
        <div className="max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-serif text-white font-bold mb-2">
              مركز المشروع
            </h1>
            <p className="text-white/60">
              تابع تقدم مشروعك، المدفوعات، وجميع التفاصيل في مكان واحد
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="sticky top-28 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;
                  const isDisabled = 
                    (tab.id === "payments" && !data.permissions.canMakePayments) ||
                    (tab.id === "documents" && !data.permissions.canAccessDocuments) ||
                    (tab.id === "meetings" && !data.permissions.canScheduleMeetings) ||
                    (tab.id === "progress" && !data.permissions.canViewProgress);

                  return (
                    <button
                      key={tab.id}
                      onClick={() => !isDisabled && setCurrentTab(tab.id)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-right ${
                        isActive
                          ? "bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30"
                          : isDisabled
                          ? "opacity-40 cursor-not-allowed"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}

                {/* Logout Button */}
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all text-right mt-4"
                >
                  <LogOut className="h-5 w-5" />
                  <span>{isLoggingOut ? "جاري الخروج..." : "تسجيل الخروج"}</span>
                </button>
              </div>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3">
              <AnimatePresence mode="wait">
                {currentTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    {/* Status Cards */}
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Project Status */}
                      <div className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-white/60 text-sm">حالة المشروع</span>
                          {getStatusIcon(data.insight.status)}
                        </div>
                        <div className="text-2xl font-bold text-white capitalize mb-1">
                          {data.insight.status === "pending" && "قيد الانتظار"}
                          {data.insight.status === "design" && "التصميم"}
                          {data.insight.status === "approval" && "الموافقة"}
                          {data.insight.status === "production" && "التصنيع"}
                          {data.insight.status === "installation" && "التركيب"}
                          {data.insight.status === "completed" && "مكتمل"}
                          {data.insight.status === "on_hold" && "متوقف"}
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                          <div
                            className="bg-gradient-to-r from-[#C5A059] to-[#E5C170] h-2 rounded-full transition-all"
                            style={{ width: `${data.insight.progressPercentage}%` }}
                          />
                        </div>
                        <p className="text-white/40 text-sm mt-2">
                          {data.insight.progressPercentage}% مكتمل
                        </p>
                      </div>

                      {/* Payment Status */}
                      <div className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-white/60 text-sm">حالة الدفع</span>
                          {getStatusIcon(data.insight.paymentStatus)}
                        </div>
                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm border ${getStatusColor(data.insight.paymentStatus)}`}>
                          {data.insight.paymentStatus === "no_payment_due" && "لا يوجد دفعة مستحقة"}
                          {data.insight.paymentStatus === "upcoming" && "دفعة قادمة"}
                          {data.insight.paymentStatus === "due_soon" && "دفعة قريباً"}
                          {data.insight.paymentStatus === "overdue" && "دفعة متأخرة"}
                          {data.insight.paymentStatus === "paid" && "تم السداد"}
                        </div>
                        {data.insight.daysUntilPayment !== null && (
                          <p className="text-white/40 text-sm mt-3">
                            {data.insight.daysUntilPayment} أيام متبقية
                          </p>
                        )}
                      </div>

                      {/* Next Milestone */}
                      <div className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-white/60 text-sm">المرحلة القادمة</span>
                          <Clock className="h-5 w-5 text-[#C5A059]" />
                        </div>
                        <div className="text-lg font-bold text-white mb-2">
                          {data.insight.nextMilestone || "غير محدد"}
                        </div>
                        {data.insight.estimatedCompletion && (
                          <p className="text-white/40 text-sm">
                            متوقع: {new Date(data.insight.estimatedCompletion).toLocaleDateString("ar-EG")}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Alert Messages */}
                    {data.behavior.alertMessage && (
                      <div className={`p-4 rounded-xl border ${
                        data.behavior.showUrgency 
                          ? "bg-red-500/10 border-red-500/30" 
                          : "bg-amber-500/10 border-amber-500/30"
                      }`}>
                        <div className="flex items-center gap-3">
                          <AlertCircle className={`h-5 w-5 ${
                            data.behavior.showUrgency ? "text-red-400" : "text-amber-400"
                          }`} />
                          <p className={data.behavior.showUrgency ? "text-red-200" : "text-amber-200"}>
                            {data.behavior.alertMessage}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {data.permissions.canViewProgress && (
                        <button
                          onClick={() => setCurrentTab("progress")}
                          className="group flex items-center justify-between p-6 bg-[#1A1A1B] border border-white/10 rounded-2xl hover:border-[#C5A059]/30 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                              <Clock className="h-6 w-6 text-[#C5A059]" />
                            </div>
                            <div className="text-right">
                              <h3 className="text-white font-bold group-hover:text-[#C5A059] transition-colors">
                                متابعة التقدم
                              </h3>
                              <p className="text-white/40 text-sm">تفاصيل مراحل المشروع</p>
                            </div>
                          </div>
                          <ChevronLeft className="h-5 w-5 text-white/40 group-hover:text-[#C5A059] transition-colors" />
                        </button>
                      )}

                      {data.permissions.canMakePayments && (
                        <button
                          onClick={() => setCurrentTab("payments")}
                          className="group flex items-center justify-between p-6 bg-[#1A1A1B] border border-white/10 rounded-2xl hover:border-[#C5A059]/30 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                              <CreditCard className="h-6 w-6 text-[#C5A059]" />
                            </div>
                            <div className="text-right">
                              <h3 className="text-white font-bold group-hover:text-[#C5A059] transition-colors">
                                المدفوعات
                              </h3>
                              <p className="text-white/40 text-sm">سداد الدفعات والفواتير</p>
                            </div>
                          </div>
                          <ChevronLeft className="h-5 w-5 text-white/40 group-hover:text-[#C5A059] transition-colors" />
                        </button>
                      )}

                      {data.permissions.canScheduleMeetings && (
                        <button
                          onClick={() => setCurrentTab("meetings")}
                          className="group flex items-center justify-between p-6 bg-[#1A1A1B] border border-white/10 rounded-2xl hover:border-[#C5A059]/30 transition-all"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                              <Calendar className="h-6 w-6 text-[#C5A059]" />
                            </div>
                            <div className="text-right">
                              <h3 className="text-white font-bold group-hover:text-[#C5A059] transition-colors">
                                جدولة اجتماع
                              </h3>
                              <p className="text-white/40 text-sm">حجز موعد مع فريقك</p>
                            </div>
                          </div>
                          <ChevronLeft className="h-5 w-5 text-white/40 group-hover:text-[#C5A059] transition-colors" />
                        </button>
                      )}

                      <Link
                        href="/contact"
                        className="group flex items-center justify-between p-6 bg-[#1A1A1B] border border-white/10 rounded-2xl hover:border-[#C5A059]/30 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                            <HelpCircle className="h-6 w-6 text-[#C5A059]" />
                          </div>
                          <div className="text-right">
                            <h3 className="text-white font-bold group-hover:text-[#C5A059] transition-colors">
                              الدعم
                            </h3>
                            <p className="text-white/40 text-sm">تواصل معنا للمساعدة</p>
                          </div>
                        </div>
                        <ExternalLink className="h-5 w-5 text-white/40 group-hover:text-[#C5A059] transition-colors" />
                      </Link>
                    </div>
                  </motion.div>
                )}

                {currentTab === "progress" && (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-8"
                  >
                    <h2 className="text-2xl font-bold text-white mb-6">تقدم المشروع</h2>
                    
                    {/* Progress Timeline */}
                    <div className="space-y-6">
                      {[
                        { id: "pending", label: "استلام الطلب", desc: "تم استلام طلبك بنجاح" },
                        { id: "design", label: "مرحلة التصميم", desc: "فريق التصميم يعمل على مخططاتك" },
                        { id: "approval", label: "الموافقة", desc: "مراجعة التصاميم معك" },
                        { id: "production", label: "التصنيع", desc: "بدء عملية التصنيع" },
                        { id: "installation", label: "التركيب", desc: "تركيب الأثاث في موقعك" },
                        { id: "completed", label: "الانتهاء", desc: "المشروع مكتمل" },
                      ].map((stage, index) => {
                        const isCompleted = data.insight.progressPercentage >= (index * 20);
                        const isCurrent = data.insight.status === stage.id;
                        
                        return (
                          <div key={stage.id} className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCompleted 
                                ? "bg-green-500/20 text-green-500" 
                                : isCurrent 
                                  ? "bg-[#C5A059]/20 text-[#C5A059]"
                                  : "bg-white/10 text-white/40"
                            }`}>
                              {isCompleted ? (
                                <CheckCircle2 className="h-5 w-5" />
                              ) : (
                                <span className="text-sm">{index + 1}</span>
                              )}
                            </div>
                            <div className="flex-1 pb-6 border-b border-white/5 last:border-0">
                              <h3 className={`font-bold ${isCurrent ? "text-[#C5A059]" : "text-white"}`}>
                                {stage.label}
                              </h3>
                              <p className="text-white/50 text-sm mt-1">{stage.desc}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {currentTab === "payments" && (
                  <motion.div
                    key="payments"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-8">
                      <h2 className="text-2xl font-bold text-white mb-6">المدفوعات</h2>
                      
                      {data.payments.length === 0 ? (
                        <div className="text-center py-12">
                          <CreditCard className="h-12 w-12 text-white/20 mx-auto mb-4" />
                          <p className="text-white/40">لا توجد مدفوعات مسجلة</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {data.payments.map((payment: Record<string, unknown>) => (
                            <div 
                              key={payment.id as string}
                              className="flex items-center justify-between p-4 bg-white/5 rounded-xl"
                            >
                              <div className="flex items-center gap-4">
                                {getStatusIcon(payment.status as string)}
                                <div>
                                  <p className="text-white font-medium">
                                    دفعة #{payment.id?.toString().slice(-4)}
                                  </p>
                                  <p className="text-white/40 text-sm">
                                    {new Date(payment.created_at as string).toLocaleDateString("ar-EG")}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-white font-bold">
                                  {(payment.amount as number).toLocaleString()} ج.م
                                </p>
                                <span className={`inline-block px-2 py-1 rounded text-xs ${getStatusColor(payment.status as string)}`}>
                                  {payment.status === "pending" && "معلقة"}
                                  {payment.status === "paid" && "تم السداد"}
                                  {payment.status === "failed" && "فاشلة"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {currentTab === "documents" && (
                  <motion.div
                    key="documents"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-8"
                  >
                    <h2 className="text-2xl font-bold text-white mb-6">المستندات</h2>
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/40">المستندات ستكون متاحة قريباً</p>
                    </div>
                  </motion.div>
                )}

                {currentTab === "meetings" && (
                  <motion.div
                    key="meetings"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-8"
                  >
                    <h2 className="text-2xl font-bold text-white mb-6">الاجتماعات</h2>
                    <div className="text-center py-12">
                      <Calendar className="h-12 w-12 text-white/20 mx-auto mb-4" />
                      <p className="text-white/40 mb-4">لا توجد اجتماعات مجدولة</p>
                      <button className="px-6 py-3 bg-[#C5A059] text-black rounded-xl font-medium hover:bg-[#E5C170] transition-colors">
                        جدولة اجتماع جديد
                      </button>
                    </div>
                  </motion.div>
                )}

                {currentTab === "support" && (
                  <motion.div
                    key="support"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-[#1A1A1B] border border-white/10 rounded-2xl p-8"
                  >
                    <h2 className="text-2xl font-bold text-white mb-6">الدعم</h2>
                    <div className="space-y-4">
                      <Link 
                        href="/contact"
                        className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <HelpCircle className="h-6 w-6 text-[#C5A059]" />
                          <div>
                            <p className="text-white font-medium">تواصل معنا</p>
                            <p className="text-white/40 text-sm">نحن هنا للمساعدة</p>
                          </div>
                        </div>
                        <ChevronLeft className="h-5 w-5 text-white/40" />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
