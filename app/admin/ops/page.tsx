"use client";

import { useState, useEffect } from "react";
import { Bot, FileText, Calendar, CreditCard, Layout, Image, Zap, Plus, Check, X, Trash2, Play, Pause, Settings, Send, Clock, ChevronDown, ChevronUp, ExternalLink, Edit2, Eye } from "lucide-react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// أنواع البيانات
// ═══════════════════════════════════════════════════════════════════════════════
interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: Record<string, unknown>;
  actions: Array<{ type: string; message?: string; intent?: string }>;
  enabled: boolean;
}

interface Booking {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  roomType: string;
  budget: string;
  style: string;
  serviceType: string;
  status: "pending" | "accepted" | "rejected";
  preferredDate: string;
  preferredTime: string;
  notes: string;
  createdAt: string;
}

interface ContentContext {
  roomType: string;
  style: string;
  budget: string;
  brandName: string;
}

interface Page {
  id: string;
  slug: string;
  title: string;
  status: "published" | "draft";
  created_at: string;
}

interface MediaAsset {
  id: string;
  url: string;
  tags: string[];
  source: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب الأتمتة - Automation
// ═══════════════════════════════════════════════════════════════════════════════
function AutomationTab() {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: "booking_accepted_whatsapp",
      name: "إشعار قبول الحجز عبر واتساب",
      trigger: "booking_status_changed",
      conditions: { newStatus: "accepted" },
      actions: [{ type: "send_whatsapp", message: "تم قبول حجزك! سنتواصل معك قريباً لترتيب التفاصيل." }],
      enabled: true,
    },
    {
      id: "booking_rejected_whatsapp",
      name: "إشعار رفض الحجز عبر واتساب",
      trigger: "booking_status_changed",
      conditions: { newStatus: "rejected" },
      actions: [{ type: "send_whatsapp", message: "نعتذر، لم نتمكن من قبول حجزك حالياً. سنتواصل معك لمناقشة البدائل." }],
      enabled: true,
    },
    {
      id: "lead_high_score_intent",
      name: "تحديث نية العميل عالي النتيجة",
      trigger: "lead_updated",
      conditions: { score: { gte: 30 } },
      actions: [{ type: "update_lead_intent", intent: "buyer" }],
      enabled: true,
    },
  ]);

  const toggleRule = (ruleId: string) => {
    setRules(rules.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">نظام الأتمتة</h2>
          <p className="text-sm text-[#C5A059]">قواعد العمل التلقائي</p>
        </div>
        <button className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] flex items-center gap-2">
          <Plus className="w-4 h-4" />
          قاعدة جديدة
        </button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`w-10 h-6 rounded-full transition relative ${rule.enabled ? "bg-[#C5A059]" : "bg-white/20"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${rule.enabled ? "left-5" : "left-1"}`} />
                </button>
                <div>
                  <p className="font-medium text-white">{rule.name}</p>
                  <p className="text-sm text-white/50">المشغل: {rule.trigger}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب المحتوى - Content Generator
