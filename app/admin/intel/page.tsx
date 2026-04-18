"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain, BarChart3, Target, Code, Palette, Zap, Shield, Activity, TrendingUp, AlertTriangle, CheckCircle, Search, X, Users, Loader2, MemoryStick, Cpu, Key, FileText, Calendar, CreditCard, Plus, Trash2, Edit2, Lightbulb } from "lucide-react";
import SmartSuggestions from "@/components/admin/SmartSuggestions";
import { UltimateAgentChat } from "./components/UltimateAgentChat";
import { ProactiveDashboard } from "./components/ProactiveDashboard";

// ═══════════════════════════════════════════════════════════════════════════════
// أنواع البيانات
// ═══════════════════════════════════════════════════════════════════════════════
interface SystemHealthData {
  health: {
    status: "optimal" | "stable" | "degraded" | "under_attack" | string;
    uptime: string;
    memoryUsage: number;
    cpuUsage: number;
  };
  pendingAlerts: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
  }>;
}

interface ArsenalData {
  keys?: {
    activeCount: number;
    totalCount: number;
  };
  cache?: {
    size: number;
    hitRate?: number;
  };
  systemStats?: {
    memoryUsage?: number;
    cpuUsage?: number;
  };
}

interface MastermindStatsData {
  commands: {
    total: number;
    last24h: number;
  };
  security: {
    failedAttempts24h: number;
    has2FA: boolean;
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

interface ThemeSettings {
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// أنواع البيانات المنقولة من /admin/ops
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

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب غرفة العمليات - War Room (REAL DATA)
// ═══════════════════════════════════════════════════════════════════════════════
function fetchAdmin(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    credentials: "include",
    ...init,
  });
}

function WarRoomTab() {
  const [health, setHealth] = useState<SystemHealthData | null>(null);
  const [arsenal, setArsenal] = useState<ArsenalData | null>(null);
  const [mastermind, setMastermind] = useState<MastermindStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWarRoomData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [healthRes, arsenalRes, mastermindRes] = await Promise.all([
        fetch("/api/system-health"),
        fetchAdmin("/api/admin/arsenal"),
        fetchAdmin("/api/admin/mastermind/stats"),
      ]);

      const healthData = healthRes.ok ? await healthRes.json() : null;
      const arsenalData = arsenalRes.ok ? await arsenalRes.json() : null;
      const mastermindData = mastermindRes.ok ? await mastermindRes.json() : null;

      if (healthData) setHealth(healthData);
      if (arsenalData) setArsenal(arsenalData);
      if (mastermindData) setMastermind(mastermindData);

      // Check if at least one API failed
      const failedApis = [];
      if (!healthRes.ok) failedApis.push("system-health");
      if (!arsenalRes.ok) failedApis.push("arsenal");
      if (!mastermindRes.ok) failedApis.push("mastermind");

      if (failedApis.length > 0 && !healthData && !arsenalData) {
        setError(`تعذر تحميل البيانات من: ${failedApis.join(", ")}`);
      }
    } catch (err) {
      console.error("WarRoom fetch error:", err);
      setError("فشل الاتصال بالخوادم. يرجى المحاولة لاحقًا.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarRoomData();
  }, []);

  const healthColors = {
    optimal: "bg-emerald-500",
    stable: "bg-blue-500",
    degraded: "bg-amber-500",
    under_attack: "bg-rose-500 animate-pulse",
  };

