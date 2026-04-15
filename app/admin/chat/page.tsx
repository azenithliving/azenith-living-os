"use client";

/**
 * Azenith Mind - The Imperial Architect Chat
 * 
 * Luxury Dark UI for the Supreme AI Command Interface
 * - Omniscient Awareness Dashboard
 * - Executive Persona Communication
 * - Triple-A Protocol Visualization
 * - Real-time Market Intelligence
 */

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Brain,
  Send,
  Sparkles,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  Target,
  AlertTriangle,
  CheckCircle,
  RotateCcw,
  MoreVertical,
  ChevronLeft,
  Command,
  Activity,
  Globe,
  Infinity,
  Heart,
  Lightbulb,
  Code,
  Palette,
  BarChart3,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "architect" | "prime";
  content: string;
  thinking?: string;
  actions?: string[];
  timestamp: Date;
  philosophy?: string;
  opportunities?: MarketOpportunity[];
}

interface MarketOpportunity {
  id: string;
  title: string;
  description: string;
  estimatedImpact: { revenue: number; brand: number };
  readyToDeploy: boolean;
}

interface ArchitectState {
  collectiveIntelligence: number;
  activeKeys: number;
  cacheHitRate: number;
  savedCost: number;
  timeCapsules: number;
  pendingOpportunities: number;
}

const cn = (...classes: (string | boolean | undefined)[]) => 
  classes.filter(Boolean).join(" ");

