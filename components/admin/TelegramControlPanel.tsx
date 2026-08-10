"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X, Send, Plus, Trash2, Edit3, Check, AlertCircle,
  Loader2, MessageSquare, Eye, EyeOff, RefreshCw,
  Bot, Hash, Save, Star, HelpCircle, Info,
  ChevronDown, ChevronUp, UserPlus,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
export interface TelegramChatEntry {
  id: string;
  label: string;       // اسم مألوف زي "أنا" أو "فريق المبيعات"
  chatId: string;      // الرقم الحقيقي من تليجرام
  isDefault: boolean;  // هل ده اللي يستقبل التنبيهات التلقائية؟
}

interface TelegramConfig {
  enabled: boolean;
  hasToken: boolean;
  tokenMasked: string;
  chats: TelegramChatEntry[];
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const MAX_CHATS = 10;
const emptyChat = (): Omit<TelegramChatEntry, "id"> => ({ label: "", chatId: "", isDefault: false });

// ─── Tooltip helper ───────────────────────────────────────
function InfoTip({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="text-white/30 hover:text-[#C5A059] transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {show && (
        <span
          className="absolute z-50 right-0 top-6 w-72 bg-[#1a1a1a] border border-white/10 rounded-xl p-3 text-white/70 text-xs leading-relaxed shadow-2xl"
          onClick={() => setShow(false)}
        >
          {children}
        </span>
      )}
    </span>
  );
}