  const getHealthStatusText = (status: string) => {
    switch (status) {
      case "optimal": return "ممتاز";
      case "stable": return "مستقر";
      case "degraded": return "منخفض";
      case "under_attack": return "هجوم";
      default: return status || "غير معروف";
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-10 h-10 text-[#C5A059] animate-spin mb-4" />
        <p className="text-white/60">جاري تحميل بيانات غرفة العمليات...</p>
      </div>
    );
  }

  // Error State
  if (error && !health && !arsenal) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-4" />
        <p className="text-rose-400 text-lg mb-4">{error}</p>
        <button
          onClick={fetchWarRoomData}
          className="px-6 py-3 bg-[#C5A059] text-[#1a1a1a] rounded-lg font-medium hover:bg-[#d8b56d] transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const systemStatus = health?.health?.status || "unknown";
  const memoryUsage = health?.health?.memoryUsage || arsenal?.systemStats?.memoryUsage || 0;
  const cpuUsage = health?.health?.cpuUsage || arsenal?.systemStats?.cpuUsage || 0;

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">غرفة العمليات</h2>
          <p className="text-sm text-[#C5A059]">مركز القيادة والمراقبة اللحظية</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${healthColors[systemStatus as keyof typeof healthColors] || "bg-gray-500"}`} />
          <span className="text-sm text-white/60">
            {getHealthStatusText(systemStatus)}
          </span>
          {error && (
            <span className="text-xs text-amber-400 mr-2">(بيانات جزئية)</span>
          )}
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* System Health Card */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${systemStatus === "optimal" ? "bg-emerald-500/20 text-emerald-400" : systemStatus === "stable" ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-400"}`}>
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-sm text-white/50">حالة النظام</p>
          <p className="text-2xl font-bold text-white mt-1">{getHealthStatusText(systemStatus)}</p>
          <p className="text-xs text-white/40 mt-1">
            {health?.health?.uptime ? `Uptime: ${health.health.uptime}` : "غير متاح"}
          </p>
        </div>

        {/* Memory Usage Card */}
        <MetricCard 
          icon={MemoryStick} 
          title="استخدام الذاكرة" 
          value={`${Math.round(memoryUsage)}%`} 
          subtitle={memoryUsage > 80 ? "مرتفع" : "طبيعي"} 
          color={memoryUsage > 80 ? "rose" : "blue"} 
        />

        {/* CPU Usage Card */}
        <MetricCard 
          icon={Cpu} 
          title="استخدام المعالج" 
          value={`${Math.round(cpuUsage)}%`} 
          subtitle={cpuUsage > 70 ? "مرتفع" : "طبيعي"} 
          color={cpuUsage > 70 ? "amber" : "purple"} 
        />

        {/* Active Keys Card */}
        <MetricCard 
          icon={Key} 
          title="المفاتيح النشطة" 
          value={arsenal?.keys?.activeCount?.toString() || "0"} 
          subtitle={`من ${arsenal?.keys?.totalCount || 0} مفتاح`} 
          color="amber" 
        />
      </div>

