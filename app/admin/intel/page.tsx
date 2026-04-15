"use client";

import { useState, useEffect, useRef } from "react";
import { Brain, BarChart3, Target, Code, Globe, Palette, Zap, Shield, Server, Activity, TrendingUp, AlertTriangle, CheckCircle, Clock, Search, Sparkles, Send, X, Menu, ChevronRight, ChevronDown, Users } from "lucide-react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// أنواع البيانات
// ═══════════════════════════════════════════════════════════════════════════════
interface WarRoomData {
  swarm: {
    totalNodes: number;
    activeNodes: number;
    collectiveIntelligence: number;
    consensusRate: number;
  };
  defense: {
    systemHealth: "optimal" | "stable" | "degraded" | "under_attack";
    activeThreats: number;
    blockedIPs: number;
    avgLatency: number;
  };
  cache: {
    hitRate: number;
    costSavings: number;
    entries: number;
  };
}

interface AnalyticsMetrics {
  totalLeads: number;
  uniqueVisitors: number;
  totalRequests: number;
  conversionRate: number;
  totalBookings: number;
  acceptedBookings: number;
  averageLeadScore: number;
  whatsappClicks: number;
  topRoomTypes: { type: string; count: number }[];
  topStyles: { style: string; count: number }[];
  eventBreakdown: Record<string, number>;
}