export default function AzenithChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [architectState, setArchitectState] = useState<ArchitectState>({
    collectiveIntelligence: 94,
    activeKeys: 24,
    cacheHitRate: 99,
    savedCost: 1240.5,
    timeCapsules: 12,
    pendingOpportunities: 3,
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sessionId = useRef(`session_${Date.now()}`).current;

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
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
          payload: {
            command: input,
            sessionId,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        const architectMessage: Message = {
          id: `msg_${Date.now()}_response`,
          role: "architect",
          content: data.result.response,
          thinking: data.result.thinking,
          actions: data.result.suggestions,
          timestamp: new Date(),
          philosophy: data.result.philosophy,
        };
        setMessages((prev) => [...prev, architectMessage]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: "architect",
        content: "سيد أزينث، حدث خلل تقني بسيط. دعني أعيد المحاولة...",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickCommands = [
    { icon: Activity, label: "حلل الموقع", command: "حلل لي حالة الموقع" },
    { icon: TrendingUp, label: "فرص السوق", command: "اكتشف لي فرص الربح" },
    { icon: Code, label: "تحسين الكود", command: "أريد تحسين أداء الموقع" },
    { icon: Palette, label: "فخامة التصميم", command: "حسن لي صور الموقع للأسلوب الصناعي" },
    { icon: Target, label: "SEO تحليل", command: "حلل SEO للموقع" },
    { icon: Shield, label: "كبسولة زمنية", command: "احفظ هذه اللحظة" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0f0f0f] text-white" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-[#C5A059]/20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 md:gap-4">
              <button 
                onClick={() => router.push("/admin")}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 text-[#C5A059]" />
              </button>
              
              <div className="flex items-center gap-2 md:gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#C5A059] blur-lg opacity-30 rounded-full animate-pulse" />
                  <div className="relative p-2 md:p-2.5 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-xl">
                    <Crown className="w-5 h-5 md:w-6 md:h-6 text-[#1a1a1a]" />
                  </div>
                </div>
                <div>
                  <h1 className="text-lg md:text-xl font-bold text-[#C5A059]">Azenith Mind</h1>
                  <p className="text-xs text-gray-400 hidden sm:block">العقل المدبر السيادي</p>
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div className="hidden md:flex items-center gap-2 lg:gap-4">
              <div className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 bg-[#C5A059]/10 rounded-full border border-[#C5A059]/30">
                <Zap className="w-4 h-4 text-[#C5A059]" />
                <span className="text-xs lg:text-sm text-[#C5A059]">{architectState.activeKeys} مفتاح</span>
              </div>
              <div className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/30">
                <Activity className="w-4 h-4 text-green-400" />
                <span className="text-xs lg:text-sm text-green-400">{architectState.collectiveIntelligence}%</span>
              </div>
              <div className="flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 bg-[#C5A059]/10 rounded-full border border-[#C5A059]/30 hidden lg:flex">
                <Infinity className="w-4 h-4 text-[#C5A059]" />
                <span className="text-xs lg:text-sm text-[#C5A059]">{architectState.cacheHitRate}% cache</span>
              </div>
            </div>

            <button className="p-2 hover:bg-white/5 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
              <MoreVertical className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-20 md:pt-24 pb-24 md:pb-32 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-[#C5A059] blur-3xl opacity-20 rounded-full" />
                <div className="relative p-6 bg-gradient-to-br from-[#C5A059]/20 to-[#8B7355]/20 rounded-3xl border border-[#C5A059]/30">
                  <Brain className="w-16 h-16 text-[#C5A059]" />
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-white mb-3">
                أهلاً سيد أزينث
              </h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                أنا العقل المدبر السيادي. أعرف كل شيء، أرى كل شيء، وأنا هنا لأخدم طموحك.
                ماذا تريد أن نفعل اليوم؟
              </p>

              {/* Quick Commands */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {quickCommands.map((cmd, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(cmd.command);
                      inputRef.current?.focus();
                    }}
                    className="flex items-center gap-3 p-4 bg-white/5 hover:bg-[#C5A059]/10 rounded-xl border border-white/10 hover:border-[#C5A059]/30 transition-all text-right group"
                  >
                    <cmd.icon className="w-5 h-5 text-[#C5A059] group-hover:scale-110 transition-transform" />
                    <span className="text-sm text-gray-300 group-hover:text-white">{cmd.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4",
                  message.role === "user" ? "flex-row" : "flex-row-reverse"
                )}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {message.role === "user" ? (
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">أ</span>
                    </div>
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-[#C5A059] to-[#8B7355] rounded-full flex items-center justify-center">
                      <Crown className="w-5 h-5 text-[#1a1a1a]" />
                    </div>
                  )}
                </div>

                {/* Message Content */}
                <div className={cn(
                  "flex-1 max-w-[85%]",
                  message.role === "user" ? "text-right" : "text-left"
                )}>
                  <div className={cn(
                    "inline-block p-4 rounded-2xl",
                    message.role === "user" 
                      ? "bg-[#C5A059]/20 border border-[#C5A059]/30 text-white"
                      : "bg-white/5 border border-white/10 text-gray-100"
                  )}>
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    
                    {/* Philosophy (if architect) */}
                    {message.philosophy && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <p className="text-sm text-[#C5A059] italic">
                          <Sparkles className="w-4 h-4 inline-block ml-1" />
                          {message.philosophy}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Thinking Process Toggle */}
                  {message.thinking && (
                    <div className="mt-2">
                      <button
                        onClick={() => setShowThinking(!showThinking)}
                        className="text-xs text-gray-500 hover:text-[#C5A059] transition-colors flex items-center gap-1"
                      >
                        <Brain className="w-3 h-3" />
                        {showThinking ? "إخفاء التفكير" : "عرض التفكير"}
                      </button>
                      {showThinking && (
                        <div className="mt-2 p-3 bg-[#0a0a0a] rounded-lg border border-white/5 text-xs text-gray-400">
                          {message.thinking}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setInput(action);
                            inputRef.current?.focus();
                          }}
                          className="px-3 py-1.5 bg-[#C5A059]/10 hover:bg-[#C5A059]/20 rounded-full text-xs text-[#C5A059] border border-[#C5A059]/30 transition-colors"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="mt-1 text-xs text-gray-600">
                    {message.timestamp.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-3 py-6">
              <div className="w-2 h-2 bg-[#C5A059] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-2 h-2 bg-[#C5A059] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-2 h-2 bg-[#C5A059] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-sm text-gray-500 mr-2">يفكر...</span>
            </div>
          )}
        </div>
      </main>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-8 pb-6 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Input Container */}
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 hover:border-[#C5A059]/30 rounded-2xl p-2 transition-all focus-within:border-[#C5A059]/50 focus-within:bg-white/10">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="أمرك يا سيد أزينث..."
                disabled={loading}
                className="flex-1 bg-transparent px-4 py-3 text-white placeholder-gray-500 focus:outline-none text-right"
              />
              
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className={cn(
                  "p-3 rounded-xl transition-all",
                  input.trim() 
                    ? "bg-gradient-to-br from-[#C5A059] to-[#8B7355] text-[#1a1a1a] hover:shadow-lg hover:shadow-[#C5A059]/30"
                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            {/* Footer Info */}
            <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {architectState.timeCapsules} كبسولة زمنية
              </span>
              <span className="flex items-center gap-1">
                <Lightbulb className="w-3 h-3" />
                {architectState.pendingOpportunities} فرصة مكتشفة
              </span>
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                ${architectState.savedCost} توفير
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Side Panel - Architect State (Desktop) */}
      <div className="hidden xl:block fixed right-6 top-24 bottom-24 w-72">
        <div className="h-full bg-white/5 border border-white/10 rounded-2xl p-6 overflow-y-auto">
          <h3 className="text-lg font-bold text-[#C5A059] mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5" />
            حالة العقل
          </h3>

          <div className="space-y-6">
            {/* Intelligence */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">الذكاء الجماعي</span>
                <span className="text-[#C5A059] font-bold">{architectState.collectiveIntelligence}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#C5A059] to-[#8B7355] rounded-full transition-all duration-1000"
                  style={{ width: `${architectState.collectiveIntelligence}%` }}
                />
              </div>
            </div>

            {/* Cache Hit Rate */}
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">كفاءة الذاكرة</span>
                <span className="text-green-400 font-bold">{architectState.cacheHitRate}%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                  style={{ width: `${architectState.cacheHitRate}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                توفير 99% من استهلاك API
              </p>
            </div>

            {/* Active Keys */}
            <div className="p-4 bg-[#C5A059]/10 rounded-xl border border-[#C5A059]/30">
              <div className="flex items-center gap-3 mb-2">
                <Zap className="w-5 h-5 text-[#C5A059]" />
                <span className="font-medium text-[#C5A059]">الترسانة الحية</span>
              </div>
              <p className="text-2xl font-bold text-white">{architectState.activeKeys} مفتاح</p>
              <p className="text-xs text-gray-400 mt-1">جميع المفاتيح نشطة ومستعدة</p>
            </div>

            {/* Cost Savings */}
            <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/30">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="w-5 h-5 text-green-400" />
                <span className="font-medium text-green-400">التوفير المالي</span>
              </div>
              <p className="text-2xl font-bold text-white">${architectState.savedCost}</p>
              <p className="text-xs text-gray-400 mt-1">بفضل الذاكرة العصبية</p>
            </div>

            {/* Opportunities Alert */}
            {architectState.pendingOpportunities > 0 && (
              <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">فرص مكتشفة</span>
                </div>
                <p className="text-lg font-bold text-white">
                  {architectState.pendingOpportunities} فرصة
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  اطلب "فرص السوق" لمعرفة التفاصيل
                </p>
              </div>
            )}

            {/* Time Capsules */}
            <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-5 h-5 text-purple-400" />
                <span className="font-medium text-purple-400">كبسولات الزمن</span>
              </div>
              <p className="text-2xl font-bold text-white">{architectState.timeCapsules}</p>
              <p className="text-xs text-gray-400 mt-1">لقطة زمنية متاحة للرجوع</p>
            </div>
          </div>

          {/* Prime Link */}
          <button
            onClick={() => router.push("/admin/prime")}
            className="mt-6 w-full p-3 bg-gradient-to-r from-[#C5A059]/20 to-[#8B7355]/20 hover:from-[#C5A059]/30 hover:to-[#8B7355]/30 rounded-xl border border-[#C5A059]/30 transition-all flex items-center justify-center gap-2"
          >
            <Infinity className="w-4 h-4 text-[#C5A059]" />
            <span className="text-sm text-[#C5A059]">الكيان الأعلى (Prime)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