// ─── Collapsible guide section ────────────────────────────
function GuideBox({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#C5A059]/20 bg-[#C5A059]/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[#C5A059] text-xs font-medium"
      >
        <span className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5" />
          {title}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 text-white/60 text-xs leading-relaxed space-y-1.5 border-t border-[#C5A059]/10">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Toast helper ─────────────────────────────────────────
function Toast({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className={`mx-6 mt-3 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
      ok ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
         : "bg-rose-500/15 text-rose-300 border border-rose-500/20"
    }`}>
      {ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
      {text}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────
export default function TelegramControlPanel({ open, onClose }: Props) {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [botStatus, setBotStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [botUsername, setBotUsername] = useState<string | null>(null);

  const [newToken, setNewToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const [editingChat, setEditingChat] = useState<TelegramChatEntry | null>(null);
  const [addingChat, setAddingChat] = useState(false);
  const [chatForm, setChatForm] = useState(emptyChat());

  const [testChatId, setTestChatId] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const showToast = (ok: boolean, text: string) => {
    setToast({ ok, text });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, statusRes] = await Promise.all([
        fetch("/api/admin/telegram/config"),
        fetch("/api/admin/telegram/status"),
      ]);
      if (cfgRes.ok) { const d = await cfgRes.json(); if (d.success) setConfig(d.config); }
      if (statusRes.ok) {
        const s = await statusRes.json();
        setBotStatus(s.connected ? "connected" : "disconnected");
        setBotUsername(s.botUsername ?? null);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (open) fetchConfig(); }, [open, fetchConfig]);

  const handleToggleEnabled = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/telegram/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      const d = await res.json();
      if (d.success) { setConfig((c) => c && { ...c, enabled: !c.enabled }); showToast(true, config.enabled ? "تم إيقاف الإشعارات" : "تم تفعيل الإشعارات"); }
      else showToast(false, d.error || "فشل التحديث");
    } finally { setSaving(false); }
  };

  const handleSaveToken = async () => {
    if (!newToken.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/telegram/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: newToken.trim(), enabled: config?.enabled ?? true, chats: config?.chats ?? [] }),
      });
      const d = await res.json();
      if (d.success) { setNewToken(""); await fetchConfig(); showToast(true, "✅ تم حفظ الـ Bot Token بنجاح"); }
      else showToast(false, d.error || "فشل الحفظ");
    } finally { setSaving(false); }
  };

  const saveChats = async (chats: TelegramChatEntry[]) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/telegram/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chats }),
      });
      const d = await res.json();
      if (d.success) { setConfig((c) => c && { ...c, chats }); return true; }
      showToast(false, d.error || "فشل الحفظ"); return false;
    } finally { setSaving(false); }
  };

  const handleAddChat = async () => {
    if (!chatForm.label.trim() || !chatForm.chatId.trim()) { showToast(false, "الاسم والـ Chat ID مطلوبان"); return; }
    const current = config?.chats ?? [];
    if (current.length >= MAX_CHATS) { showToast(false, `الحد الأقصى ${MAX_CHATS} حسابات`); return; }
    const entry: TelegramChatEntry = {
      id: crypto.randomUUID(), label: chatForm.label.trim(), chatId: chatForm.chatId.trim(),
      isDefault: chatForm.isDefault || current.length === 0,
    };
    const updated = current.map((c) => entry.isDefault ? { ...c, isDefault: false } : c);
    const ok = await saveChats([...updated, entry]);
    if (ok) { setAddingChat(false); setChatForm(emptyChat()); showToast(true, "✅ تمت إضافة الحساب"); }
  };

  const handleEditChat = async () => {
    if (!editingChat || !editingChat.label.trim() || !editingChat.chatId.trim()) { showToast(false, "الاسم والـ Chat ID مطلوبان"); return; }
    const updated = (config?.chats ?? []).map((c) => {
      if (c.id === editingChat.id) return editingChat;
      return editingChat.isDefault ? { ...c, isDefault: false } : c;
    });
    const ok = await saveChats(updated);
    if (ok) { setEditingChat(null); showToast(true, "تم التعديل"); }
  };

  const handleDeleteChat = async (id: string, label: string) => {
    if (!confirm(`حذف "${label}" من قائمة الحسابات؟`)) return;
    const updated = (config?.chats ?? []).filter((c) => c.id !== id);
    const ok = await saveChats(updated);
    if (ok) showToast(true, `تم حذف "${label}"`);
  };

  const handleSetDefault = async (id: string) => {
    const updated = (config?.chats ?? []).map((c) => ({ ...c, isDefault: c.id === id }));
    const ok = await saveChats(updated);
    if (ok) showToast(true, "تم تعيين الحساب الافتراضي");
  };

  const handleTestMessage = async () => {
    const target = testChatId.trim() || config?.chats.find((c) => c.isDefault)?.chatId || "";
    if (!target) { showToast(false, "اختر حساباً أو أدخل Chat ID"); return; }
    setTestLoading(true); setTestResult(null);
    try {
      const res = await fetch("/api/admin/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: target, message: testMsg.trim() || undefined }),
      });
      const d = await res.json();
      setTestResult({ ok: d.success, text: d.message || d.error || "غير معروف" });
    } finally { setTestLoading(false); }
  };

  if (!open) return null;
  const isConnected = botStatus === "connected";
  const chats = config?.chats ?? [];
  const atMax = chats.length >= MAX_CHATS;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end" dir="rtl">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 h-full w-full max-w-lg bg-[#0f0f0f] border-r border-white/10 flex flex-col shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isConnected ? "bg-emerald-500/20" : "bg-rose-500/20"}`}>
              <MessageSquare className={`w-5 h-5 ${isConnected ? "text-emerald-400" : "text-rose-400"}`} />
            </div>
            <div>
              <h2 className="text-white font-bold text-base">إعدادات تليجرام</h2>
              <p className="text-white/40 text-xs">
                {loading ? "جاري التحميل..." : isConnected ? `@${botUsername || "bot"} — متصل` : "البوت غير متصل"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchConfig} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors" title="تحديث">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded-lg text-white/30 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {toast && <Toast ok={toast.ok} text={toast.text} />}

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-white/30 animate-spin" /></div>
          ) : (<>

            {/* ══════════════════════════════════════
                SECTION 1 — حالة الخدمة
            ══════════════════════════════════════ */}
            <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-sm font-semibold">حالة الخدمة</h3>
                  <p className="text-white/40 text-xs mt-0.5">{config?.enabled ? "الإشعارات التلقائية شغالة" : "الإشعارات موقوفة"}</p>
                </div>
                <button onClick={handleToggleEnabled} disabled={saving}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${config?.enabled ? "bg-emerald-500" : "bg-white/10"} disabled:opacity-50`}
                >
                  <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-200 ${config?.enabled ? "-translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Bot className="w-4 h-4 text-white/30" />
                <span className="text-white/40 text-xs">البوت:</span>
                <span className={`text-xs font-semibold flex items-center gap-1.5 ${isConnected ? "text-emerald-400" : "text-rose-400"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-rose-400"}`} />
                  {isConnected ? `متصل — @${botUsername}` : "غير متصل — راجع الـ Token"}
                </span>
              </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 2 — Bot Token
            ══════════════════════════════════════ */}
            <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-white text-sm font-semibold">الخطوة ١ — ربط البوت</h3>
                <span className="text-[10px] px-2 py-0.5 bg-white/5 text-white/40 rounded-full">يتم مرة واحدة فقط</span>
                <InfoTip>
                  <p className="font-semibold text-white/80 mb-1">البوت Token إيه؟</p>
                  <p>البوت هو حساب تليجرام آلي بيبعت التنبيهات. الـ Token هو "بطاقة هويته" اللي بتثبت إنه بتاعك. بتعمله مرة واحدة بس ومش محتاج ترجعله تاني.</p>
                  <p className="mt-1 text-[#C5A059]">✅ لو البوت متصل بالأعلى — مش محتاج تعمل حاجة هنا.</p>
                </InfoTip>
              </div>

              <GuideBox title="📖 كيفية إنشاء بوت تليجرام والحصول على الـ Token — خطوة بخطوة">
                <div className="space-y-2">
                  <p className="font-semibold text-white/80">الخطوات (دقيقتين بس):</p>
                  <p>1️⃣ افتح تطبيق تليجرام على تليفونك أو الكمبيوتر.</p>
                  <p>2️⃣ ابحث في تليجرام عن: <span className="font-mono text-[#C5A059] bg-black/30 px-1 rounded">@BotFather</span> (ده الحساب الرسمي من تليجرام).</p>
                  <p>3️⃣ ابعت له: <span className="font-mono text-emerald-400 bg-black/30 px-1 rounded">/newbot</span></p>
                  <p>4️⃣ هيسألك اسم البوت — اكتب أي اسم بالإنجليزي مثلاً: <span className="font-mono text-white/70">Azenith Alerts Bot</span></p>
                  <p>5️⃣ هيسألك username — لازم ينتهي بكلمة bot مثلاً: <span className="font-mono text-white/70">azenith_alerts_bot</span></p>
                  <p>6️⃣ هيرسلك رسالة فيها سطر زي: <span className="font-mono text-[#C5A059] bg-black/30 px-1 rounded">1234567890:ABCDefghIJKlmn...</span></p>
                  <p className="font-semibold text-white/80">7️⃣ انسخ هذا الرقم الطويل — ده هو الـ Token اللازم تضيفه هنا ⬆️</p>
                </div>
              </GuideBox>

              {config?.hasToken && (
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
                  <Hash className="w-4 h-4 text-white/30 shrink-0" />
                  <span className="text-white/50 text-xs font-mono flex-1">{config.tokenMasked}</span>
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">محفوظ ✓</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-white/50 text-xs">{config?.hasToken ? "تعديل الـ Token — اتركه فارغاً إذا لا تريد التغيير" : "الصق الـ Token هنا"}</label>
                <div className="relative">
                  <input type={showToken ? "text" : "password"} value={newToken} onChange={(e) => setNewToken(e.target.value)}
                    placeholder="مثال: 1234567890:ABCDefghIJKlmn..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pl-10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/25 font-mono"
                  />
                  <button onClick={() => setShowToken((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60" type="button">
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={handleSaveToken} disabled={!newToken.trim() || saving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-xl text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  حفظ الـ Token
                </button>
              </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 3 — حسابات الاستقبال
            ══════════════════════════════════════ */}
            <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-white text-sm font-semibold">الخطوة ٢ — من يستقبل التنبيهات؟</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${atMax ? "bg-rose-500/15 text-rose-400" : "bg-white/5 text-white/40"}`}>
                    {chats.length}/{MAX_CHATS}
                  </span>
                  <InfoTip>
                    <p className="font-semibold text-white/80 mb-2">👇 هنا بتحدد مين يستقبل التنبيهات</p>
                    <p>كل ما عميل جديد أو حجز جديد — النظام بيبعت تنبيه على تليجرام. هنا بتقوله يبعته لمين.</p>
                    <p className="mt-1">مثلاً:</p>
                    <p>• تضيف حسابك الشخصي → التنبيهات تيجيلك إنت</p>
                    <p>• تضيف حساب موظف → التنبيهات تيجيله هو كمان</p>
                    <p>• تضيف مجموعة → كل الفريق يشوف</p>
                    <p className="mt-1 text-[#C5A059] font-semibold">⭐ الحساب الافتراضي = أول واحد يستقبل التنبيهات التلقائية.</p>
                  </InfoTip>
                </div>
                {!atMax && !addingChat && (
                  <button onClick={() => { setAddingChat(true); setChatForm(emptyChat()); setEditingChat(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-white/70 text-xs hover:bg-white/10 transition-colors">
                    <UserPlus className="w-3.5 h-3.5" />
                    إضافة حساب
                  </button>
                )}
              </div>

              <GuideBox title="📖 إزاي تعرف رقم Chat ID الخاص بك أو بموظفيك؟">
                <div className="space-y-2">
                  <p className="font-semibold text-white/80">لأي شخص (أنت أو موظف) — خطوتين بس:</p>
                  <p>1️⃣ يفتح تليجرام ويبحث عن: <span className="font-mono text-[#C5A059] bg-black/30 px-1 rounded">@userinfobot</span></p>
                  <p>2️⃣ يبعتله أي رسالة — هيرد برقم. هذا الرقم هو الـ Chat ID. انسخه وضيفه هنا.</p>
                  <div className="border-t border-white/10 pt-2 mt-1">
                    <p className="font-semibold text-white/80">لمجموعة تليجرام (عشان كل الفريق يشوف):</p>
                    <p>1️⃣ ابعت <span className="font-mono text-emerald-400 bg-black/30 px-1 rounded">/start</span> في المجموعة وبعد ما تضيف البوت فيها</p>
                    <p>2️⃣ افتح المتصفح وادخل هذا الرابط (استبدل TOKEN بالـ Token بتاعك):</p>
                    <p className="font-mono text-white/50 bg-black/30 px-2 py-1 rounded text-[10px] break-all">api.telegram.org/bot<span className="text-[#C5A059]">TOKEN</span>/getUpdates</p>
                    <p>3️⃣ دور على <span className="font-mono text-[#C5A059]">"id":</span> جوا كلمة "chat" — الرقم ده هو Chat ID المجموعة</p>
                  </div>
                </div>
              </GuideBox>

              {/* قائمة الحسابات */}
              <div className="space-y-2">
                {chats.length === 0 && !addingChat && (
                  <div className="text-center py-6">
                    <p className="text-white/30 text-xs">لا يوجد حسابات مضافة بعد</p>
                    <p className="text-white/20 text-[10px] mt-1">اضغط "إضافة حساب" للبدء</p>
                  </div>
                )}

                {chats.map((chat) => (
                  <div key={chat.id}>
                    {editingChat?.id === chat.id ? (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                        <input value={editingChat.label} onChange={(e) => setEditingChat({ ...editingChat, label: e.target.value })}
                          placeholder="اسم مألوف (مثال: أنا، فريق المبيعات)" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-white/25" />
                        <input value={editingChat.chatId} onChange={(e) => setEditingChat({ ...editingChat, chatId: e.target.value })}
                          placeholder="Chat ID الرقمي — مثال: 5395247315" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-white/25 font-mono" />
                        <label className="flex items-center gap-2 text-white/50 text-xs cursor-pointer">
                          <input type="checkbox" checked={editingChat.isDefault} onChange={(e) => setEditingChat({ ...editingChat, isDefault: e.target.checked })} className="rounded" />
                          ⭐ جعله الحساب الافتراضي (يستقبل التنبيهات التلقائية)
                        </label>
                        <div className="flex gap-2 pt-1">
                          <button onClick={handleEditChat} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-40"><Check className="w-3.5 h-3.5" /> حفظ</button>
                          <button onClick={() => setEditingChat(null)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/50 rounded-lg text-xs hover:bg-white/10 transition-colors"><X className="w-3.5 h-3.5" /> إلغاء</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl group hover:border-white/10 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {chat.isDefault && <Star className="w-3 h-3 text-[#C5A059] shrink-0" />}
                            <span className="text-white text-xs font-medium truncate">{chat.label}</span>
                            {chat.isDefault && <span className="text-[10px] px-1.5 py-0.5 bg-[#C5A059]/15 text-[#C5A059] rounded-full shrink-0">افتراضي</span>}
                          </div>
                          <span className="text-white/30 text-[10px] font-mono">{chat.chatId}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {!chat.isDefault && (
                            <button onClick={() => handleSetDefault(chat.id)} title="تعيين كافتراضي"
                              className="p-1.5 rounded-lg text-white/20 hover:text-[#C5A059] hover:bg-white/5 transition-colors" type="button">
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => { setEditingChat(chat); setAddingChat(false); }} type="button"
                            className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/5 transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteChat(chat.id, chat.label)} type="button"
                            className="p-1.5 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* فورم إضافة حساب جديد */}
                {addingChat && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                    <p className="text-white/50 text-xs font-medium">➕ إضافة حساب جديد</p>
                    <input value={chatForm.label} onChange={(e) => setChatForm({ ...chatForm, label: e.target.value })}
                      placeholder="اسم مألوف — مثال: أنا، موظف المبيعات، مجموعة الفريق"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-white/25" />
                    <input value={chatForm.chatId} onChange={(e) => setChatForm({ ...chatForm, chatId: e.target.value })}
                      placeholder="Chat ID الرقمي — مثال: 5395247315"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-xs placeholder-white/25 focus:outline-none focus:border-white/25 font-mono" />
                    <label className="flex items-center gap-2 text-white/50 text-xs cursor-pointer">
                      <input type="checkbox" checked={chatForm.isDefault} onChange={(e) => setChatForm({ ...chatForm, isDefault: e.target.checked })} className="rounded" />
                      ⭐ جعله الحساب الافتراضي (التنبيهات التلقائية تيجي عليه)
                    </label>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddChat} disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs hover:bg-emerald-500/30 transition-colors disabled:opacity-40">
                        <Plus className="w-3.5 h-3.5" /> إضافة
                      </button>
                      <button onClick={() => setAddingChat(false)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-white/50 rounded-lg text-xs hover:bg-white/10 transition-colors">
                        <X className="w-3.5 h-3.5" /> إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {atMax && <p className="text-center text-rose-400/60 text-[10px] pt-1">وصلت للحد الأقصى ({MAX_CHATS} حسابات)</p>}
              </div>
            </section>

            {/* ══════════════════════════════════════
                SECTION 4 — رسالة تجريبية
            ══════════════════════════════════════ */}
            <section className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-white text-sm font-semibold">الخطوة ٣ — اختبر إن كل حاجة شغالة</h3>
                <InfoTip>
                  <p className="font-semibold text-white/80 mb-1">استخدمها بعد ما تضيف حساب جديد</p>
                  <p>بتبعت رسالة تجريبية على أي حساب من القائمة عشان تتأكد إن التنبيهات هتوصل فعلاً.</p>
                  <p className="mt-1">✅ وصلت = كل حاجة تمام</p>
                  <p>❌ ما وصلتش = في مشكلة في الـ Chat ID أو الـ Token</p>
                </InfoTip>
              </div>

              <GuideBox title="📖 خطوات الاختبار — ٣٠ ثانية بس">
                <p>1️⃣ اختر اسم الحساب اللي أضفته من القائمة أدناه.</p>
                <p>2️⃣ اضغط "إرسال رسالة تجريبية".</p>
                <p>3️⃣ افتح تليجرام — لو وصلتك رسالة من البوت ✅ كل حاجة شغالة.</p>
                <p className="font-semibold text-white/80 mt-1">لو ما وصلتش — تحقق من:</p>
                <p>• إنك بعتت <span className="font-mono text-emerald-400">/start</span> للبوت من حسابك الشخصي</p>
                <p>• إن الـ Chat ID منسوخ صح (ما فيهوش مسافة)</p>
                <p>• إن الـ Token محفوظ صح (راجع قسم الخطوة ١)</p>
              </GuideBox>

              <div className="space-y-2">
                <label className="text-white/50 text-xs">اختر الحساب المستهدف</label>
                <select value={testChatId} onChange={(e) => setTestChatId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/25 appearance-none">
                  <option value="" className="bg-[#0f0f0f]">
                    {chats.find((c) => c.isDefault) ? `⭐ الافتراضي — ${chats.find((c) => c.isDefault)?.label}` : "-- اختر حساباً --"}
                  </option>
                  {chats.map((c) => (
                    <option key={c.id} value={c.chatId} className="bg-[#0f0f0f]">
                      {c.isDefault ? "⭐ " : ""}{c.label}
                    </option>
                  ))}
                </select>
                {chats.length === 0 && (
                  <p className="text-white/30 text-xs">أضف حساباً أولاً من القسم أعلاه</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-white/50 text-xs">نص الرسالة (اتركه فارغاً لإرسال رسالة تلقائية)</label>
                <textarea value={testMsg} onChange={(e) => setTestMsg(e.target.value)} rows={2}
                  placeholder="اكتب أي رسالة تجريبية هنا — أو اتركها فارغة..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/25 resize-none" />
              </div>

              <button onClick={handleTestMessage} disabled={testLoading || chats.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#C5A059]/20 text-[#C5A059] border border-[#C5A059]/20 rounded-xl text-sm font-medium hover:bg-[#C5A059]/30 transition-colors disabled:opacity-40">
                {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                إرسال رسالة تجريبية
              </button>

              {testResult && (
                <div className={`flex items-start gap-2 px-4 py-3 rounded-xl text-xs ${
                  testResult.ok ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/15" : "bg-rose-500/10 text-rose-300 border border-rose-500/15"
                }`}>
                  {testResult.ok ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{testResult.text}</span>
                </div>
              )}
            </section>

            {/* ══════════════════════════════════════
                SECTION 5 — منطقة الخطر
            ══════════════════════════════════════ */}
            <section className="bg-rose-500/5 border border-rose-500/15 rounded-2xl p-5">
              <h3 className="text-rose-400 text-sm font-semibold mb-2">منطقة الخطر</h3>
              <p className="text-white/40 text-xs mb-4">
                حذف كل إعدادات تليجرام من قاعدة البيانات (Token + كل الحسابات). بعد الحذف، النظام هيرجع يقرأ من متغيرات البيئة لو موجودة.
              </p>
              <button type="button" disabled={saving}
                onClick={async () => {
                  if (!confirm("تأكيد حذف جميع إعدادات تليجرام؟ لا يمكن التراجع عن هذا.")) return;
                  setSaving(true);
                  try {
                    const res = await fetch("/api/admin/telegram/config", { method: "DELETE" });
                    const d = await res.json();
                    if (d.success) { await fetchConfig(); showToast(true, "تم حذف جميع الإعدادات"); }
                    else showToast(false, d.error || "فشل الحذف");
                  } finally { setSaving(false); }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-medium hover:bg-rose-500/20 transition-colors disabled:opacity-40">
                <Trash2 className="w-3.5 h-3.5" />
                حذف جميع الإعدادات
              </button>
            </section>

          </>)}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.01] shrink-0">
          <p className="text-white/20 text-[10px] text-center">
            الإعدادات محفوظة في قاعدة البيانات — اضغط ⓘ على أي عنوان لشرح مفصل
          </p>
        </div>
      </div>
    </div>
  );
}
