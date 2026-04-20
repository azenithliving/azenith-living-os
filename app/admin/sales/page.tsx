"use client";
// Version: 2026-04-20_06:54_FORCE_FIX

import { useState, useEffect, useRef } from "react";
import { Shield, Users, Building2, Settings, FileText, Crown, Send, MessageCircle, TrendingUp, Edit2, Check, X, Trash2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import toast from "react-hot-toast";

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
  instruction: string;
  created_at: string;
}

interface PendingQuestion {
  id: string;
  question: string;
  session_id: string;
  status: string;
  created_at: string;
}

interface Lead {
  id: string;
  session_id?: string;
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
  created_at: string;
  messages?: Array<{ role: string; content: string; timestamp?: string }>;
  telemetry?: {
    current_path?: string;
    attention_score?: number;
    hovered_elements?: string[];
    updated_at?: string;
  };
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
  const [newInstruction, setNewInstruction] = useState("");
  const [savingInstruction, setSavingInstruction] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: "👋 أهلاً في لوحة قائد المبيعات!\n\n📚 يمكنك:\n• إضافة معلومات حقيقية في تبويب 'المعرفة' ليستخدمها المستشار\n• الرد على الأسئلة المعلقة في تبويب 'الأسئلة'\n\n✍️ اكتب أي رسالة لتدريب المستشار.",
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
      const response = await fetch("/api/consultant/learnings");
      if (response.ok) {
        const data = await response.json();
        setKnowledge(data.learnings || []);
      }
    } catch (error) {
      console.error("[SalesLeader] Error loading knowledge:", error);
    }
  };

  const loadPendingQuestions = async () => {
    try {
      const response = await fetch("/api/consultant/pending-questions");
      if (response.ok) {
        const data = await response.json();
        setPendingQuestions(data.questions || []);
      }
    } catch (error) {
      console.error("[SalesLeader] Error loading pending:", error);
    }
  };

  const saveInstruction = async () => {
    if (!newInstruction.trim()) return;
    setSavingInstruction(true);
    try {
      const res = await fetch("/api/consultant/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: newInstruction.trim() }),
      });
      if (res.ok) {
        setNewInstruction("");
        await loadKnowledge();
        setMessages(prev => [...prev, {
          role: "assistant",
          content: "✅ تم حفظ المعلومة بنجاح في قاعدة المعرفة. سيستخدمها المستشار من الآن.",
          timestamp: new Date().toISOString(),
        }]);
      }
    } catch (err) {
      console.error("Error saving:", err);
    } finally {
      setSavingInstruction(false);
    }
  };

  const answerQuestion = async (q: PendingQuestion) => {
    if (!answerText.trim()) return;
    const instruction = `سؤال: ${q.question}\nالإجابة: ${answerText.trim()}`;
    try {
      // 1. Save as learning so consultant learns for future
      await fetch("/api/consultant/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      // 2. Mark the pending question as answered WITH the reply
      //    so the visitor gets it automatically next time they open chat
      await fetch(`/api/consultant/pending-questions?id=${q.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answered_reply: answerText.trim() }),
      });
      setAnsweringId(null);
      setAnswerText("");
      await loadKnowledge();
      await loadPendingQuestions();
      alert("✅ تم حفظ الإجابة وتدريب المستشار. سيصل الرد للزائر تلقائياً!");
    } catch (err) {
      console.error("Error answering:", err);
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
          <h2 className="text-xl font-bold text-white">مدير المبيعات (ADMIN CONTROL v2.0)</h2>
          <p className="text-sm text-[#C5A059]">مركز التحكم بالمبيعات والمحادثات - تم تفعيل الحذف الفوري</p>
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
          {/* Add new instruction */}
          <div className="rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/5 p-4 space-y-3">
            <p className="text-sm text-[#C5A059] font-medium">➕ أضف معلومة جديدة للمستشار</p>
            <textarea
              value={newInstruction}
              onChange={(e) => setNewInstruction(e.target.value)}
              rows={3}
              placeholder="مثال: معرضنا يقع في التجمع الخامس، شارع التسعين. مواعيد العمل من 10 صباحاً حتى 10 مساءً."
              className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30 text-sm"
            />
            <button
              onClick={saveInstruction}
              disabled={savingInstruction || !newInstruction.trim()}
              className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] disabled:opacity-50"
            >
              {savingInstruction ? "جاري الحفظ..." : "💾 حفظ في المعرفة"}
            </button>
          </div>
          {/* Existing knowledge */}
          <div className="grid gap-3 md:grid-cols-2">
            {knowledge.length === 0 ? (
              <div className="col-span-full rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/60">
                لا توجد معلومات مسجلة بعد. أضف أول معلومة أعلاه!
              </div>
            ) : (
              knowledge.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm text-white leading-relaxed">{item.instruction}</p>
                  <p className="text-xs text-white/30 mt-2">{new Date(item.created_at).toLocaleDateString("ar-EG")}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeSubTab === "questions" && (
        <div className="space-y-4">
          <button onClick={loadPendingQuestions} className="text-sm text-[#C5A059] hover:underline">🔄 تحديث</button>
          {pendingQuestions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-white/60">
              ✅ لا توجد أسئلة معلقة. رائع!
            </div>
          ) : (
            pendingQuestions.map((q) => (
              <div key={q.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-amber-300 text-sm font-medium">❓ سؤال من عميل:</p>
                    <p className="text-white mt-1">{q.question}</p>
                    <p className="text-xs text-white/40 mt-1">{new Date(q.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                </div>
                {answeringId === q.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      rows={2}
                      placeholder="اكتب الإجابة الصحيحة هنا..."
                      className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm placeholder:text-white/30"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => answerQuestion(q)}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
                      >
                        ✅ حفظ الإجابة وتدريب المستشار
                      </button>
                      <button
                        onClick={() => { setAnsweringId(null); setAnswerText(""); }}
                        className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAnsweringId(q.id)}
                    className="rounded-lg bg-[#C5A059]/20 border border-[#C5A059]/30 px-4 py-2 text-sm text-[#C5A059] hover:bg-[#C5A059]/30"
                  >
                    ✍️ أجب على هذا السؤال
                  </button>
                )}
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

  const loadLeads = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await fetch("/api/admin/leads");
      if (response.ok) {
        const data = await response.json();
        setLeads(data.leads || []);
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

  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [showChatFor, setShowChatFor] = useState<string | null>(null);
  const [directReply, setDirectReply] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    const expandParam = searchParams.get("expand");
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

    // REMOVED confirm() to bypass potential browser blocks
    toast.success(`جاري محاولة حذف ${validIds.length} سجل...`);
    
    setIsDeleting(true);
    const toastId = toast.loading("🚀 جاري التنفيذ الفوري...");
    
    try {
      const res = await fetch("/api/admin/leads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: validIds })
      });
      
      if (res.ok) {
        setLeads(prev => prev.filter(l => !validIds.includes(l.session_id || "") && !validIds.includes(l.id)));
        setSelectedLeads([]);
        toast.success("تم الحذف بنجاح", { id: toastId });
      } else {
        toast.error("فشل في إكمال عملية الحذف", { id: toastId });
      }
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("خطأ في الاتصال بالخادم", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const sendDirectReply = async (sessionId: string) => {
    if (!directReply.trim()) return;
    setIsSendingReply(true);
    try {
      const res = await fetch("/api/admin/leads/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: directReply.trim() })
      });
      if (res.ok) {
        // Optimistically update the UI
        setLeads(leads.map(l => {
          if ((l.session_id || l.id) === sessionId && l.messages) {
            return {
              ...l,
              messages: [...l.messages, { role: "assistant", content: `👨‍💼 [تدخل الإدارة]: ${directReply.trim()}` }]
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

      {/* Bulk Actions Bar */}
      {selectedLeads.length > 0 && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between animate-in slide-in-from-top duration-300">
          <p className="text-sm text-red-200">تم تحديد {selectedLeads.length} من العملاء</p>
          <button 
            onClick={() => {
              toast.success("تم الضغط على حذف الكل");
              deleteLeads(selectedLeads);
            }}
            disabled={isDeleting}
            className="relative z-[9999] px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-red-600/40"
            style={{ cursor: 'pointer !important', pointerEvents: 'auto' }}
          >
            {isDeleting ? "جاري الحذف..." : "🗑️ حذف المحدد نهائياً (فوري)"}
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
                      <p className="font-medium text-white">{lead.name}</p>
                      <p className="text-sm text-white/50">{lead.roomType} | {lead.phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs border ${tierColors[lead.tier as keyof typeof tierColors] || tierColors.bronze}`}>
                      {lead.tier === "diamond" ? "ماسي" : lead.tier === "gold" ? "ذهبي" : lead.tier === "silver" ? "فضي" : "برونزي"}
                    </span>
                    <span className="text-sm text-white/60">{new Date(lead.created_at).toLocaleDateString("ar-EG")}</span>
                     <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success("تم الضغط على سلة المهملات");
                        deleteLeads([lead.session_id || lead.id]);
                      }}
                      className="relative z-[9999] p-3 text-red-500/40 hover:text-red-500 transition-colors"
                      style={{ cursor: 'pointer !important', pointerEvents: 'auto' }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {(expandedLead === lead.session_id || expandedLead === lead.id) && (
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
                        {lead.telemetry.hovered_elements && lead.telemetry.hovered_elements.length > 0 && (
                          <div className="mt-3">
                            <p className="text-white/40 text-xs mb-1">العناصر التي أطال النظر إليها:</p>
                            <div className="flex flex-wrap gap-1">
                              {lead.telemetry.hovered_elements.map((tag: string, idx: number) => (
                                <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded text-[10px]">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <a 
                        href={`https://wa.me/20${lead.phone.startsWith('0') ? lead.phone.substring(1) : lead.phone}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg flex items-center gap-2 transition"
                      >
                        📱 تواصل عبر واتساب
                      </a>
                      <button 
                        onClick={() => setShowChatFor(showChatFor === lead.id ? null : lead.id)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition"
                      >
                        💬 {showChatFor === lead.id ? "إخفاء المحادثة" : "فتح المحادثة الأصلية"}
                      </button>
                    </div>

                    {showChatFor === lead.id && lead.messages && (
                      <div className="mt-4 p-4 rounded-xl border border-white/10 bg-black/50 space-y-4">
                        <div className="max-h-[300px] overflow-y-auto space-y-3 p-2">
                          {lead.messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user' ? 'bg-[#C5A059]/20 text-white' : msg.content.includes('[تدخل الإدارة]') ? 'bg-red-500/20 text-red-100 border border-red-500/30' : 'bg-white/10 text-white/90'}`}>
                                <span className="block text-xs text-white/40 mb-1">
                                  {msg.role === 'user' ? lead.name : msg.content.includes('[تدخل الإدارة]') ? 'أنت (الإدارة)' : 'المستشار الذكي'}
                                </span>
                                {msg.content.replace('👨‍💼 [تدخل الإدارة]: ', '')}
                              </div>
                            </div>
                          ))}
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
  const defaultSettings = {
    seo_title: "Azenith Living - تصميم داخلي فاخر",
    seo_description: "نحن متخصصون في تصميم الديكور الداخلي الفاخر",
    seo_keywords: "تصميم داخلي, ديكور, رياض, فاخر",
    primary_color: "#C5A059",
    secondary_color: "#8B7355",
    font_family: "Inter, sans-serif",
    logo_url: "",
    favicon_url: "",
  };

  const [settings, setSettings] = useState<Record<string, string>>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings");
      const data = await response.json();
      if (response.ok && data.success && data.settings) {
        // Merge with defaults
        setSettings(prev => ({
          ...prev,
          ...data.settings,
        }));
      }
    } catch (err) {
      console.error("[ManagementTab] Error loading settings:", err);
      setError("فشل في تحميل الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus("saving");
    try {
      // Save SEO settings
      const seoKeys = ["seo_title", "seo_description", "seo_keywords", "primary_color", "secondary_color", "font_family", "logo_url", "favicon_url"];
      
      for (const key of seoKeys) {
        if (settings[key] !== undefined) {
          await fetch("/api/admin/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value: settings[key] }),
          });
        }
      }
      
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("[ManagementTab] Error saving settings:", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-white/60">
        <div className="w-8 h-8 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        جاري تحميل الإعدادات...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">الإدارة والتحكم</h2>
          <p className="text-sm text-[#C5A059]">إعدادات SEO والثيم</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <Check className="w-4 h-4" />
              تم الحفظ
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-rose-400">فشل الحفظ</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
          <button onClick={loadSettings} className="mr-2 underline">إعادة المحاولة</button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* SEO Settings */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#C5A059]" />
            إعدادات SEO
          </h3>
          <div>
            <label className="block text-sm text-white/60 mb-1">عنوان الموقع (SEO Title)</label>
            <input
              value={settings.seo_title || ""}
              onChange={(e) => updateSetting("seo_title", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              placeholder="Azenith Living - تصميم داخلي فاخر"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">وصف الموقع (SEO Description)</label>
            <textarea
              value={settings.seo_description || ""}
              onChange={(e) => updateSetting("seo_description", e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              placeholder="نحن متخصصون في تصميم الديكور الداخلي الفاخر"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">الكلمات المفتاحية (SEO Keywords)</label>
            <input
              value={settings.seo_keywords || ""}
              onChange={(e) => updateSetting("seo_keywords", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              placeholder="تصميم داخلي, ديكور, رياض, فاخر"
            />
          </div>
        </div>

        {/* Theme Settings */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#C5A059]" />
            إعدادات الثيم
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/60 mb-1">اللون الأساسي</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.primary_color || "#C5A059"}
                  onChange={(e) => updateSetting("primary_color", e.target.value)}
                  className="h-10 w-16 rounded border border-white/10 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.primary_color || ""}
                  onChange={(e) => updateSetting("primary_color", e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm"
                  placeholder="#C5A059"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1">اللون الثانوي</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.secondary_color || "#8B7355"}
                  onChange={(e) => updateSetting("secondary_color", e.target.value)}
                  className="h-10 w-16 rounded border border-white/10 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.secondary_color || ""}
                  onChange={(e) => updateSetting("secondary_color", e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white text-sm"
                  placeholder="#8B7355"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">الخط (Font Family)</label>
            <input
              value={settings.font_family || ""}
              onChange={(e) => updateSetting("font_family", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              placeholder="Inter, sans-serif"
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">رابط الشعار (Logo URL)</label>
            <input
              value={settings.logo_url || ""}
              onChange={(e) => updateSetting("logo_url", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1">رابط الأيقونة (Favicon URL)</label>
            <input
              value={settings.favicon_url || ""}
              onChange={(e) => updateSetting("favicon_url", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white"
              placeholder="https://..."
            />
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
  const defaultConfig: SiteConfig = {
    heroTitle: "ابدأ رحلة التصميم الذكي.",
    heroSubtitle: "أربع اختيارات فقط تكفي لبناء ملف العميل، تقدير مبدئي، ورسالة واتساب جاهزة للفريق التجاري.",
    budgetOptions: ["2,500 - 5,500 EGP", "5,500 - 12,000 EGP", "12,000 - 25,000 EGP", "25,000+ EGP"],
    styleOptions: ["مودرن دافئ", "هادئ فاخر", "عملي مع لمسة فندقية", "صناعي ناعم"],
    serviceOptions: ["تصميم فقط", "تصميم وتجهيز", "تصميم وتنفيذ", "تجديد لمساحة قائمة"],
    heroBackground: "/videos/hero-bg.mp4",
  };

  const [config, setConfig] = useState<SiteConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"text" | "options" | "media">("text");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings");
      const data = await response.json();
      if (response.ok && data.success && data.settings) {
        const s = data.settings;
        setConfig({
          heroTitle: s.cms_hero_title || defaultConfig.heroTitle,
          heroSubtitle: s.cms_hero_subtitle || defaultConfig.heroSubtitle,
          budgetOptions: s.cms_budget_options || defaultConfig.budgetOptions,
          styleOptions: s.cms_style_options || defaultConfig.styleOptions,
          serviceOptions: s.cms_service_options || defaultConfig.serviceOptions,
          heroBackground: s.cms_hero_background || defaultConfig.heroBackground,
        });
      }
    } catch (err) {
      console.error("[CMSTab] Error loading config:", err);
      setError("فشل في تحميل الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setSaveStatus("saving");
    try {
      // Save each config item separately
      const settingsToSave = [
        { key: "cms_hero_title", value: config.heroTitle },
        { key: "cms_hero_subtitle", value: config.heroSubtitle },
        { key: "cms_budget_options", value: config.budgetOptions },
        { key: "cms_style_options", value: config.styleOptions },
        { key: "cms_service_options", value: config.serviceOptions },
        { key: "cms_hero_background", value: config.heroBackground },
      ];

      for (const setting of settingsToSave) {
        await fetch("/api/admin/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(setting),
        });
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("[CMSTab] Error saving config:", err);
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const updateArrayOption = (field: keyof SiteConfig, idx: number, value: string) => {
    setConfig(prev => {
      const arr = [...(prev[field] as string[])];
      arr[idx] = value;
      return { ...prev, [field]: arr };
    });
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-white/60">
        <div className="w-8 h-8 border-2 border-[#C5A059] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        جاري تحميل الإعدادات...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">إدارة المحتوى</h2>
          <p className="text-sm text-[#C5A059]">CMS - تخصيص الموقع</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus === "saved" && (
            <span className="text-sm text-emerald-400 flex items-center gap-1">
              <Check className="w-4 h-4" />
              تم الحفظ
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm text-rose-400">فشل الحفظ</span>
          )}
          <button
            onClick={saveConfig}
            disabled={saving}
            className="rounded-xl bg-[#C5A059] px-4 py-2 text-sm font-medium text-[#1a1a1a] hover:bg-[#d8b56d] disabled:opacity-50"
          >
            {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          {error}
          <button onClick={loadConfig} className="mr-2 underline">إعادة المحاولة</button>
        </div>
      )}

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
                onChange={(e) => updateArrayOption("budgetOptions", idx, e.target.value)}
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
                onChange={(e) => updateArrayOption("styleOptions", idx, e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-white mb-2"
              />
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="block text-sm text-white/60 mb-3">الخدمات</label>
            {config.serviceOptions.map((option, idx) => (
              <input
                key={idx}
                value={option}
                onChange={(e) => updateArrayOption("serviceOptions", idx, e.target.value)}
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

function SalesCenterContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "sales";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

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

export default function SalesCenterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A0A0A] p-6 text-white text-center">جاري التحميل...</div>}>
      <SalesCenterContent />
    </Suspense>
  );
}
