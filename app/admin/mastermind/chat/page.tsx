"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Send, 
  Terminal, 
  Trash2,
  Loader2,
  Bot,
  User,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Command
} from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  status?: "pending" | "success" | "error";
  error?: string;
}

export default function MastermindChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"ai" | "legacy">("ai");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from API on mount
  useEffect(() => {
    loadChatHistory();
  }, []);

  // Load chat history from API
  const loadChatHistory = async () => {
    try {
      const response = await fetch("/api/admin/mastermind/chat", {
        credentials: "include",
      });
      const data = await response.json();
      
      if (data.success) {
        if (data.messages && data.messages.length > 0) {
          const formattedMessages = data.messages.map((m: any) => ({
            id: m.id || Date.now().toString(),
            role: m.role,
            content: m.content,
            timestamp: m.created_at || new Date().toISOString(),
            status: "success" as const,
          }));
          setMessages(formattedMessages);
        }
        if (data.mode) {
          setMode(data.mode);
        }
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setInput("");

    // Add pending assistant message
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: mode === "ai" ? "جاري التفكير..." : "جاري التنفيذ...",
      timestamp: new Date().toISOString(),
      status: "pending",
    }]);

    try {
      const response = await fetch("/api/admin/mastermind/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: userMessage.content,
          signature: "test-bypass",
        }),
      });

      const data = await response.json();

      if (data.mode) {
        setMode(data.mode);
      }

      setMessages(prev => prev.map(msg => 
        msg.id === assistantId 
          ? {
              ...msg,
              content: data.success 
                ? (data.result?.message || data.message || "تم بنجاح")
                : (data.error || "فشل التنفيذ"),
              status: data.success ? "success" : "error",
              error: data.error,
            }
          : msg
      ));

    } catch (error) {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantId 
          ? {
              ...msg,
              content: "خطأ في الاتصال بالخادم",
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
            }
          : msg
      ));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = async () => {
    if (confirm("هل تريد مسح سجل المحادثة؟")) {
      try {
        await fetch("/api/admin/mastermind/chat", {
          method: "DELETE",
          credentials: "include",
        });
      } catch (error) {
        console.error("Failed to clear history:", error);
      }
      setMessages([]);
      localStorage.removeItem("mastermind_chat_history");
    }
  };

  const loadCommand = (cmd: string) => {
    setInput(cmd);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0b]">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#111112] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              mode === "ai" ? "bg-purple-500/20" : "bg-brand-primary/20"
            }`}>
              {mode === "ai" ? (
                <Sparkles className="h-5 w-5 text-purple-400" />
              ) : (
                <Bot className="h-5 w-5 text-brand-primary" />
              )}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Mastermind Chat</h1>
              <div className="flex items-center gap-2 text-sm">
                <span className={mode === "ai" ? "text-purple-400" : "text-white/50"}>
                  {mode === "ai" ? "الوضع الذكي - AI Mode" : "الوضع العادي - Legacy Mode"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearHistory}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-white/5 text-white/60 hover:bg-red-500/20 hover:text-red-400 transition"
            >
              <Trash2 className="h-4 w-4" />
              مسح
            </button>
          </div>
        </div>
      </div>


      {/* Quick Commands / AI Suggestions */}
      <div className="border-b border-white/10 bg-[#111112]/50 px-6 py-3">
        <div className="flex items-center gap-2 text-sm text-white/50 mb-2">
          {mode === "ai" ? (
            <>
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>أمثلة للمحادثة:</span>
            </>
          ) : (
            <>
              <Command className="h-4 w-4" />
              <span>أوامر سريعة:</span>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === "ai" ? (
            // AI Mode: Natural language suggestions
            <>
              {[
                { cmd: "مرحباً، من أنت؟", label: "التعريف" },
                { cmd: "ما الذي يمكنك فعله؟", label: "المساعدة" },
                { cmd: "أضف مفتاح Groq جديد", label: "إضافة مفتاح" },
                { cmd: "اعرض المفاتيح المخزنة", label: "عرض المفاتيح" },
                { cmd: "كيف حال النظام؟", label: "الحالة" },
              ].map(({ cmd, label }) => (
                <button
                  key={cmd}
                  onClick={() => loadCommand(cmd)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition border border-purple-500/20"
                >
                  {label}
                </button>
              ))}
            </>
          ) : (
            // Legacy Mode: Rigid commands
            <>
              {[
                "help",
                "list_keys",
                "show_stats",
                "backup_db",
                "clear_cache",
              ].map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => loadCommand(cmd)}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/70 hover:bg-brand-primary/20 hover:text-brand-primary transition"
                >
                  {cmd}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              mode === "ai" ? "bg-purple-500/10" : "bg-brand-primary/10"
            }`}>
              {mode === "ai" ? (
                <Sparkles className="h-8 w-8 text-purple-400" />
              ) : (
                <Bot className="h-8 w-8 text-brand-primary" />
              )}
            </div>
            <h3 className="text-white font-medium mb-2">مرحباً في Mastermind Chat</h3>
            <p className="text-white/50 text-sm max-w-md mx-auto">
              {mode === "ai" 
                ? "أنا Mastermind - مساعدك الذكي. اسألني أي شيء بالعربية أو الإنجليزية، أو اطلب تنفيذ أمر إداري."
                : "يمكنك إرسال الأوامر الإدارية مباشرة. اكتب \"help\" لعرض قائمة الأوامر المتاحة."}
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              message.role === "user" 
                ? "bg-brand-primary/20" 
                : "bg-white/10"
            }`}>
              {message.role === "user" ? (
                <User className="h-4 w-4 text-brand-primary" />
              ) : (
                <Bot className="h-4 w-4 text-white/70" />
              )}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              message.role === "user"
                ? "bg-brand-primary text-brand-accent"
                : message.status === "error"
                ? "bg-red-500/10 border border-red-500/20 text-red-200"
                : message.status === "success"
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-200"
                : "bg-white/5 text-white"
            }`}>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs opacity-50">
                  {new Date(message.timestamp).toLocaleTimeString("ar-SA")}
                </span>
                {message.status === "pending" && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                {message.status === "success" && (
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                )}
                {message.status === "error" && (
                  <AlertCircle className="h-3 w-3 text-red-400" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 bg-[#111112] px-6 py-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === "ai" 
              ? "اكتب رسالتك بالعربية أو الإنجليزية... (مثال: مرحباً، من أنت؟)"
              : "اكتب أمراً إدارياً... (مثال: list_keys)"}
            className="flex-1 bg-[#0a0a0b] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:border-brand-primary outline-none"
            dir="auto"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${
              mode === "ai"
                ? "bg-purple-500 text-white hover:bg-purple-600"
                : "bg-brand-primary text-brand-accent hover:bg-[#d8b56d]"
            }`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            إرسال
          </button>
        </div>
        <p className="text-xs text-white/30 mt-2">
          {mode === "ai" 
            ? "الوضع الذكي مفعّل | المحادثة محفوظة في قاعدة البيانات | آخر 50 رسالة"
            : "وضع الأوامر الجامدة | آخر 50 رسالة محفوظة"}
        </p>
      </div>
    </div>
  );
}