      {/* Secondary Metrics & Alerts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cache Stats */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#C5A059]" />
            أداء النظام
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-white/60">حجم الكاش</span>
                <span className="text-white">{arsenal?.cache?.size?.toLocaleString() || 0} عنصر</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full bg-[#C5A059] rounded-full" 
                  style={{ width: `${Math.min((arsenal?.cache?.size || 0) / 1000 * 100, 100)}%` }} 
                />
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">أوامر 24 ساعة:</span>
              <span className="text-[#C5A059]">{mastermind?.commands?.last24h || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">إجمالي الأوامر:</span>
              <span className="text-white">{mastermind?.commands?.total || 0}</span>
            </div>
          </div>
        </div>

        {/* Security Stats */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#C5A059]" />
            الحالة الأمنية
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-white/60">محاولات الدخول الفاشلة (24h):</span>
              <span className={`font-bold ${(mastermind?.security?.failedAttempts24h || 0) > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {mastermind?.security?.failedAttempts24h || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60">حماية 2FA:</span>
              <span className={mastermind?.security?.has2FA ? "text-emerald-400" : "text-amber-400"}>
                {mastermind?.security?.has2FA ? "مفعلة" : "غير مفعلة"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Section */}
      {health?.pendingAlerts && health.pendingAlerts.length > 0 && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-6">
          <h3 className="font-medium text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            التنبيهات النشطة ({health.pendingAlerts.length})
          </h3>
          <div className="space-y-3">
            {health.pendingAlerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`p-3 rounded-lg border ${
                  alert.severity === "critical" ? "border-rose-500/30 bg-rose-500/10" :
                  alert.severity === "warning" ? "border-amber-500/30 bg-amber-500/10" :
                  "border-blue-500/30 bg-blue-500/10"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${
                    alert.severity === "critical" ? "bg-rose-400" :
                    alert.severity === "warning" ? "bg-amber-400" :
                    "bg-blue-400"
                  }`} />
                  <span className="font-medium text-white text-sm">{alert.title}</span>
                </div>
                <p className="text-white/60 text-xs mr-4">{alert.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Alerts State */}
      {(!health?.pendingAlerts || health.pendingAlerts.length === 0) && !loading && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400 text-sm">لا توجد تنبيهات نشطة - النظام يعمل بكفاءة</span>
        </div>
      )}
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

  const loadAnalytics = useCallback(async () => {
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
  }, [period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

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
// تبويبات منقولة من /admin/ops - الأتمتة
// ═══════════════════════════════════════════════════════════════════════════════
function AutomationTab() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formConditions, setFormConditions] = useState("{}");
  const [formActions, setFormActions] = useState("{}");
  const [formEnabled, setFormEnabled] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load rules on mount
  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAdmin("/api/admin/automation");
      const data = await response.json();
      if (response.ok && data.success) {
        setRules(data.rules || []);
      } else {
        setError(data.error || "فشل في تحميل القواعد");
      }
    } catch (err) {
      setError("خطأ في الاتصال بالخادم");
      console.error("Failed to load rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (rule: AutomationRule) => {
    try {
      const response = await fetchAdmin(`/api/admin/automation?id=${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });

      if (response.ok) {
        setRules(rules.map(r => r.id === rule.id ? { ...r, enabled: !rule.enabled } : r));
      } else {
        console.error("Failed to toggle rule");
      }
    } catch (err) {
      console.error("Error toggling rule:", err);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه القاعدة؟")) return;

    try {
      const response = await fetchAdmin(`/api/admin/automation?id=${ruleId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setRules(rules.filter(r => r.id !== ruleId));
      } else {
        const data = await response.json();
        alert(data.error || "فشل في حذف القاعدة");
      }
    } catch (err) {
      console.error("Error deleting rule:", err);
      alert("خطأ في الاتصال بالخادم");
    }
  };

  const openAddForm = () => {
    setEditingRule(null);
    setFormName("");
    setFormTrigger("");
    setFormConditions("{}");
    setFormActions("{}");
    setFormEnabled(true);
    setShowForm(true);
  };

  const openEditForm = (rule: AutomationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormTrigger(rule.trigger);
    setFormConditions(JSON.stringify(rule.conditions || {}, null, 2));
    setFormActions(JSON.stringify(rule.actions || {}, null, 2));
    setFormEnabled(rule.enabled);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRule(null);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let conditions, actions;
      try {
        conditions = JSON.parse(formConditions || "{}");
        actions = JSON.parse(formActions || "{}");
      } catch {
        alert("تنسيق JSON غير صالح في الشروط أو الإجراءات");
        setSubmitting(false);
        return;
      }

      const body = {
        name: formName,
        trigger: formTrigger,
        conditions,
        actions,
        enabled: formEnabled,
      };

      if (editingRule) {
        // Update existing rule
        const response = await fetchAdmin(`/api/admin/automation?id=${editingRule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          await loadRules();
          closeForm();
        } else {
          const data = await response.json();
          alert(data.error || "فشل في تحديث القاعدة");
        }
      } else {
        // Create new rule
        const response = await fetchAdmin("/api/admin/automation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          await loadRules();
          closeForm();
        } else {
          const data = await response.json();
          alert(data.error || "فشل في إنشاء القاعدة");
        }
      }
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("خطأ في الاتصال بالخادم");
    } finally {
      setSubmitting(false);
    }
  };

  // Available trigger options
  const triggerOptions = [
    { value: "page_visit", label: "زيارة صفحة" },
    { value: "form_submit", label: "إرسال نموذج" },
    { value: "booking_status_changed", label: "تغيير حالة الحجز" },
    { value: "lead_updated", label: "تحديث عميل محتمل" },
    { value: "time_delay", label: "تأخير زمني" },
    { value: "user_registered", label: "تسجيل مستخدم جديد" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">نظام الأتمتة</h2>
          <p className="text-sm text-[#C5A059]">قواعد العمل التلقائي</p>
        </div>
        <button
          onClick={openAddForm}
          className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          قاعدة جديدة
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingRule ? "تعديل قاعدة" : "قاعدة جديدة"}
            </h3>
            <form onSubmit={submitForm} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">الاسم</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
                  placeholder="مثال: إشعار قبول الحجز"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">المشغل (Trigger)</label>
                <select
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value)}
                  required
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
                >
                  <option value="">اختر المشغل...</option>
                  {triggerOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">الشروط (JSON)</label>
                <textarea
                  value={formConditions}
                  onChange={(e) => setFormConditions(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white font-mono text-sm"
                  placeholder='{"page": "/furniture"}'
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1">الإجراءات (JSON)</label>
                <textarea
                  value={formActions}
                  onChange={(e) => setFormActions(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white font-mono text-sm"
                  placeholder='{"type": "whatsapp", "message": "تم قبول الحجز!"}'
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/10"
                />
                <label htmlFor="enabled" className="text-sm text-white/80">مفعّل</label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-[#C5A059] px-4 py-2 text-[#1a1a1a] font-medium hover:bg-[#d8b56d] disabled:opacity-50"
                >
                  {submitting ? "جاري الحفظ..." : editingRule ? "حفظ التغييرات" : "إنشاء قاعدة"}
                </button>
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 rounded-lg bg-white/10 px-4 py-2 text-white hover:bg-white/20"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rules List */}
      {loading ? (
        <div className="p-8 text-center text-white/60">
          <div className="w-8 h-8 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          جاري تحميل القواعد...
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-rose-400 mb-4">{error}</p>
          <button
            onClick={loadRules}
            className="rounded-lg bg-[#C5A059] px-4 py-2 text-[#1a1a1a] font-medium hover:bg-[#d8b56d]"
          >
            إعادة المحاولة
          </button>
        </div>
      ) : rules.length === 0 ? (
        <div className="p-8 text-center text-white/40">
          <p className="mb-4">لا توجد قواعد أتمتة</p>
          <button
            onClick={openAddForm}
            className="text-[#C5A059] hover:underline"
          >
            أنشئ أول قاعدة الآن
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleRule(rule)}
                    className={`w-10 h-6 rounded-full transition relative ${rule.enabled ? "bg-[#C5A059]" : "bg-white/20"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${rule.enabled ? "left-5" : "left-1"}`} />
                  </button>
                  <div>
                    <p className="font-medium text-white">{rule.name}</p>
                    <p className="text-sm text-white/50">المشغل: {rule.trigger}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditForm(rule)}
                    className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
                    title="تعديل"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 rounded-lg text-white/50 hover:text-rose-400 hover:bg-rose-500/10"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويبات منقولة من /admin/ops - المحتوى
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
// تبويبات منقولة من /admin/ops - الحجوزات
// ═══════════════════════════════════════════════════════════════════════════════
function BookingsTab() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
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
                          <CheckCircle className="w-4 h-4" />
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
// تبويبات منقولة من /admin/ops - الفواتير
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
                  <CheckCircle className="w-4 h-4 text-[#C5A059]" />
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
// تبويب المقترحات الذكية - Smart Suggestions (Omnipotent Agent)
// ═══════════════════════════════════════════════════════════════════════════════
function SmartSuggestionsTab() {
  return <SmartSuggestions />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// القائمة الرئيسية والتبويبات - 9 تبويبات
// ═══════════════════════════════════════════════════════════════════════════════
const tabs = [
  // التبويبات الأصلية (4)
  { id: "intelligence", label: "الذكاء", icon: Brain, component: UltimateAgentChat },
  { id: "warroom", label: "غرفة العمليات", icon: Target, component: WarRoomTab },
  { id: "analytics", label: "التحليلات", icon: BarChart3, component: AnalyticsTab },
  { id: "development", label: "التطوير", icon: Code, component: DevelopmentTab },
  // وكيل شامل
  { id: "suggestions", label: "المقترحات الذكية", icon: Lightbulb, component: SmartSuggestionsTab },
  // لوحة الاستباقية - Ultimate Agent Dashboard
  { id: "proactive", label: "اللوحة الاستباقية", icon: Zap, component: ProactiveDashboard },
  // التبويبات المنقولة من /admin/ops (4)
  { id: "automation", label: "الأتمتة", icon: Zap, component: AutomationTab },
  { id: "content", label: "المحتوى", icon: FileText, component: ContentTab },
  { id: "bookings", label: "الحجوزات", icon: Calendar, component: BookingsTab },
  { id: "billing", label: "الفواتير", icon: CreditCard, component: BillingTab },
];

export default function IntelCenterPage() {
  const [activeTab, setActiveTab] = useState("intelligence");
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
