"use client";

import { useState, useEffect, useRef } from "react";
import { Shield, Users, Building2, Settings, FileText, Crown, Send, MessageCircle, TrendingUp, Edit2, Check, X, Trash2, AlertCircle } from "lucide-react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════════
// أنواع البيانات
// ═══════════════════════════════════════════════════════════════════════════════
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface KnowledgeItem {
  id: string;
  key: string;
  value: string;
  category: string;
  usage_count: number;
  created_at: string;
}

interface PendingQuestion {
  id: string;
  question: string;
  asked_count: number;
  answered: boolean;
  created_at: string;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: "diamond" | "gold" | "silver" | "bronze";
  score: number;
  status: string;
  created_at: string;
}

interface TenantRecord {
  id: string;
  name: string;
  domain: string;
  logo: string | null;
  primary_color: string | null;
  whatsapp: string | null;
  created_at: string;
}

interface SiteConfig {
  heroTitle: string;
  heroSubtitle: string;
  budgetOptions: string[];
  styleOptions: string[];
  serviceOptions: string[];
  heroBackground: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب مدير المبيعات - Sales Manager
// ═══════════════════════════════════════════════════════════════════════════════
function SalesManagerTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"chat" | "knowledge" | "questions">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: "👋 أهلاً بك في لوحة قائد المبيعات!\n\n📚 أنا المتدرب المطور الذكي. أقترح عليك:\n• التوجيهات الأكثر استخداماً لتحسينها\n• الأسئلة المتكررة لإضافتها للمعرفة\n• تحليل أسبوعي للزوار والتحويلات\n\n✍️ اكتب أي معلومة جديدة وسأحفظها في قاعدة المعرفة.",
        timestamp: new Date().toISOString(),
      },
    ]);
    loadKnowledge();
    loadPendingQuestions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadKnowledge = async () => {
    try {
      const response = await fetch("/api/sales-leader/knowledge");
      if (response.ok) {
        const data = await response.json();
        setKnowledge(data.knowledge || []);
      }
    } catch (error) {
      console.error("[SalesLeader] Error loading knowledge:", error);
    }
  };

  const loadPendingQuestions = async () => {
    try {
      const response = await fetch("/api/sales-leader/pending");
      if (response.ok) {
        const data = await response.json();
        setPendingQuestions(data.pending || []);
      }
    } catch (error) {
      console.error("[SalesLeader] Error loading pending:", error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage: Message = {
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          isAdmin: true,
        }),
      });
      const data = await response.json();
      
      const assistantMessage: Message = {
        role: "assistant",
        content: data.response || "تم استلام رسالتك وسأقوم بتحليلها.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">مدير المبيعات</h2>
          <p className="text-sm text-[#C5A059]">مركز التحكم بالمبيعات والمحادثات</p>
        </div>
        <div className="flex gap-2">
          {[
            { id: "chat", label: "المحادثة", icon: MessageCircle },
            { id: "knowledge", label: "المعرفة", icon: FileText },
            { id: "questions", label: "الأسئلة", icon: AlertCircle },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                activeSubTab === tab.id
                  ? "bg-[#C5A059]/20 text-[#C5A059]"
                  : "text-white/60 hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeSubTab === "chat" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 h-[400px] overflow-y-auto">
            {messages.map((msg, idx) => (
              <div key={idx} className={`mb-4 ${msg.role === "user" ? "text-left" : "text-right"}`}>
                <div className={`inline-block max-w-[80%] rounded-xl p-3 ${
                  msg.role === "user" ? "bg-[#C5A059]/20 text-white" : "bg-white/10 text-white"
                }`}>
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  {msg.timestamp && (
                    <p className="text-xs text-white/40 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString("ar-EG")}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="اكتب رسالتك..."
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/40"
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="rounded-xl bg-[#C5A059] px-4 py-3 text-[#1a1a1a] font-medium hover:bg-[#d8b56d] disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {activeSubTab === "knowledge" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {knowledge.length === 0 ? (
              <div className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/60">
                لا توجد عناصر معرفة بعد
              </div>
            ) : (
              knowledge.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-[#C5A059] uppercase">{item.category}</p>
                  <p className="font-medium text-white mt-1">{item.key}</p>
                  <p className="text-sm text-white/60 mt-2 line-clamp-2">{item.value}</p>
                  <p className="text-xs text-white/40 mt-2">الاستخدام: {item.usage_count}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === "questions" && (
        <div className="space-y-4">
          {pendingQuestions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/60">
              لا توجد أسئلة معلقة
            </div>
          ) : (
            pendingQuestions.map((q) => (
              <div key={q.id} className="flex items-start justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div>
                  <p className="text-white">{q.question}</p>
                  <p className="text-sm text-white/50 mt-1">تم السؤال {q.asked_count} مرات</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${q.answered ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}`}>
                  {q.answered ? "مجاب" : "معلق"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب العملاء - Leads
// ═══════════════════════════════════════════════════════════════════════════════
function LeadsTab() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "diamond" | "gold" | "silver" | "bronze">("all");

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/leads");
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
      }
    } catch (error) {
      console.error("Failed to load leads:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = filter === "all" ? leads : leads.filter(l => l.tier === filter);

  const tierColors = {
    diamond: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    gold: "bg-[#C5A059]/20 text-[#C5A059] border-[#C5A059]/30",
    silver: "bg-gray-400/20 text-gray-300 border-gray-400/30",
    bronze: "bg-amber-700/20 text-amber-600 border-amber-700/30",
  };

  const tierCounts = {
    diamond: leads.filter(l => l.tier === "diamond").length,
    gold: leads.filter(l => l.tier === "gold").length,
    silver: leads.filter(l => l.tier === "silver").length,
    bronze: leads.filter(l => l.tier === "bronze").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">العملاء المحتملين</h2>
          <p className="text-sm text-[#C5A059]">تصنيف الماسي | ذهبي | فضي | برونزي</p>
        </div>
        <Link href="/admin/leads" className="text-sm text-[#C5A059] hover:underline">
          عرض الكل →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { tier: "diamond", label: "الماسي", count: tierCounts.diamond },
          { tier: "gold", label: "ذهبي", count: tierCounts.gold },
          { tier: "silver", label: "فضي", count: tierCounts.silver },
          { tier: "bronze", label: "برونزي", count: tierCounts.bronze },
        ].map((item) => (
          <button
            key={item.tier}
            onClick={() => setFilter(filter === item.tier ? "all" : item.tier as typeof filter)}
            className={`rounded-xl border p-4 text-center transition ${
              filter === item.tier
                ? tierColors[item.tier as keyof typeof tierColors]
                : "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.05]"
            }`}
          >
            <p className="text-sm text-white/60">{item.label}</p>
            <p className="mt-2 text-2xl font-bold">{loading ? "--" : item.count}</p>
          </button>
        ))}
      </div>

      {/* Leads List */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/60">جاري التحميل...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-white/60">
            لا يوجد عملاء في هذا التصنيف
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredLeads.slice(0, 10).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-4 hover:bg-white/[0.02]">
                <div>
                  <p className="font-medium text-white">{lead.name}</p>
                  <p className="text-sm text-white/50">{lead.email} | {lead.phone}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs border ${tierColors[lead.tier]}`}>
                    {lead.tier === "diamond" ? "ماسي" : lead.tier === "gold" ? "ذهبي" : lead.tier === "silver" ? "فضي" : "برونزي"}
                  </span>
                  <span className="text-sm text-white/60">{lead.score} نقطة</span>
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
// تبويب المستأجرين - Tenants
// ═══════════════════════════════════════════════════════════════════════════════
function TenantsTab() {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    domain: "",
    logo: "",
    primary_color: "#C5A059",
    whatsapp: "",
  });

  useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tenants");
      const data = await response.json();
      if (response.ok && data.tenants) {
        setTenants(data.tenants);
      }
    } catch (error) {
      console.error("Failed to load tenants:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        setForm({ name: "", domain: "", logo: "", primary_color: "#C5A059", whatsapp: "" });
        setShowForm(false);
        loadTenants();
      }
    } catch (error) {
      console.error("Failed to create tenant:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">المستأجرين</h2>
          <p className="text-sm text-[#C5A059]">إدارة الشركات والدومينات</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d]"
        >
          {showForm ? "إلغاء" : "+ إضافة مستأجر"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm text-white/60 mb-1">اسم الشركة</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">الدومين</label>
              <input
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                placeholder="example.com"
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">رابط الشعار</label>
              <input
                value={form.logo}
                onChange={(e) => setForm({ ...form, logo: e.target.value })}
                placeholder="https://..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">واتساب</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="+9665..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">اللون الأساسي</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  className="h-10 w-16 rounded border border-white/10 bg-transparent"
                />
                <span className="text-sm text-white/60">{form.primary_color}</span>
              </div>
            </div>
          </div>
          <button type="submit" className="rounded-xl bg-[#C5A059] px-6 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d]">
            إنشاء مستأجر
          </button>
        </form>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/60">جاري التحميل...</div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center text-white/60">لا توجد شركات مضافة بعد</div>
        ) : (
          <table className="w-full text-right">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 text-sm text-white/60">الاسم</th>
                <th className="px-4 py-3 text-sm text-white/60">الدومين</th>
                <th className="px-4 py-3 text-sm text-white/60">اللون</th>
                <th className="px-4 py-3 text-sm text-white/60">واتساب</th>
                <th className="px-4 py-3 text-sm text-white/60">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {tenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{tenant.name}</td>
                  <td className="px-4 py-3 text-white/60">{tenant.domain}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: tenant.primary_color || "#C5A059" }} />
                      <span className="text-white/60 text-sm">{tenant.primary_color || "-"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-white/60">{tenant.whatsapp || "-"}</td>
                  <td className="px-4 py-3 text-white/60">
                    {new Date(tenant.created_at).toLocaleDateString("ar-EG")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب الإدارة - Management
// ═══════════════════════════════════════════════════════════════════════════════
function ManagementTab() {
  const [settings, setSettings] = useState({
    siteTitle: "Azenith Living - تصميم داخلي فاخر",
    siteDescription: "نحن متخصصون في تصميم الديكور الداخلي الفاخر",
    keywords: "تصميم داخلي, ديكور, رياض, فاخر",
    whatsapp: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
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
          <h2 className="text-xl font-bold text-white">الإدارة والتحكم</h2>
          <p className="text-sm text-[#C5A059]">الإعدادات والأمان والتحكم</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] disabled:opacity-50"
        >
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#C5A059]" />
            إعدادات الموقع
          </h3>
          <div>
            <label className="block text-sm text-white/60 mb-1">عنوان الموقع</label>
            <input
              value={settings.siteTitle}
              onChange={(e) => setSettings({ ...settings, siteTitle: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">الوصف</label>
            <textarea
              value={settings.siteDescription}
              onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">الكلمات المفتاحية</label>
            <input
              value={settings.keywords}
              onChange={(e) => setSettings({ ...settings, keywords: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#C5A059]" />
            الأمان والحماية
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
              <span className="text-white/70">المصادقة الثنائية (2FA)</span>
              <Link href="/admin/setup-security" className="text-sm text-[#C5A059] hover:underline">
                الإعداد
              </Link>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
              <span className="text-white/70">المفتاح الرقمي</span>
              <span className="text-sm text-emerald-400">مفعل</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
              <span className="text-white/70">سجل الأنشطة</span>
              <span className="text-sm text-white/50">24 ساعة</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// تبويب CMS
// ═══════════════════════════════════════════════════════════════════════════════
function CMSTab() {
  const [config, setConfig] = useState<SiteConfig>({
    heroTitle: "ابدأ رحلة التصميم الذكي.",
    heroSubtitle: "أربع اختيارات فقط تكفي لبناء ملف العميل، تقدير مبدئي، ورسالة واتساب جاهزة للفريق التجاري.",
    budgetOptions: ["2,500 - 5,500 EGP", "5,500 - 12,000 EGP", "12,000 - 25,000 EGP", "25,000+ EGP"],
    styleOptions: ["مودرن دافئ", "هادئ فاخر", "عملي مع لمسة فندقية", "صناعي ناعم"],
    serviceOptions: ["تصميم فقط", "تصميم وتجهيز", "تصميم وتنفيذ", "تجديد لمساحة قائمة"],
    heroBackground: "/videos/hero-bg.mp4",
  });
  const [activeSubTab, setActiveSubTab] = useState<"text" | "options" | "media">("text");
  const [saving, setSaving] = useState(false);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch("/api/cms/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">إدارة المحتوى</h2>
          <p className="text-sm text-[#C5A059]">CMS - تخصيص الموقع</p>
        </div>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] disabled:opacity-50"
        >
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>

      <div className="flex gap-2">
        {[
          { id: "text", label: "النصوص" },
          { id: "options", label: "الخيارات" },
          { id: "media", label: "الوسائط" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
            className={`px-4 py-2 rounded-lg text-sm transition ${
              activeSubTab === tab.id
                ? "bg-[#C5A059]/20 text-[#C5A059]"
                : "text-white/60 hover:bg-white/5"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === "text" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="block text-sm text-white/60 mb-2">عنوان Hero</label>
            <textarea
              value={config.heroTitle}
              onChange={(e) => setConfig({ ...config, heroTitle: e.target.value })}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="block text-sm text-white/60 mb-2">العنوان الفرعي</label>
            <textarea
              value={config.heroSubtitle}
              onChange={(e) => setConfig({ ...config, heroSubtitle: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
            />
          </div>
        </div>
      )}

      {activeSubTab === "options" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="block text-sm text-white/60 mb-3">خيارات الميزانية</label>
            {config.budgetOptions.map((option, idx) => (
              <input
                key={idx}
                value={option}
                onChange={(e) => {
                  const newOptions = [...config.budgetOptions];
                  newOptions[idx] = e.target.value;
                  setConfig({ ...config, budgetOptions: newOptions });
                }}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white mb-2"
              />
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="block text-sm text-white/60 mb-3">الأساليب</label>
            {config.styleOptions.map((option, idx) => (
              <input
                key={idx}
                value={option}
                onChange={(e) => {
                  const newOptions = [...config.styleOptions];
                  newOptions[idx] = e.target.value;
                  setConfig({ ...config, styleOptions: newOptions });
                }}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white mb-2"
              />
            ))}
          </div>
        </div>
      )}

      {activeSubTab === "media" && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <label className="block text-sm text-white/60 mb-2">خلفية Hero</label>
          <input
            value={config.heroBackground}
            onChange={(e) => setConfig({ ...config, heroBackground: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
          />
          <p className="text-xs text-white/40 mt-2">يمكنك استخدام رابط صورة أو فيديو</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// القائمة الرئيسية والتبويبات
// ═══════════════════════════════════════════════════════════════════════════════
const tabs = [
  { id: "sales", label: "مدير المبيعات", icon: Crown, component: SalesManagerTab },
  { id: "leads", label: "العملاء", icon: Users, component: LeadsTab },
  { id: "tenants", label: "المستأجرين", icon: Building2, component: TenantsTab },
  { id: "management", label: "الإدارة", icon: Settings, component: ManagementTab },
  { id: "cms", label: "CMS", icon: FileText, component: CMSTab },
];

export default function SalesCenterPage() {
  const [activeTab, setActiveTab] = useState("sales");
  const ActiveComponent = tabs.find((t) => t.id === activeTab)?.component || SalesManagerTab;

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-[#C5A059] blur-lg opacity-30 rounded-full" />
            <div className="relative p-3 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
              <Shield className="w-7 h-7 text-[#1a1a1a]" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">المبيعات والإدارة</h1>
            <p className="text-white/50">مركز القيادة للمبيعات والإدارة العامة</p>
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