interface ArchitectMessage {
  id: string;
  role: "user" | "architect";
  content: string;
  timestamp: Date;
  codeBlocks?: Array<{ language: string; code: string; path?: string }>;
}

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب غرفة العمليات - War Room
// ═══════════════════════════════════════════════════════════════════════════════
function WarRoomTab() {
  const [data, setData] = useState<WarRoomData>({
    swarm: { totalNodes: 12, activeNodes: 11, collectiveIntelligence: 94, consensusRate: 98 },
    defense: { systemHealth: "optimal", activeThreats: 0, blockedIPs: 127, avgLatency: 45 },
    cache: { hitRate: 96, costSavings: 1240, entries: 15420 },
  });

  const healthColors = {
    optimal: "bg-emerald-500",
    stable: "bg-blue-500",
    degraded: "bg-amber-500",
    under_attack: "bg-rose-500 animate-pulse",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">غرفة العمليات</h2>
          <p className="text-sm text-[#C5A059]">مركز القيادة والمراقبة اللحظية</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${healthColors[data.defense.systemHealth]}`} />
          <span className="text-sm text-white/60">
            {data.defense.systemHealth === "optimal" ? "ممتاز" : 
             data.defense.systemHealth === "stable" ? "مستقر" : 
             data.defense.systemHealth === "degraded" ? "منخفض" : "هجوم"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Zap} title="العقد النشطة" value={`${data.swarm.activeNodes}/${data.swarm.totalNodes}`} subtitle="نظام السرب" color="amber" />
        <MetricCard icon={Brain} title="الذكاء الجماعي" value={`${data.swarm.collectiveIntelligence}%`} subtitle="مستوى الأداء" color="purple" />
        <MetricCard icon={Shield} title="التهديدات" value={data.defense.activeThreats.toString()} subtitle="مهاجمون نشطون" color="emerald" />
        <MetricCard icon={Server} title="الحظر" value={data.defense.blockedIPs.toString()} subtitle="IP محظور" color="blue" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#C5A059]" />
            أداء الكاش
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/60">معدل الإصابة</span>
                <span className="text-white">{data.cache.hitRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-[#C5A059] rounded-full" style={{ width: `${data.cache.hitRate}%` }} />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">التوفير:</span>
              <span className="text-[#C5A059]">${data.cache.costSavings.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">الإدخالات:</span>
              <span className="text-white">{data.cache.entries.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C5A059]" />
            سرعة الاستجابة
          </h3>
          <div className="text-center py-4">
            <p className="text-4xl font-bold text-white">{data.defense.avgLatency}<span className="text-lg text-white/60">ms</span></p>
            <p className="text-sm text-white/50 mt-2">متوسط زمن الاستجابة</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب التحليلات - Analytics
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7days" | "30days" | "90days">("30days");

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?period=${period}`);
      const data = await response.json();
      if (data.ok && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const displayMetrics = metrics || {
    totalLeads: 0, uniqueVisitors: 0, totalRequests: 0, conversionRate: 0,
    totalBookings: 0, acceptedBookings: 0, averageLeadScore: 0, whatsappClicks: 0,
    topRoomTypes: [], topStyles: [], eventBreakdown: {}
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">التحليلات</h2>
          <p className="text-sm text-[#C5A059]">إحصائيات وتحليلات الأداء</p>
        </div>
        <div className="flex gap-2">
          {[
            { id: "7days", label: "7 أيام" },
            { id: "30days", label: "30 يوم" },
            { id: "90days", label: "90 يوم" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as typeof period)}
              className={`px-3 py-1 rounded-lg text-sm transition ${
                period === p.id
                  ? "bg-[#C5A059]/20 text-[#C5A059]"
                  : "text-white/60 hover:bg-white/5"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Users} title="العملاء" value={displayMetrics.totalLeads.toString()} subtitle={`زوار: ${displayMetrics.uniqueVisitors}`} color="blue" />
        <MetricCard icon={BarChart3} title="الطلبات" value={displayMetrics.totalRequests.toString()} subtitle={`تحويل: ${displayMetrics.conversionRate}%`} color="purple" />
        <MetricCard icon={CheckCircle} title="الحجوزات" value={displayMetrics.totalBookings.toString()} subtitle={`مقبول: ${displayMetrics.acceptedBookings}`} color="emerald" />
        <MetricCard icon={TrendingUp} title="متوسط النتيجة" value={displayMetrics.averageLeadScore.toString()} subtitle={`نقرات واتساب: ${displayMetrics.whatsappClicks}`} color="amber" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-medium text-white mb-4">أنواع الغرف الأكثر طلباً</h3>
          {loading ? (
            <p className="text-white/60">جاري التحميل...</p>
          ) : displayMetrics.topRoomTypes?.length > 0 ? (
            <div className="space-y-2">
              {displayMetrics.topRoomTypes.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white/[0.02]">
                  <span className="text-white/70">{item.type}</span>
                  <span className="text-[#C5A059]">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60">لا توجد بيانات</p>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-medium text-white mb-4">الأساليب الأكثر شيوعاً</h3>
          {loading ? (
            <p className="text-white/60">جاري التحميل...</p>
          ) : displayMetrics.topStyles?.length > 0 ? (
            <div className="space-y-2">
              {displayMetrics.topStyles.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-white/[0.02]">
                  <span className="text-white/70">{item.style}</span>
                  <span className="text-[#C5A059]">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60">لا توجد بيانات</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب الذكاء - Intelligence & AI
// ═══════════════════════════════════════════════════════════════════════════════
function IntelligenceTab() {
  const [messages, setMessages] = useState<ArchitectMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "architect",
        content: "👋 أهلاً بك في مركز الذكاء والتطوير!\n\n🧠 أنا المهندس المعماري الذكي. يمكنني:\n• تحليل البيانات وتقديم توصيات\n• تطوير وتحسين الموقع\n• إنشاء تقارير ذكية\n• الإجابة على استفساراتك التقنية\n\nكيف يمكنني مساعدتك اليوم؟",
        timestamp: new Date(),
      },
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ArchitectMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/mastermind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "command",
          payload: { command: input, sessionId: `intel_${Date.now()}`, context: "intelligence" },
        }),
      });

      const data = await response.json();
      const architectMessage: ArchitectMessage = {
        id: `msg_${Date.now()}_resp`,
        role: "architect",
        content: data.result?.response || "تم استلام طلبك وسأقوم بمعالجته.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, architectMessage]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">الذكاء والتطوير</h2>
          <p className="text-sm text-[#C5A059]">المهندس المعماري الذكي - AI Architect</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 h-[450px] overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={`mb-4 ${msg.role === "user" ? "text-left" : "text-right"}`}>
            <div className={`inline-block max-w-[80%] rounded-xl p-3 ${
              msg.role === "user" ? "bg-[#C5A059]/20 text-white" : "bg-white/10 text-white"
            }`}>
              <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
              <p className="text-xs text-white/40 mt-1">
                {msg.timestamp.toLocaleTimeString("ar-EG")}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-right">
            <div className="inline-flex items-center gap-2 bg-white/10 text-white rounded-xl px-4 py-2">
              <div className="w-4 h-4 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">جاري التفكير...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="اسأل المهندس المعماري..."
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/40"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="rounded-xl bg-[#C5A059] px-4 py-3 text-[#1a1a1a] font-medium hover:bg-[#d8b56d] disabled:opacity-50"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب التطوير - Development (SEO + Theme + Site Manager)
// ═══════════════════════════════════════════════════════════════════════════════
function DevelopmentTab() {
  const [seoSettings, setSeoSettings] = useState({
    siteTitle: "Azenith Living - تصميم داخلي فاخر",
    siteDescription: "نحن متخصصون في تصميم الديكور الداخلي الفاخر للمنازل والمكاتب في الرياض",
    keywords: "تصميم داخلي, ديكور, رياض, فاخر",
    ogTitle: "Azenith Living - تصميم داخلي فاخر",
    ogDescription: "نحن متخصصون في تصميم الديكور الداخلي الفاخر",
    ogImage: "",
  });

  const [theme, setTheme] = useState<ThemeSettings>({
    primaryColor: "#c9a96e",
    secondaryColor: "#1a1a1a",
    headingFont: "serif",
    bodyFont: "sans",
  });

  const [saving, setSaving] = useState(false);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch("/api/seo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seoSettings) }),
        fetch("/api/theme", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(theme) }),
      ]);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">التطوير والتحسين</h2>
          <p className="text-sm text-[#C5A059]">SEO والمظهر وإدارة الموقع</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] disabled:opacity-50"
        >
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* SEO Settings */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Search className="w-4 h-4 text-[#C5A059]" />
            إعدادات SEO
          </h3>
          <div>
            <label className="block text-sm text-white/60 mb-1">عنوان الموقع</label>
            <input
              value={seoSettings.siteTitle}
              onChange={(e) => setSeoSettings({ ...seoSettings, siteTitle: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">وصف الموقع</label>
            <textarea
              value={seoSettings.siteDescription}
              onChange={(e) => setSeoSettings({ ...seoSettings, siteDescription: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">الكلمات المفتاحية</label>
            <input
              value={seoSettings.keywords}
              onChange={(e) => setSeoSettings({ ...seoSettings, keywords: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
        </div>

        {/* Theme Settings */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#C5A059]" />
            إعدادات المظهر
          </h3>
          <div>
            <label className="block text-sm text-white/60 mb-1">اللون الأساسي</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.primaryColor}
                onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
                className="h-10 w-16 rounded border border-white/10 bg-transparent"
              />
              <span className="text-sm text-white/60">{theme.primaryColor}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">اللون الثانوي</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme.secondaryColor}
                onChange={(e) => setTheme({ ...theme, secondaryColor: e.target.value })}
                className="h-10 w-16 rounded border border-white/10 bg-transparent"
              />
              <span className="text-sm text-white/60">{theme.secondaryColor}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">خط العناوين</label>
            <select
              value={theme.headingFont}
              onChange={(e) => setTheme({ ...theme, headingFont: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            >
              <option value="serif">Serif</option>
              <option value="sans">Sans Serif</option>
              <option value="mono">Monospace</option>
            </select>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
        <h3 className="font-medium text-white mb-4">معاينة مباشرة</h3>
        <div
          className="rounded-lg p-6"
          style={{
            backgroundColor: theme.secondaryColor,
            color: theme.primaryColor,
            fontFamily: theme.bodyFont === "serif" ? "serif" : theme.bodyFont === "mono" ? "monospace" : "sans-serif"
          }}
        >
          <h4 style={{ color: theme.primaryColor, fontFamily: theme.headingFont === "serif" ? "serif" : theme.headingFont === "mono" ? "monospace" : "sans-serif" }}>
            {seoSettings.siteTitle}
          </h4>
          <p className="text-sm opacity-80 mt-2">{seoSettings.siteDescription}</p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// مكون مساعد - بطاقة المؤشرات
// ═══════════════════════════════════════════════════════════════════════════════
function MetricCard({ icon: Icon, title, value, subtitle, color }: { icon: React.ElementType; title: string; value: string; subtitle: string; color: "amber" | "purple" | "emerald" | "blue" | "rose" }) {
  const colorClasses = {
    amber: "bg-[#C5A059]/20 text-[#C5A059]",
    purple: "bg-purple-500/20 text-purple-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
    rose: "bg-rose-500/20 text-rose-400",
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-sm text-white/50">{title}</p>
      <p className="text-2xl font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-white/40 mt-1">{subtitle}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// القائمة الرئيسية والتبويبات
// ═══════════════════════════════════════════════════════════════════════════════
const tabs = [
  { id: "warroom", label: "غرفة العمليات", icon: Target, component: WarRoomTab },
  { id: "analytics", label: "التحليلات", icon: BarChart3, component: AnalyticsTab },
  { id: "intelligence", label: "الذكاء", icon: Brain, component: IntelligenceTab },
  { id: "development", label: "التطوير", icon: Code, component: DevelopmentTab },
];

export default function IntelCenterPage() {
  const [activeTab, setActiveTab] = useState("warroom");
  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component || WarRoomTab;

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#C5A059] blur-lg opacity-30 rounded-full" />
            <div className="relative p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
              <Brain className="w-7 h-7 text-[#1a1a1a]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">الاستخبارات والتطوير</h1>
            <p className="text-white/50">مركز الذكاء الاصطناعي والتحليلات المتقدمة</p>
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