// ═══════════════════════════════════════════════════════════════════════════════
function ContentTab() {
  const [contentType, setContentType] = useState<"page_title" | "page_description" | "cta_text" | "product_description">("page_title");
  const [generatedContent, setGeneratedContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [context, setContext] = useState<ContentContext>({
    roomType: "غرفة معيشة",
    style: "حديث",
    budget: "100,000 ريال",
    brandName: "أزينث",
  });

  const generateContent = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/content-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: contentType, context, language: "ar" }),
      });
      const data = await response.json();
      if (data.ok && data.content) {
        setGeneratedContent(data.content);
      }
    } catch (error) {
      console.error("Failed to generate content:", error);
    } finally {
      setGenerating(false);
    }
  };

  const contentTypes = [
    { id: "page_title", label: "عنوان صفحة" },
    { id: "page_description", label: "وصف صفحة" },
    { id: "cta_text", label: "نص دعوة للعمل" },
    { id: "product_description", label: "وصف منتج" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">منشئ المحتوى الذكي</h2>
          <p className="text-sm text-[#C5A059]">AI Content Generator</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="font-medium text-white">تكوين السياق</h3>
          
          <div>
            <label className="block text-sm text-white/60 mb-1">نوع المحتوى</label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as typeof contentType)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            >
              {contentTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">نوع الغرفة</label>
            <input
              value={context.roomType}
              onChange={(e) => setContext({ ...context, roomType: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">الأسلوب</label>
            <input
              value={context.style}
              onChange={(e) => setContext({ ...context, style: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-white/60 mb-1">الميزانية</label>
            <input
              value={context.budget}
              onChange={(e) => setContext({ ...context, budget: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>

          <button
            onClick={generateContent}
            disabled={generating}
            className="w-full rounded-xl bg-[#C5A059] px-4 py-3 text-[#1a1a1a] font-medium hover:bg-[#d8b56d] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-[#1a1a1a] border-t-transparent rounded-full animate-spin" />
                جاري التوليد...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                توليد المحتوى
              </>
            )}
          </button>
        </div>

        {/* Result */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-medium text-white mb-4">المحتوى المولد</h3>
          {generatedContent ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10">
                <p className="text-white whitespace-pre-wrap">{generatedContent}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(generatedContent)}
                  className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
                >
                  نسخ
                </button>
                <button className="flex-1 rounded-lg bg-[#C5A059]/20 px-3 py-2 text-sm text-[#C5A059] hover:bg-[#C5A059]/30">
                  تحسين
                </button>
              </div>
            </div>
          ) : (
            <p className="text-white/40 text-center py-8">المحتوى المولد سيظهر هنا</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب الحجوزات - Bookings
// ═══════════════════════════════════════════════════════════════════════════════
function BookingsTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bookings");
      const data = await response.json();
      if (response.ok && data.bookings) {
        setBookings(data.bookings);
      }
    } catch (error) {
      console.error("Failed to load bookings:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: Booking["status"]) => {
    try {
      await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      loadBookings();
    } catch (error) {
      console.error("Failed to update booking:", error);
    }
  };

  const filteredBookings = filter === "all" ? bookings : bookings.filter(b => b.status === filter);

  const statusColors = {
    pending: "bg-amber-500/20 text-amber-400",
    accepted: "bg-emerald-500/20 text-emerald-400",
    rejected: "bg-rose-500/20 text-rose-400",
  };

  const statusLabels = {
    pending: "معلق",
    accepted: "مقبول",
    rejected: "مرفوض",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">إدارة الحجوزات</h2>
          <p className="text-sm text-[#C5A059]">المواعيد والاستشارات</p>
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm"
          >
            <option value="all">الكل</option>
            <option value="pending">معلق</option>
            <option value="accepted">مقبول</option>
            <option value="rejected">مرفوض</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/60">جاري التحميل...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="p-8 text-center text-white/60">لا توجد حجوزات</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="p-4 hover:bg-white/[0.02]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{booking.fullName}</p>
                    <p className="text-sm text-white/50">{booking.roomType} | {booking.style} | {booking.budget}</p>
                    <p className="text-sm text-white/40 mt-1">
                      {booking.preferredDate} {booking.preferredTime}
                    </p>
                    {booking.notes && (
                      <p className="text-sm text-white/40 mt-1">{booking.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs ${statusColors[booking.status]}`}>
                      {statusLabels[booking.status]}
                    </span>
                    {booking.status === "pending" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => updateStatus(booking.id, "accepted")}
                          className="p-1 rounded text-emerald-400 hover:bg-emerald-500/20"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(booking.id, "rejected")}
                          className="p-1 rounded text-rose-400 hover:bg-rose-500/20"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب الفواتير - Billing
// ═══════════════════════════════════════════════════════════════════════════════
function BillingTab() {
  const [currentPlan, setCurrentPlan] = useState("free");
  const [loading, setLoading] = useState(false);

  const plans = [
    { id: "free", name: "مجاني", price: 0, features: ["صفحة واحدة", "5 حجوزات/شهر", "دعم أساسي"] },
    { id: "starter", name: "البداية", price: 99, features: ["5 صفحات", "50 حجز/شهر", "تحليلات أساسية", "دعم عبر البريد"] },
    { id: "pro", name: "احترافي", price: 299, features: ["صفحات غير محدودة", "حجوزات غير محدودة", "تحليلات متقدمة", "دعم prioritized", "API access"] },
    { id: "enterprise", name: "مؤسسي", price: 999, features: ["كل مميزات Pro", "دعم مخصص", "استضافة مخصصة", "SLA مضمون", "مدير حساب"] },
  ];

  const selectPlan = async (planId: string) => {
    if (planId === "free") {
      setCurrentPlan("free");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await response.json();
      if (data.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error("Failed to initiate checkout:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">الفواتير والخطط</h2>
          <p className="text-sm text-[#C5A059]">إدارة الاشتراك والمدفوعات</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-6 transition ${
              currentPlan === plan.id
                ? "border-[#C5A059] bg-[#C5A059]/10"
                : "border-white/10 bg-white/[0.03] hover:border-white/20"
            }`}
          >
            <h3 className="font-medium text-white">{plan.name}</h3>
            <p className="text-2xl font-bold text-[#C5A059] mt-2">
              {plan.price === 0 ? "مجاني" : `${plan.price} ر.س`}
              {plan.price > 0 && <span className="text-sm text-white/40 font-normal">/شهر</span>}
            </p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-white/60">
                  <Check className="w-4 h-4 text-[#C5A059]" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => selectPlan(plan.id)}
              disabled={loading || currentPlan === plan.id}
              className={`w-full mt-6 rounded-lg py-2 text-sm font-medium transition ${
                currentPlan === plan.id
                  ? "bg-white/20 text-white/60 cursor-default"
                  : "bg-[#C5A059] text-[#1a1a1a] hover:bg-[#d8b56d]"
              }`}
            >
              {currentPlan === plan.id ? "الخطة الحالية" : loading ? "جاري..." : "اختر الخطة"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// القائمة الرئيسية والتبويبات
// ═══════════════════════════════════════════════════════════════════════════════
const tabs = [
  { id: "automation", label: "الأتمتة", icon: Zap, component: AutomationTab },
  { id: "content", label: "المحتوى", icon: FileText, component: ContentTab },
  { id: "bookings", label: "الحجوزات", icon: Calendar, component: BookingsTab },
  { id: "billing", label: "الفواتير", icon: CreditCard, component: BillingTab },
];

export default function OpsCenterPage() {
  const [activeTab, setActiveTab] = useState("automation");
  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component || AutomationTab;

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#C5A059] blur-lg opacity-30 rounded-full" />
            <div className="relative p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
              <Bot className="w-7 h-7 text-[#1a1a1a]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">العمليات والأتمتة</h1>
            <p className="text-white/50">مركز العمليات والأتمتة الذكية</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/30"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
}
