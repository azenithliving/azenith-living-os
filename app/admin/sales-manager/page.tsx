"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Trash2, Edit2, Check, X, MessageCircle, BookOpen, HelpCircle, TrendingUp, Users, Lightbulb, BarChart3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                     PROMPT المتدرب المطور                                    ║
// ║  أنت متديرب ذكي في نظام "أزينث ليفينج" للمبيعات. مهمتك:                   ║
// ║  1. اقتراح تحسينات على التوجيهات النشطة بناءً على usage_count              ║
// ║  2. تحديد الأسئلة المتكررة في قائمة pending لإضافتها للمعرفة               ║
// ║  3. تحليل تقارير الزوار واقتراح استراتيجيات تحويل                          ║
// ║  4. تنبيه المدير عندما يكون سؤال مهم معلق (asked_count > 3)               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                                 أنواع البيانات                              ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

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

interface Visitor {
  id: string;
  session_id: string;
  name: string | null;
  mood: string;
  conversion_stage: string;
  conversation_count: number;
  last_interaction_at: string;
}

interface WeeklyReport {
  topQuestions: { question: string; count: number }[];
  conversionStats: { stage: string; count: number }[];
  suggestions: string[];
  totalVisitors: number;
}

export default function SalesManagerPage() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                                 حالة البيانات                               ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [editingKnowledge, setEditingKnowledge] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [knowledgeValue, setKnowledgeValue] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<"chat" | "reports">("chat");

  // Generate session ID for admin on mount
  useEffect(() => {
    const newSessionId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(newSessionId);
    
    // ╔══════════════════════════════════════════════════════════════════════════════╗
    // ║                              رسالة الترحيب                                  ║
    // ╚══════════════════════════════════════════════════════════════════════════════╝
    setMessages([
      {
        role: "assistant",
        content: "👋 أهلاً بك في لوحة قائد المبيعات!\n\n📚 أنا المتدرب المطور الذكي. أقترح عليك:\n• التوجيهات الأكثر استخداماً لتحسينها\n• الأسئلة المتكررة لإضافتها للمعرفة\n• تحليل أسبوعي للزوار والتحويلات\n\n✍️ اكتب أي معلومة جديدة وسأحفظها في قاعدة المعرفة.",
        timestamp: new Date().toISOString(),
      },
    ]);

    // ╔══════════════════════════════════════════════════════════════════════════════╗
    // ║                              تحميل البيانات                                 ║
    // ╚══════════════════════════════════════════════════════════════════════════════╝
    loadKnowledge();
    loadPendingQuestions();
    loadVisitors();
    loadWeeklyReport();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                          تحميل قاعدة المعرفة                                ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
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

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                          تحميل الأسئلة المعلقة                              ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const loadPendingQuestions = async () => {
    try {
      const response = await fetch("/api/sales-leader/pending");
      if (response.ok) {
        const data = await response.json();
        setPendingQuestions(data.pending || []);
      }
    } catch (error) {
      console.error("[SalesLeader] Error loading pending:", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                          تحميل بيانات الزوار                                ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const loadVisitors = async () => {
    try {
      const response = await fetch("/api/sales-leader/visitors");
      if (response.ok) {
        const data = await response.json();
        setVisitors(data.visitors || []);
      }
    } catch (error) {
      console.error("[SalesLeader] Error loading visitors:", error);
    }
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                          تحميل التقرير الأسبوعي                             ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const loadWeeklyReport = async () => {
    try {
      const response = await fetch("/api/sales-leader/weekly-report");
      if (response.ok) {
        const data = await response.json();
        setWeeklyReport(data.report);
      }
    } catch (error) {
      console.error("[SalesLeader] Error loading weekly report:", error);
    }
  };

  // Send message to consultant (admin mode)
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);

    // Add user message to local state
    const userMessage: Message = {
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");

    try {
      const response = await fetch("/api/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
          userEmail: "admin@azenithliving.com", // Mark as admin
          history: messages,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // ╔══════════════════════════════════════════════════════════════════════════════╗
      // ║                    تحديث البيانات بعد الحفظ الناجح                          ║
      // ╚══════════════════════════════════════════════════════════════════════════════╝
      if (data.reply.includes("تم حفظ") || data.reply.includes("تمت الإضافة")) {
        loadKnowledge();
        loadPendingQuestions();
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                              حذف من المعرفة                                 ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const deleteKnowledge = async (id: string) => {
    try {
      const response = await fetch(`/api/sales-leader/knowledge?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setKnowledge((prev) => prev.filter((k) => k.id !== id));
      }
    } catch (error) {
      console.error("[SalesLeader] Error deleting knowledge:", error);
    }
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                           تحديث قيمة المعرفة                                ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const startEditingKnowledge = (id: string, currentValue: string) => {
    setEditingKnowledge(id);
    setKnowledgeValue(currentValue);
  };

  const cancelEditingKnowledge = () => {
    setEditingKnowledge(null);
    setKnowledgeValue("");
  };

  const saveKnowledgeUpdate = async (id: string) => {
    if (!knowledgeValue.trim()) return;

    try {
      const response = await fetch(`/api/sales-leader/knowledge?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: knowledgeValue.trim() }),
      });

      if (response.ok) {
        setKnowledge((prev) =>
          prev.map((k) => (k.id === id ? { ...k, value: knowledgeValue.trim() } : k))
        );
        setEditingKnowledge(null);
        setKnowledgeValue("");
      }
    } catch (error) {
      console.error("[SalesLeader] Error updating knowledge:", error);
    }
  };

  // Start answering a pending question
  const startAnswering = (questionId: string) => {
    setEditingQuestion(questionId);
    setAnswerText("");
  };

  // Cancel answering
  const cancelAnswering = () => {
    setEditingQuestion(null);
    setAnswerText("");
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                    حفظ الإجابة ونقلها للمعرفة                               ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const saveAnswer = async (questionId: string) => {
    if (!answerText.trim()) return;

    const question = pendingQuestions.find((q) => q.id === questionId);
    if (!question) return;

    try {
      const response = await fetch("/api/sales-leader/pending/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingId: questionId,
          answer: answerText.trim(),
          key: question.question.substring(0, 50).replace(/\s+/g, '_'),
        }),
      });

      if (response.ok) {
        // ╔══════════════════════════════════════════════════════════════════════════════╗
        // ║                    تحديث الواجهة بعد الحفظ الناجح                           ║
        // ╚══════════════════════════════════════════════════════════════════════════════╝
        setPendingQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setEditingQuestion(null);
        setAnswerText("");
        loadKnowledge();

        // ╔══════════════════════════════════════════════════════════════════════════════╗
        // ║                    رسالة النجاح للمتدرب                                    ║
        // ╚══════════════════════════════════════════════════════════════════════════════╝
        const successMessage: Message = {
          role: "assistant",
          content: `✅ تمت الإجابة وحفظها في قاعدة المعرفة!\n\n🎯 اقتراح المتدرب: هذا السؤال طُرح ${question.asked_count} مرة. يُنصح بمراقبة استخدام الإجابة الجديدة.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, successMessage]);
      }
    } catch (error) {
      console.error("[SalesLeader] Error saving answer:", error);
    }
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                         حذف سؤال معلق بدون إجابة                            ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const deletePendingQuestion = async (id: string) => {
    try {
      const response = await fetch(`/api/sales-leader/pending?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setPendingQuestions((prev) => prev.filter((q) => q.id !== id));
      }
    } catch (error) {
      console.error("[SalesLeader] Error deleting pending question:", error);
    }
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                    اقتراحات المتدرب المطور الذكية                           ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const generateSuggestions = (): string[] => {
    const suggestions: string[] = [];

    // ═══════════════════════════════════════════════════════════════════════════════
    // اقتراح 1: الأسئلة المتكررة (asked_count > 3)
    // ═══════════════════════════════════════════════════════════════════════════════
    const highFrequencyQuestions = pendingQuestions.filter(q => q.asked_count >= 3);
    if (highFrequencyQuestions.length > 0) {
      suggestions.push(`🚨 ${highFrequencyQuestions.length} أسئلة طُرحت 3+ مرات ولم تُجب بعد!`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // اقتراح 2: المعرفة غير المستخدمة
    // ═══════════════════════════════════════════════════════════════════════════════
    const unusedKnowledge = knowledge.filter(k => k.usage_count === 0);
    if (unusedKnowledge.length > 0) {
      suggestions.push(`📊 ${unusedKnowledge.length} عناصر معرفة لم تُستخدم قط. فكر في حذفها.`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // اقتراح 3: المعرفة الأكثر استخداماً
    // ═══════════════════════════════════════════════════════════════════════════════
    const topUsed = knowledge.filter(k => k.usage_count > 10);
    if (topUsed.length > 0) {
      suggestions.push(`⭐ ${topUsed.length} عناصر تُستخدم بكثرة (${topUsed.map(k => k.key).join(', ').substring(0, 100)}...)`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // اقتراح 4: التحويلات
    // ═══════════════════════════════════════════════════════════════════════════════
    const convertedCount = visitors.filter(v => v.conversion_stage === 'converted').length;
    const totalVisitors = visitors.length;
    if (totalVisitors > 0) {
      const rate = Math.round((convertedCount / totalVisitors) * 100);
      if (rate < 10) {
        suggestions.push(`📉 نسبة التحويل منخفضة (${rate}%). جرب تحسين ردود المستشار.`);
      } else if (rate > 30) {
        suggestions.push(`🎉 نسبة التحويل ممتازة (${rate}%)! استمر في نفس الاستراتيجية.`);
      }
    }

    return suggestions.length > 0 ? suggestions : ['✨ جميع المؤشرات طبيعية. استمر في المراقبة!'];
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                              تقسيم المراحل حسب المزاج                       ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'happy': return 'text-green-400 bg-green-400/10';
      case 'interested': return 'text-[#C5A059] bg-[#C5A059]/10';
      case 'hesitant': return 'text-yellow-400 bg-yellow-400/10';
      case 'frustrated': return 'text-red-400 bg-red-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'converted': return 'text-green-400 border-green-400/30';
      case 'qualified': return 'text-[#C5A059] border-[#C5A059]/30';
      case 'interested': return 'text-blue-400 border-blue-400/30';
      case 'lost': return 'text-red-400 border-red-400/30';
      default: return 'text-gray-400 border-gray-400/30';
    }
  };

  // ╔══════════════════════════════════════════════════════════════════════════════╗
  // ║                              الواجهة الرئيسية                               ║
  // ╚══════════════════════════════════════════════════════════════════════════════╝
  return (
    <div className="h-[calc(100vh-64px)] lg:h-screen flex flex-col lg:flex-row bg-[#0A0A0A]">
      {/* ═══════════════════════════════════════════════════════════════════════════
           القسم الرئيسي - المحادثة والتقارير (العرض الكامل على الموبايل، 60% على الديسكتوب)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[60%] flex flex-col border-l-0 lg:border-l border-white/10 order-2 lg:order-1">
        {/* ═══════════════════════════════════════════════════════════════════════════
             Header مع علامات التبويب
            ═══════════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 px-4 lg:px-6 py-3 lg:py-4 bg-[#C5A059]/10">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 lg:h-6 lg:w-6 text-[#C5A059]" />
            <div>
              <h1 className="text-base lg:text-lg font-semibold text-white">قائد المبيعات الاستراتيجي</h1>
              <p className="text-xs text-white/60 hidden sm:block">الإصدار 2.0 - نظام المتدرب المطور</p>
            </div>
          </div>
          <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm transition-colors min-h-[44px] ${
                activeTab === "chat" ? "bg-[#C5A059] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              المحادثة
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-sm transition-colors min-h-[44px] ${
                activeTab === "reports" ? "bg-[#C5A059] text-white" : "text-white/60 hover:text-white"
              }`}
            >
              التقارير
            </button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════════
             المحتوى حسب التبويب النشط
            ═══════════════════════════════════════════════════════════════════════════ */}
        {activeTab === "chat" ? (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-[#0A0A0A] p-3 md:p-6">
              <div className="space-y-3 md:space-y-4">
                {messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[80%] rounded-2xl px-3 md:px-4 py-2.5 md:py-3 ${
                        msg.role === "user"
                          ? "bg-[#C5A059] text-white rounded-tl-sm"
                          : "bg-zinc-800 text-gray-100 border border-white/10 rounded-tr-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
                      <span className="text-xs opacity-50 mt-1 block">
                        {new Date(msg.timestamp || Date.now()).toLocaleTimeString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </motion.div>
                ))}

                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
                    <div className="bg-zinc-800 border border-white/10 rounded-2xl rounded-tr-sm px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#C5A059] [animation-delay:-0.3s]"></span>
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#C5A059] [animation-delay:-0.15s]"></span>
                        <span className="h-2 w-2 animate-bounce rounded-full bg-[#C5A059]"></span>
                      </div>
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSubmit} className="border-t border-white/10 bg-zinc-900/50 p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="اكتب معلومة جديدة..."
                  className="flex-1 rounded-xl border border-white/10 bg-zinc-800 px-3 md:px-4 py-3 text-white placeholder-gray-500 focus:border-[#C5A059] focus:outline-none min-h-[44px]"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading}
                  className="flex h-12 w-12 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#C5A059] text-white transition-colors hover:bg-[#d8b56d] disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <p className="text-xs text-white/40 mt-2 text-center hidden md:block">
                استخدم الصيغة: المفتاح | القيمة - أو اكتب أي توجيه وسأقترح تحسينات
              </p>
            </form>
          </>
        ) : (
          /* ═══════════════════════════════════════════════════════════════════════════
              تبويب التقارير
             ═══════════════════════════════════════════════════════════════════════════ */
          <div className="flex-1 overflow-y-auto bg-[#0A0A0A] p-3 md:p-6">
            <div className="space-y-4 md:space-y-6">
              {/* ═══════════════════════════════════════════════════════════════════════════
                   ملخص سريع
                  ═══════════════════════════════════════════════════════════════════════════ */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-[#C5A059]" />
                    <span className="text-xs text-white/60">الزوار</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{visitors.length}</p>
                </div>
                <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-green-400" />
                    <span className="text-xs text-white/60">المعرفة</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{knowledge.length}</p>
                </div>
                <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-xs text-white/60">معلقة</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{pendingQuestions.length}</p>
                </div>
                <div className="bg-zinc-800/50 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-white/60">التحويلات</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {visitors.filter(v => v.conversion_stage === 'converted').length}
                  </p>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════════════
                   اقتراحات المتدرب
                  ═══════════════════════════════════════════════════════════════════════════ */}
              <div className="bg-[#C5A059]/5 border border-[#C5A059]/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-5 w-5 text-[#C5A059]" />
                  <h3 className="font-semibold text-white">💡 اقتراحات المتدرب المطور</h3>
                </div>
                <div className="space-y-2">
                  {generateSuggestions().map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm text-white/80">
                      <span className="text-[#C5A059] mt-0.5">•</span>
                      <span>{suggestion}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════════════════
                   آخر الزوار
                  ═══════════════════════════════════════════════════════════════════════════ */}
              <div className="bg-zinc-800/30 border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="h-5 w-5 text-[#C5A059]" />
                  <h3 className="font-semibold text-white">👥 آخر الزوار والزائرات</h3>
                </div>
                {visitors.length === 0 ? (
                  <p className="text-center text-white/40 text-sm py-4">لا يوجد زوار مسجلين بعد</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {visitors.slice(0, 10).map((visitor) => (
                      <div key={visitor.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className={`px-2 py-0.5 rounded text-xs ${getStageColor(visitor.conversion_stage)}`}>
                            {visitor.conversion_stage}
                          </div>
                          <span className="text-sm text-white">{visitor.name || 'زائر مجهول'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${getMoodColor(visitor.mood)}`}>
                            {visitor.mood}
                          </span>
                          <span className="text-xs text-white/40">{visitor.conversation_count} رسائل</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════════════════════════
                   أكثر الأسئلة تكراراً (من التقرير الأسبوعي)
                  ═══════════════════════════════════════════════════════════════════════════ */}
              {weeklyReport && weeklyReport.topQuestions.length > 0 && (
                <div className="bg-zinc-800/30 border border-white/10 rounded-xl p-4">
                  <h3 className="font-semibold text-white mb-3">📊 أكثر الأسئلة تكراراً هذا الأسبوع</h3>
                  <div className="space-y-2">
                    {weeklyReport.topQuestions.map((q, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                        <span className="text-sm text-white/80">{q.question}</span>
                        <span className="px-2 py-1 rounded-full bg-[#C5A059]/20 text-[#C5A059] text-xs">
                          {q.count} مرة
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
           الشريط الجانبي الأيمن (مخفي على الموبايل، 40% على الديسكتوب)
          ═══════════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex w-[40%] flex-col order-1 lg:order-2">
        {/* ═══════════════════════════════════════════════════════════════════════════
             قسم قاعدة المعرفة (مع usage_count)
            ═══════════════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 border-b border-white/10 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-zinc-900/30">
            <BookOpen className="h-5 w-5 text-[#C5A059]" />
            <h2 className="font-semibold text-white text-sm lg:text-base">قاعدة المعرفة</h2>
            <span className="mr-auto text-xs bg-[#C5A059]/20 text-[#C5A059] px-2 py-1 rounded-full">
              {knowledge.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {knowledge.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">
                لا توجد معلومات في قاعدة المعرفة. ابدأ بإضافة معلومة جديدة.
              </p>
            ) : (
              <div className="space-y-3">
                {knowledge
                  .sort((a, b) => b.usage_count - a.usage_count)
                  .map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-800/50 border border-white/5 rounded-xl p-3 group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                        {item.category}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-[#C5A059]/20 text-[#C5A059]">
                        {item.usage_count} استخدام
                      </span>
                    </div>
                    
                    {editingKnowledge === item.id ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          value={knowledgeValue}
                          onChange={(e) => setKnowledgeValue(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-zinc-700 px-3 py-2 text-sm text-white focus:border-[#C5A059] focus:outline-none resize-none"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveKnowledgeUpdate(item.id)}
                            className="flex-1 flex items-center justify-center gap-1 bg-green-600/80 text-white text-xs py-1.5 rounded-lg hover:bg-green-600"
                          >
                            <Check className="h-3 w-3" />
                            حفظ
                          </button>
                          <button
                            onClick={cancelEditingKnowledge}
                            className="flex-1 flex items-center justify-center gap-1 bg-zinc-700 text-white text-xs py-1.5 rounded-lg hover:bg-zinc-600"
                          >
                            <X className="h-3 w-3" />
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-white mb-1">{item.key}</p>
                        <p className="text-xs text-white/70 leading-relaxed">{item.value.substring(0, 100)}...</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                          <span className="text-xs text-white/40">
                            {new Date(item.created_at).toLocaleDateString("ar-EG")}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditingKnowledge(item.id, item.value)}
                              className="text-[#C5A059]/60 hover:text-[#C5A059] transition-colors"
                              title="تعديل"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteKnowledge(item.id)}
                              className="text-red-400/60 hover:text-red-400 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Questions Section */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-zinc-900/30">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            <h2 className="font-semibold text-white">الأسئلة المعلقة</h2>
            <span className="mr-auto text-xs bg-amber-500/20 text-amber-500 px-2 py-1 rounded-full">
              {pendingQuestions.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingData ? (
              <p className="text-center text-white/40 text-sm py-8">جاري التحميل...</p>
            ) : pendingQuestions.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">
                لا توجد أسئلة معلقة. الأسئلة التي لا يعرفها المستشار ستظهر هنا.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingQuestions.map((question) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-800/50 border border-white/5 rounded-xl p-3"
                  >
                    {editingQuestion === question.id ? (
                      <div className="space-y-2">
                        <p className="text-sm text-white/70 font-medium mb-2">{question.question}</p>
                        <textarea
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="اكتب الإجابة here..."
                          className="w-full rounded-lg border border-white/10 bg-zinc-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-[#C5A059] focus:outline-none resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveAnswer(question.id)}
                            disabled={!answerText.trim()}
                            className="flex-1 flex items-center justify-center gap-1 bg-green-600/80 text-white text-sm py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            حفظ
                          </button>
                          <button
                            onClick={cancelAnswering}
                            className="flex-1 flex items-center justify-center gap-1 bg-zinc-700 text-white text-sm py-2 rounded-lg hover:bg-zinc-600"
                          >
                            <X className="h-4 w-4" />
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-white/90 leading-relaxed">{question.question}</p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                          <span className="text-xs text-white/40">
                            {new Date(question.created_at).toLocaleDateString("ar-EG")}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startAnswering(question.id)}
                              className="flex items-center gap-1 text-[#C5A059] hover:text-[#d8b56d] transition-colors text-sm"
                            >
                              <Edit2 className="h-4 w-4" />
                              إجابة
                            </button>
                            <button
                              onClick={() => deletePendingQuestion(question.id)}
                              className="text-red-400/60 hover:text-red-400 transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
