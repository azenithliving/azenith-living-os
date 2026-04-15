"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Trash2, Edit2, Check, X, MessageCircle, BookOpen, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Types
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface Learning {
  id: string;
  instruction: string;
  created_at: string;
}

interface PendingQuestion {
  id: string;
  question: string;
  session_id: string | null;
  created_at: string;
}

export default function SalesManagerPage() {
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Data state
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<PendingQuestion[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Generate session ID for admin on mount
  useEffect(() => {
    const newSessionId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    setSessionId(newSessionId);
    
    // Add welcome message
    setMessages([
      {
        role: "assistant",
        content: "أهلاً بك في وضع تعليم المستشار. اكتب أي توجيه أو معلومة تريد أن يتعلمها المستشار.",
        timestamp: new Date().toISOString(),
      },
    ]);

    // Load data
    loadLearnings();
    loadPendingQuestions();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load learnings from Supabase
  const loadLearnings = async () => {
    try {
      const response = await fetch("/api/consultant/learnings");
      if (response.ok) {
        const data = await response.json();
        setLearnings(data.learnings || []);
      }
    } catch (error) {
      console.error("Error loading learnings:", error);
    }
  };

  // Load pending questions from Supabase
  const loadPendingQuestions = async () => {
    try {
      const response = await fetch("/api/consultant/pending-questions");
      if (response.ok) {
        const data = await response.json();
        setPendingQuestions(data.questions || []);
      }
    } catch (error) {
      console.error("Error loading pending questions:", error);
    } finally {
      setIsLoadingData(false);
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

      // Refresh learnings list after successful save
      if (data.reply.includes("تم حفظ")) {
        loadLearnings();
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

  // Delete a learning
  const deleteLearning = async (id: string) => {
    try {
      const response = await fetch(`/api/consultant/learnings?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setLearnings((prev) => prev.filter((l) => l.id !== id));
      }
    } catch (error) {
      console.error("Error deleting learning:", error);
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

  // Save answer to FAQ and remove from pending
  const saveAnswer = async (questionId: string) => {
    if (!answerText.trim()) return;

    const question = pendingQuestions.find((q) => q.id === questionId);
    if (!question) return;

    try {
      const response = await fetch("/api/consultant/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.question,
          answer: answerText.trim(),
          originalPendingQuestionId: questionId,
        }),
      });

      if (response.ok) {
        // Remove from pending questions
        setPendingQuestions((prev) => prev.filter((q) => q.id !== questionId));
        setEditingQuestion(null);
        setAnswerText("");

        // Add success message to chat
        const successMessage: Message = {
          role: "assistant",
          content: `تمت الإجابة على السؤال وحفظه في قاعدة المعرفة.`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, successMessage]);
      }
    } catch (error) {
      console.error("Error saving answer:", error);
    }
  };

  // Delete a pending question without answering
  const deletePendingQuestion = async (id: string) => {
    try {
      const response = await fetch(`/api/consultant/pending-questions?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setPendingQuestions((prev) => prev.filter((q) => q.id !== id));
      }
    } catch (error) {
      console.error("Error deleting pending question:", error);
    }
  };

  return (
    <div className="h-screen flex">
      {/* Main Chat Section (60%) */}
      <div className="w-[60%] flex flex-col border-l border-white/10">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4 bg-[#C5A059]/10">
          <MessageCircle className="h-6 w-6 text-[#C5A059]" />
          <div>
            <h1 className="text-lg font-semibold text-white">مُستشار أزينث</h1>
            <p className="text-xs text-white/60">وضع تعليم المدير</p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto bg-[#0A0A0A] p-6">
          <div className="space-y-4">
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-[#C5A059] text-white rounded-tl-sm"
                      : "bg-zinc-800 text-gray-100 border border-white/10 rounded-tr-sm"
                  }`}
                >
                  <p className="text-sm leading-relaxed">{msg.content}</p>
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
        <form onSubmit={handleSubmit} className="border-t border-white/10 bg-zinc-900/50 p-4">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="اكتب توجيهك أو المعلومة الجديدة..."
              className="flex-1 rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 text-white placeholder-gray-500 focus:border-[#C5A059] focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#C5A059] text-white transition-colors hover:bg-[#d8b56d] disabled:opacity-50"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          <p className="text-xs text-white/40 mt-2 text-center">
            أي رسالة ترسلها هنا سيتم حفظها كتوجيه للمستشار
          </p>
        </form>
      </div>

      {/* Right Sidebar (40%) */}
      <div className="w-[40%] flex flex-col">
        {/* Active Learnings Section */}
        <div className="flex-1 border-b border-white/10 flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-zinc-900/30">
            <BookOpen className="h-5 w-5 text-[#C5A059]" />
            <h2 className="font-semibold text-white">التوجيهات النشطة</h2>
            <span className="mr-auto text-xs bg-[#C5A059]/20 text-[#C5A059] px-2 py-1 rounded-full">
              {learnings.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {learnings.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">
                لا توجد توجيهات محفوظة بعد. ابدأ بكتابة توجيه في المحادثة.
              </p>
            ) : (
              <div className="space-y-3">
                {learnings.map((learning) => (
                  <motion.div
                    key={learning.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-zinc-800/50 border border-white/5 rounded-xl p-3 group"
                  >
                    <p className="text-sm text-white/90 leading-relaxed">{learning.instruction}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                      <span className="text-xs text-white/40">
                        {new Date(learning.created_at).toLocaleDateString("ar-EG")}
                      </span>
                      <button
                        onClick={() => deleteLearning(learning.id)}
                        className="text-red-400/60 hover:text-red-400 transition-colors"
                        title="حذف التوجيه"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
