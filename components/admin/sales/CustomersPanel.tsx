"use client";

/**
 * The customers employee — moved out of the stacked sales page on 2026-09-29.
 *
 * This is a pure transfer: the body is the tab that used to live at
 * `app/admin/sales/page.tsx:584-1396`, line for line. It is the first employee the
 * consolidation program moves after the contract froze, and it moves alone on
 * purpose — the page it came from holds four other things that belong to other
 * offices. Read `docs/ledger/contract.md` section ١٠ before adding capability here.
 */
import { useState, useEffect } from "react";
import { Brain, Check, Send, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { summarizeInterest } from "@/lib/lead-insights";
import { LEDGER_LABELS, LEDGER_ORDER, type LedgerTotals } from "@/lib/leads-delete-guard";
import { hoursSinceLastTouch, freshnessOf, needsReplyNow, type FreshnessKey } from "@/lib/leads-freshness";

/** The cold clock's colours — the badge a customer wears for how long he has waited. */
const FRESHNESS_STYLE: Record<FreshnessKey, string> = {
  hot: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  warm: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  cold: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  lost: "border-red-500/30 bg-red-500/10 text-red-300",
  unknown: "border-white/10 bg-white/5 text-white/40",
};

interface Lead {
  id: string;
  session_id?: string | null;
  name: string;
  email?: string;
  phone: string;
  roomType?: string;
  budget?: string;
  location?: string;
  bestTime?: string;
  summary?: string;
  tier: "diamond" | "gold" | "silver" | "bronze";
  score?: number;
  status: string;
  /** The profile rows behind this customer — the only thing an order may be attached to. */
  profile_ids?: string[];
  money?: { quoted: number; paid: number };
  spaces?: string[];
  created_at: string;
  messages?: Array<{ role: string; content: string; source?: string; timestamp?: string }>;
  telemetry?: {
    current_path?: string;
    attention_score?: number;
    hovered_elements?: string[];
    updated_at?: string;
  };
  ui_state?: {
    isFrozen?: boolean;
    lastOffer?: string;
    typing_preview?: string;
    takeover_active?: boolean;
    takeover_started_at?: string;
    handoff_to_human?: boolean;
  };
}

/** An order the ledger holds but nobody owns yet — money waiting for a name. */
interface UnownedOrder {
  id: string;
  name: string | null;
  quoted: number;
  paid: number;
}

function FreshnessBadge({ lead }: { lead: Lead }) {  const f = freshnessOf(hoursSinceLastTouch(lead));
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] border ${FRESHNESS_STYLE[f.key]}`}>
      {f.label}
    </span>
  );
}

export default function CustomersPanel() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "diamond" | "gold" | "silver" | "bronze">("all");
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const [unowned, setUnowned] = useState<UnownedOrder[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  const loadLeads = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await fetch("/api/admin/leads");
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
        setUnowned(data.unownedOrders || []);
      }
    } catch (error) {
      console.error("Failed to load leads:", error);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
    const interval = setInterval(() => loadLeads(true), 3000); // Live sync every 3s
    return () => clearInterval(interval);
  }, []);

  // Attaching an order to a person is the owner's call, never a guess: this sends the one
  // pair he picked, and the door refuses anything that is not a real order and a real profile.
  const linkOrder = async (orderId: string, profileId: string) => {
    setLinking(orderId);
    try {
      const res = await fetch("/api/admin/customers/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, userId: profileId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "الربط ما اتكتبش");
      toast.success(profileId ? "الأمر بقى مسجل باسم العميل" : "الربط اتشال");
      await loadLeads(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "الربط ما اتكتبش");
    } finally {
      setLinking(null);
    }
  };

  const waitingCount = leads.filter((l) => needsReplyNow(hoursSinceLastTouch(l))).length;
  // The waiting list leads with whoever has been ignored longest; a customer with no
  // date sorts last rather than pretending to be new.
  const filteredLeads = leads
    .filter((l) => filter === "all" || l.tier === filter)
    .filter((l) => !onlyWaiting || needsReplyNow(hoursSinceLastTouch(l)))
    .sort((a, b) => freshnessOf(hoursSinceLastTouch(b)).rank - freshnessOf(hoursSinceLastTouch(a)).rank);

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

  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [showChatFor, setShowChatFor] = useState<string | null>(null);
  const [directReply, setDirectReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [copilotFor, setCopilotFor] = useState<string | null>(null);
  const [copilotSuggestions, setCopilotSuggestions] = useState<string[]>([]);
  const [isLoadingCopilot, setIsLoadingCopilot] = useState(false);
  const [followUpFor, setFollowUpFor] = useState<string | null>(null);
  const [followUpTemplate, setFollowUpTemplate] = useState("");
  const [isLoadingFollowUp, setIsLoadingFollowUp] = useState(false);
  const [analysisFor, setAnalysisFor] = useState<string | null>(null);
  const [analysisProfile, setAnalysisProfile] = useState<Record<string, string> | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState<{ keys: string[]; ledgers: LedgerTotals | null } | null>(null);
  const searchParams = useSearchParams();
  useEffect(() => {
    const expandParam = searchParams?.get("expand");
    if (expandParam) {
      setExpandedLead(expandParam);
    }
  }, [searchParams]);

  const toggleSelectLead = (leadId: string) => {
    if (!leadId) return;
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId) 
        : [...prev, leadId]
    );
  };

  const deleteLeads = async (ids: (string | undefined)[]) => {
    const validIds = ids.filter(Boolean) as string[];
    if (validIds.length === 0) {
      toast.error("⚠️ لم يتم تحديد أي معرفات صالحة");
      return;
    }

    // The count is measured before anything is asked for, so the owner confirms a number
    // and not a feeling.
    setDeleteAsk({ keys: validIds, ledgers: null });
    try {
      const res = await fetch("/api/admin/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: validIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.preview) {
        setDeleteAsk(null);
        toast.error(data.error || "فشل حساب السجلات قبل الحذف");
        return;
      }
      setDeleteAsk({ keys: validIds, ledgers: data.ledgers });
    } catch (err) {
      console.error("Delete preview failed:", err);
      setDeleteAsk(null);
      toast.error("خطأ في الاتصال بالخادم");
    }
  };

  const confirmDeleteLeads = async () => {
    if (!deleteAsk || !deleteAsk.ledgers || deleteAsk.ledgers.total === 0) return;
    const expectedRows = deleteAsk.ledgers.total;
    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: deleteAsk.keys, confirm: true, expectedRows }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.ledgers) setDeleteAsk({ keys: deleteAsk.keys, ledgers: data.ledgers });
        toast.error(data.error || "الحذف اترفض — عدد السجلات مش مطابق");
        return;
      }
      setDeleteAsk(null);
      setSelectedLeads([]);
      await loadLeads(true);
      if (data.verified) {
        toast.success(`تم مسح ${data.deletedTotal} سجل — مطابق للعدد اللي أكدته`);
      } else {
        toast.error(`المسح اتعمل بس العدد مش مطابق: ${data.deletedTotal} من ${expectedRows}`);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("خطأ في الاتصال بالخادم — السجلات ممكن تكون لسه موجودة");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadCopilotSuggestions = async (lead: Lead) => {
    const leadKey = lead.session_id || lead.id;
    setCopilotFor(leadKey);
    setIsLoadingCopilot(true);
    try {
      const res = await fetch("/api/admin/leads/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load suggestions");
      setCopilotSuggestions(data.suggestions || []);
    } catch (err) {
      console.error("Failed to load copilot suggestions:", err);
      setCopilotSuggestions([]);
      toast.error("فشل تحميل اقتراحات المساعد");
    } finally {
      setIsLoadingCopilot(false);
    }
  };

  const normalizeWhatsAppPhone = (phone: string) => {
    const digits = (phone || "").replace(/\D/g, "");
    if (!digits || digits.length < 10) return "";
    if (digits.startsWith("20")) return digits;
    if (digits.startsWith("0")) return `20${digits.slice(1)}`;
    return digits;
  };

  // آخر نشاط حقيقي للعميل: آخر توقيت رسالة (ولو من المستشار/الإدارة)، وإلا تاريخ الإنشاء.
  const lastLeadActivity = (lead: Lead): number => {
    let latest = new Date(lead.created_at).getTime();
    if (!Number.isNaN(latest)) {
      (lead.messages || []).forEach((m) => {
        if (m.timestamp) {
          const t = new Date(m.timestamp).getTime();
          if (!Number.isNaN(t) && t > latest) latest = t;
        }
      });
    }
    return Number.isNaN(latest) ? Date.now() : latest;
  };

  const isDormantLead = (lead: Lead) =>
    Date.now() - lastLeadActivity(lead) >= 24 * 60 * 60 * 1000;

  const generateFollowUp = async (lead: Lead) => {
    const leadKey = lead.session_id || lead.id;
    setFollowUpFor(leadKey);
    setIsLoadingFollowUp(true);
    try {
      const res = await fetch("/api/admin/leads/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate follow-up");
      setFollowUpTemplate(data.template || "");
    } catch (err) {
      console.error("Failed to generate follow-up:", err);
      setFollowUpTemplate("");
      toast.error("فشل توليد متابعة واتساب");
    } finally {
      setIsLoadingFollowUp(false);
    }
  };

  const analyzeLead = async (lead: Lead) => {
    const leadKey = lead.session_id || lead.id;
    if (analysisFor === leadKey && analysisProfile) {
      setAnalysisFor(null);
      return;
    }
    setAnalysisFor(leadKey);
    setAnalysisProfile(null);
    setIsLoadingAnalysis(true);
    try {
      const res = await fetch("/api/admin/leads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze lead");
      setAnalysisProfile(data.profile || {});
    } catch (err) {
      console.error("Failed to analyze lead:", err);
      setAnalysisProfile(null);
      toast.error("فشل التحليل الذكي");
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  const sendDirectReply = async (sessionId: string) => {
    if (!directReply.trim()) return;
    const cleanDirectReply = directReply.trim();
    setIsSendingReply(true);
    try {
      const res = await fetch("/api/admin/leads/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: cleanDirectReply })
      });
      if (res.ok) {
        // Optimistically update the UI without injecting a client-facing prefix.
        setLeads(leads.map(l => {
          if ((l.session_id || l.id) === sessionId && l.messages) {
            return {
              ...l,
              messages: [...l.messages, {
                role: "assistant",
                content: cleanDirectReply,
                source: "admin",
                timestamp: new Date().toISOString(),
              }]
            };
          }
          return l;
        }));
        setDirectReply("");
      }
    } catch (e) {
      console.error("Failed to send reply:", e);
    } finally {
      setIsSendingReply(false);
    }
  };

  const isAdminMessage = (msg: { content?: string; source?: string }) =>
    msg.source === "admin" || msg.content?.includes("[تدخل الإدارة]") || msg.content?.includes("[ØªØ¯Ø®Ù„ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©]");

  const setTakeover = async (lead: Lead, active: boolean) => {
    const leadKey = lead.session_id || lead.id;
    try {
      const res = await fetch("/api/admin/leads/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: leadKey, active }),
      });
      if (res.ok) {
        // Optimistically flip local state; the 3s leads poll keeps it in sync.
        setLeads(prev => prev.map(l => {
          if ((l.session_id || l.id) !== leadKey) return l;
          return {
            ...l,
            ui_state: {
              ...(l.ui_state || {}),
              takeover_active: active,
              ...(active ? { takeover_started_at: new Date().toISOString() } : {}),
            },
          };
        }));
        toast.success(active ? "🎮 تم تفعيل التحكم اليدوي - الـ AI متوقف" : "🤖 تم تسليم المحادثة للـ AI");
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "فشل تغيير وضع التحكم");
      }
    } catch (e) {
      console.error("Failed to set takeover state:", e);
      toast.error("خطأ في الاتصال بالخادم");
    }
  };

  const getDisplayMessage = (msg: { content?: string }) =>
    (msg.content || "")
      .replace(/^👨‍💼\s*\[تدخل الإدارة\]:\s*/u, "")
      .replace(/^ðŸ‘¨â€ðŸ’¼\s*\[ØªØ¯Ø®Ù„ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©\]:\s*/u, "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">العملاء المحتملين</h2>
          <p className="text-sm text-[#C5A059]">مركز التحكم الكامل بالعملاء</p>
        </div>
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

      {/* The cold clock: who is waiting for an answer right now. */}
      <div className="mt-4 mb-2 flex items-center gap-3">
        <button
          onClick={() => setOnlyWaiting((v) => !v)}
          className={`rounded-full border px-4 py-1.5 text-xs font-bold transition ${
            onlyWaiting
              ? "border-red-500/40 bg-red-500/15 text-red-300"
              : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
          }`}
        >
          محتاجين رد دلوقتى · {loading ? "--" : waitingCount}
        </button>
        <p className="text-[11px] text-white/35">
          البارد يعني أكثر من يوم من غير رد، والبيضيع يعني أسبوعًا. من غير تاريخ يعني ما عرفتش — مش يعني جديد.
        </p>
      </div>

      {/* Orders whose money has no owner yet. Shown as what they are — a receipt waiting
          for a name — instead of being invented into a customer by a typed string. */}
      {unowned.length > 0 && (
        <div className="mb-4 space-y-3 rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-[#C5A059]">أوامر بيع لسه مربوطش بعميل · {unowned.length}</p>
            <p className="text-[11px] text-white/40">اختار صاحب الأمر بنفسك — مفيش حاجة بربط بالاسم لوحده</p>
          </div>
          {unowned.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <span className="text-sm text-white/80">{order.name || "أمر بلا اسم"}</span>
              <span className="text-xs text-white/50" dir="ltr">{order.quoted.toLocaleString("en-EG")} ج</span>
              {order.paid > 0 && (
                <span className="text-xs text-emerald-300" dir="ltr">مقبوض {order.paid.toLocaleString("en-EG")} ج</span>
              )}
              <select
                value=""
                disabled={linking === order.id}
                onChange={(e) => linkOrder(order.id, e.target.value)}
                className="ms-auto rounded-lg border border-white/10 bg-black/50 px-2 py-1 text-xs text-white/80 disabled:opacity-50"
              >
                <option value="">{linking === order.id ? "بربط..." : "اختار العميل"}</option>
                {leads
                  .filter((l) => (l.profile_ids?.length ?? 0) > 0)
                  .map((l) => (
                    <option key={l.id} value={l.profile_ids?.[0]}>
                      {l.name}
                      {l.phone && l.phone !== "غير متوفر" ? ` — ${l.phone}` : ""}
                    </option>
                  ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedLeads.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
          <p className="text-sm text-red-200">تم تحديد {selectedLeads.length} من العملاء</p>
          <button 
            onClick={() => deleteLeads(selectedLeads)}
            disabled={isDeleting}
            className="relative z-[9999] px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-red-600/40"
            style={{ cursor: 'pointer !important', pointerEvents: 'auto' }}
          >
            {isDeleting ? "جاري التنفيذ..." : "🗑️ حذف المحدد نهائياً"}
          </button>
        </div>
      )}

      {/* Leads List */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/60">جاري التحميل...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-8 text-center text-white/60">لا يوجد عملاء في هذا التصنيف</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="flex flex-col">
                <div 
                  className={`flex items-center justify-between p-4 hover:bg-white/[0.02] cursor-pointer transition-colors ${selectedLeads.includes(lead.session_id || lead.id) ? 'bg-white/[0.05]' : ''}`}
                >
                  <div className="flex items-center gap-4 flex-1" onClick={() => setExpandedLead(expandedLead === lead.session_id ? null : (lead.session_id || lead.id))}>
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectLead(lead.session_id || lead.id);
                      }}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors cursor-pointer ${selectedLeads.includes(lead.session_id || lead.id) ? 'bg-[#C5A059] border-[#C5A059]' : 'border-white/20 hover:border-[#C5A059]/50'}`}
                      style={{ cursor: 'pointer' }}
                    >
                      {selectedLeads.includes(lead.session_id || lead.id) && <Check className="w-3 h-3 text-black" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{lead.name}</p>
                        {lead.ui_state?.typing_preview && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full animate-pulse">
                            <Brain className="w-2.5 h-2.5 text-purple-400" />
                            <span className="text-[9px] text-purple-300 font-bold uppercase tracking-tighter">PRE-COG</span>
                          </div>
                        )}
                        {lead.ui_state?.handoff_to_human && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded-full animate-pulse">
                            <span className="text-[9px] text-red-300 font-bold uppercase tracking-tighter">HUMAN</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-white/50">
                        {lead.ui_state?.typing_preview ? (
                          <span className="text-purple-300 italic">" {lead.ui_state.typing_preview} ... "</span>
                        ) : (
                          `${lead.roomType} | ${lead.phone}`
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs border ${tierColors[lead.tier as keyof typeof tierColors] || tierColors.bronze}`}>
                      {lead.tier === "diamond" ? "ماسي" : lead.tier === "gold" ? "ذهبي" : lead.tier === "silver" ? "فضي" : "برونزي"}
                    </span>
                    <FreshnessBadge lead={lead} />
                    <span className="text-sm text-white/60">{new Date(lead.created_at).toLocaleDateString("ar-EG")}</span>
                     {!lead.session_id ? null : (
                     <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLeads([lead.session_id as string]);
                      }}
                      className="relative z-[9999] p-3 text-red-500/40 hover:text-red-500 transition-colors"
                      style={{ cursor: 'pointer !important', pointerEvents: 'auto' }}
                    >
                      <Trash2 className="w-5 h-5" />
                     </button>
                     )}
                  </div>
                </div>
                
                {/* Expanded Details */}
                {(expandedLead !== null && (expandedLead === lead.session_id || expandedLead === lead.id)) && (
                  <div className="p-4 bg-black/40 border-t border-white/5 space-y-4">
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <p className="text-white/40">الميزانية: <span className="text-white font-medium">{lead.budget || "غير محدد"}</span></p>
                        <p className="text-white/40">الطلب: <span className="text-white font-medium">{lead.roomType || "غير محدد"}</span></p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-white/40">المكان: <span className="text-white font-medium">{lead.location || "غير محدد"}</span></p>
                        <p className="text-white/40">وقت الاتصال: <span className="text-white font-medium">{lead.bestTime || "غير محدد"}</span></p>
                      </div>
                    </div>
                    {lead.money && lead.money.quoted > 0 && (
                      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2">
                        <p className="text-xs text-[#C5A059] mb-1">حسابه عندك:</p>
                        <p className="text-sm text-white/85">
                          إجمالي الأوامر <span className="font-bold" dir="ltr">{lead.money.quoted.toLocaleString("en-EG")} ج</span>
                          {" — "}
                          المستلم <span className="font-bold text-emerald-300" dir="ltr">{lead.money.paid.toLocaleString("en-EG")} ج</span>
                        </p>
                      </div>
                    )}
                    {lead.summary && (
                      <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <p className="text-xs text-[#C5A059] mb-1">ملخص الذكاء الاصطناعي:</p>
                        <p className="text-sm text-white/80">{lead.summary}</p>
                      </div>
                    )}
                    
                    {/* Reality Engine Telemetry Radar */}
                    {lead.telemetry && (
                      <div className="p-3 bg-blue-900/10 rounded-lg border border-blue-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent animate-pulse" />
                        <div className="flex items-center gap-2 mb-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                          </span>
                          <p className="text-xs font-bold text-blue-400 tracking-wider">رادار الاستشعار الحي (Telemetry)</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                          <div>
                            <p className="text-white/40 text-xs">معدل الانتباه (Attention)</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 transition-all duration-500" 
                                  style={{ width: `${Math.min(lead.telemetry.attention_score || 0, 100)}%` }}
                                />
                              </div>
                              <span className="text-blue-300 text-xs font-bold">{Math.round(lead.telemetry.attention_score || 0)}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-white/40 text-xs">الصفحة الحالية</p>
                            <p className="text-white/90 text-xs truncate mt-1 bg-black/30 px-2 py-1 rounded border border-white/5" dir="ltr">
                              {lead.telemetry.current_path || "/"}
                            </p>
                          </div>
                        </div>
                        {lead.telemetry.hovered_elements && lead.telemetry.hovered_elements.length > 0 && (() => {
                          const interest = summarizeInterest(lead.telemetry.hovered_elements);
                          return (
                            <div className="mt-3 space-y-2">
                              <p className="text-white/40 text-xs">نقاط اهتمام الرادار:</p>
                              <div className="flex flex-wrap gap-1">
                                {interest.all.map((tag: string, idx: number) => (
                                  <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[10px]">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                              {interest.top.length > 0 && (
                                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                                  <p className="text-[11px] text-cyan-300">
                                    <span className="font-bold">الأكثر لفتًا للانتباه: </span>
                                    {interest.top.join("، ")}
                                  </p>
                                </div>
                              )}
                              {interest.styleGuess && (
                                <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2">
                                  <p className="text-[11px] text-purple-300">
                                    <span className="font-bold">الطراز المتوقع: </span>
                                    {interest.styleGuess}
                                  </p>
                                </div>
                              )}
                              <button
                                onClick={() => analyzeLead(lead)}
                                disabled={isLoadingAnalysis && analysisFor === (lead.session_id || lead.id)}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-fuchsia-600/20 hover:bg-fuchsia-600/40 border border-fuchsia-500/40 text-fuchsia-300 text-xs font-bold py-2 transition disabled:opacity-50"
                              >
                                <Brain size={14} />
                                {isLoadingAnalysis && analysisFor === (lead.session_id || lead.id) ? "جارٍ التحليل..." : (analysisFor === (lead.session_id || lead.id) && analysisProfile ? "إخفاء التحليل" : "تحليل ذكي عميق")}
                              </button>
                              {analysisFor === (lead.session_id || lead.id) && analysisProfile && (
                                <div className="space-y-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-3 text-[11px] leading-relaxed">
                                  {[
                                    { key: "interests", label: "الاهتمامات", icon: "🎯" },
                                    { key: "style", label: "الطراز والألوان", icon: "🎨" },
                                    { key: "personality", label: "الشخصية", icon: "🧬" },
                                    { key: "psychology", label: "الحالة النفسية", icon: "🧠" },
                                    { key: "buying_signals", label: "إشارات الشراء", icon: "🛒" },
                                    { key: "recommended_approach", label: "الخطوة الموصى بها", icon: "🤝" },
                                    { key: "score_guide", label: "مؤشر التحويل", icon: "📊" },
                                  ].map(({ key, label, icon }) => {
                                    const val = analysisProfile[key] || analysisProfile[`${key}_ar`] || "";
                                    if (!val) return null;
                                    return (
                                      <div key={key}>
                                        <p className="font-bold text-fuchsia-300">{icon} {label}:</p>
                                        <p className="text-white/80">{val}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                    {isDormantLead(lead) && (
                      <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                        <p className="text-sm font-bold text-orange-300">هذا العميل خامل منذ أكثر من 24 ساعة — أنسب وقت لمتابعة واتساب.</p>
                        <p className="text-xs text-orange-200/60 mt-0.5">اضغط "متابعة واتساب" تحت لتوليد رسالة مخصصة.</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {/^01\d{9}$/.test(lead.phone || "") ? (
                      <a 
                        href={`https://wa.me/20${lead.phone.startsWith('0') ? lead.phone.substring(1) : lead.phone}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg flex items-center gap-2 transition"
                      >
                        📱 تواصل عبر واتساب
                      </a>
                      ) : (
                        <p className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-white/50">
                          {lead.email ? `مفيش رقم مسجل — البريد: ${lead.email}` : "مفيش وسيلة تواصل مسجلة — وصل من غير ما يسيب رقم"}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                        <button 
                          onClick={() => generateFollowUp(lead)}
                          disabled={isLoadingFollowUp}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50"
                        >
                          {isLoadingFollowUp ? "⏳ جارٍ التوليد..." : "📱 متابعة واتساب"}
                        </button>
                        {lead.session_id ? (
                        <button 
                          onClick={() => setShowChatFor(showChatFor === lead.id ? null : lead.id)}
                          className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition"
                        >
                          💬 {showChatFor === lead.id ? "إخفاء المحادثة" : "المحادثة الأصلية"}
                        </button>
                        ) : (
                          <p className="px-4 py-1.5 text-xs text-white/40">مفيش محادثة — أول كلام معاه هيبدأ من عندك</p>
                        )}
                      </div>
                    </div>

                    {followUpFor === (lead.session_id || lead.id) && followUpTemplate && (
                      <div className="mt-4 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                        <p className="text-xs font-bold text-emerald-300">رسالة متابعة واتساب المقترحة:</p>
                        <textarea
                          readOnly
                          value={followUpTemplate}
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white/90 min-h-[120px] outline-none"
                        />
                        <div className="flex gap-2">
                          {/^01\d{9}$/.test(lead.phone || "") ? (
                          <a
                            href={`https://wa.me/${normalizeWhatsAppPhone(lead.phone) || lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(followUpTemplate)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 text-center rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-bold text-white transition"
                          >
                            فتح واتساب
                          </a>
                          ) : (
                            <p className="flex-1 rounded-lg border border-white/10 px-4 py-2 text-center text-sm text-white/50">
                              مفيش رقم يفتح واتساب — انسخ الرسالة وابعتهالها من عندك
                            </p>
                          )}
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(followUpTemplate).then(() => toast.success("تم نسخ الرسالة"));
                            }}
                            className="flex-1 rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-bold text-white transition"
                          >
                            نسخ الرسالة
                          </button>
                        </div>
                      </div>
                    )}

                    {showChatFor === lead.id && lead.session_id && lead.messages && (
                      <div className="mt-4 p-4 rounded-xl border border-white/10 bg-black/50 space-y-4">
                        {/* SEAMLESS TAKEOVER MODE BANNER */}
                        {lead.ui_state?.takeover_active ? (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                              </span>
                              <div>
                                <p className="text-sm font-bold text-red-300">وضع التحكم اليدوي مفعّل</p>
                                <p className="text-xs text-red-200/70">
                                  الـ AI متوقف عن الرد وأنت تقود المحادثة الآن. رسائل العميل تصل لك مباشرة هنا.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setTakeover(lead, false)}
                              className="rounded-lg bg-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-400 transition"
                            >
                              🤖 تسليم للـ AI
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
                            <p className="text-xs text-white/50">الذكاء الاصطناعي يرد على العميل تلقائيًا.</p>
                            <button
                              onClick={() => setTakeover(lead, true)}
                              className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 px-4 py-2 text-xs font-bold text-[#C5A059] hover:bg-[#C5A059]/20 transition"
                            >
                              🎮 تحكم يدوي
                            </button>
                          </div>
                        )}

                        <div className="rounded-xl border border-[#C5A059]/40 bg-gradient-to-l from-[#C5A059]/15 to-black/30 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-[#C5A059] uppercase tracking-wide">🪪 الملف الشخصي للمشتري</p>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lead.score && lead.score > 70 ? "bg-emerald-500/20 text-emerald-300" : lead.score && lead.score > 30 ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/50"}`}>
                              نية الشراء: {lead.score ?? "—"}/100
                            </span>
                          </div>
                          <div className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                            <div>
                              <p className="text-[10px] text-white/40">الاسم</p>
                              <p className="text-xs font-bold text-white">{lead.name || "غير معروف"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40">الهاتف</p>
                              <p className="text-xs text-white/80" dir="ltr">{lead.phone || "—"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40">المشروع</p>
                              <p className="text-xs text-white/80">{lead.roomType || "غير محدد"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40">الميزانية</p>
                              <p className="text-xs text-white/80">{lead.budget || "غير محدد"}</p>
                            </div>
                          </div>
                          {lead.location && (
                            <div className="mt-2">
                              <p className="text-[10px] text-white/40">الموقع</p>
                              <p className="text-xs text-white/80">{lead.location}</p>
                            </div>
                          )}
                          {lead.summary && (
                            <div className="mt-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                              <p className="text-[10px] text-white/40 mb-0.5">خلاصة المحادثة (AI)</p>
                              <p className="text-[11px] leading-relaxed text-white/80">{lead.summary}</p>
                            </div>
                          )}
                        </div>

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                          <div>
                            <div className="max-h-[300px] overflow-y-auto space-y-3 p-2">
                              {lead.messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-[#C5A059]/20 text-white' : isAdminMessage(msg) ? 'bg-red-500/20 text-red-100 border border-red-500/30' : 'bg-white/10 text-white/90'}`}>
                                    <span className="block text-xs text-white/40 mb-1">
                                      {msg.role === 'user' ? lead.name : isAdminMessage(msg) ? 'أنت (الإدارة)' : 'المستشار الذكي'}
                                    </span>
                                    {getDisplayMessage(msg)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <aside className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/5 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold text-[#C5A059] uppercase tracking-wide">AI Copilot</p>
                                <p className="text-[11px] text-white/40">اقتراحات الاستجابة</p>
                              </div>
                              <button
                                onClick={() => loadCopilotSuggestions(lead)}
                                disabled={isLoadingCopilot}
                                className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/70 hover:bg-white/10 disabled:opacity-50"
                              >
                                {isLoadingCopilot ? "..." : "تحديث"}
                              </button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {isLoadingCopilot ? (
                                <div className="text-xs text-white/50">جاري توليد المقترحات...</div>
                              ) : copilotFor === (lead.session_id || lead.id) && copilotSuggestions.length > 0 ? (
                                copilotSuggestions.map((suggestion, idx) => (
                                  <button
                                    key={`${suggestion}-${idx}`}
                                    onClick={() => {
                                      setDirectReply(suggestion);
                                      toast.success("تم نسخ اقتراح الرد");
                                    }}
                                    className="block w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-left text-[11px] text-white/80 hover:bg-[#C5A059]/10 hover:text-white transition"
                                  >
                                    {suggestion}
                                  </button>
                                ))
                              ) : (
                                <button
                                  onClick={() => loadCopilotSuggestions(lead)}
                                  className="w-full rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 px-2 py-2 text-[11px] text-[#C5A059] hover:bg-[#C5A059]/20"
                                >
                                  تحميل اقتراحات المساعد
                                </button>
                              )}
                            </div>
                          </aside>
                        </div>
                        
                        <div className="flex gap-2 border-t border-white/10 pt-4 mt-2">
                          <input
                            type="text"
                            placeholder="اكتب رسالة للعميل مباشرة وسيراها فوراً..."
                            value={directReply}
                            onChange={(e) => setDirectReply(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && directReply.trim() && !isSendingReply) {
                                sendDirectReply(lead.session_id || lead.id);
                              }
                            }}
                            className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white focus:border-[#C5A059] focus:outline-none"
                          />
                          <button
                            disabled={isSendingReply || !directReply.trim()}
                            onClick={() => sendDirectReply(lead.session_id || lead.id)}
                            className="px-4 py-2 bg-[#C5A059] text-[#1a1a1a] font-medium rounded-lg disabled:opacity-50 transition flex items-center gap-2"
                          >
                            <Send className="w-4 h-4" />
                            {isSendingReply ? "جاري..." : "إرسال للعميل"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteAsk && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/85 p-4" dir="rtl">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-500/40 bg-[#141414] p-6">
            <p className="text-sm font-bold text-red-300">تأكيد الحذف النهائي</p>
            {!deleteAsk.ledgers ? (
              <p className="text-sm text-white/60">جاري حساب السجلات المرتبطة...</p>
            ) : deleteAsk.ledgers.total === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-white/70">مفيش سجلات مطابقة — يمكن تكون اتشالت قبل كده.</p>
                <button
                  onClick={() => setDeleteAsk(null)}
                  className="w-full rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-white/80">
                  الحيده ده مربوط بـ <span className="font-bold text-red-300">{deleteAsk.ledgers.total}</span> سجل، وهيتمسح كله نهائي ومن غير رجعة:
                </p>
                <ul className="space-y-1">
                  {LEDGER_ORDER.filter((ledger) => (deleteAsk.ledgers?.[ledger] ?? 0) > 0).map((ledger) => (
                    <li key={ledger} className="flex items-center justify-between text-sm text-white/70">
                      <span>{LEDGER_LABELS[ledger]}</span>
                      <span className="font-bold text-white">{deleteAsk.ledgers?.[ledger]}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setDeleteAsk(null)}
                    className="flex-1 rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmDeleteLeads}
                    disabled={isDeleting}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {isDeleting ? "جاري التنفيذ..." : `أيوه، امسح الـ ${deleteAsk.ledgers.total}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
