"use client";

/**
 * The Command Horizon - Supreme Architect Chat Interface
 * 
 * Features:
 * - Luxury design with gold/amber theme
 * - File upload support
 * - Live code preview
 * - Pexels image integration
 * - Real-time status updates
 * - Imperial personality greeting
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Sparkles,
  Code2,
  FileCode,
  Image,
  Zap,
  Shield,
  Crown,
  Clock,
  CheckCircle,
  AlertTriangle,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  Terminal,
  FileText,
} from "lucide-react";

// Types
interface Message {
  id: string;
  role: "user" | "architect" | "system";
  content: string;
  thinking?: string;
  codeBlocks?: Array<{
    language: string;
    code: string;
    path?: string;
    previewAvailable?: boolean;
  }>;
  attachments?: Array<{
    type: string;
    name: string;
    url?: string;
  }>;
  timestamp: Date;
  actions?: Array<{
    type: string;
    payload: unknown;
  }>;
}

interface SystemStatus {
  health: "excellent" | "good" | "degraded" | "critical";
  activeKeys: number;
  apiEfficiency: number;
  recentIssues: number;
}

// Utility Components
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function Button({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "gold";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const variants = {
    primary: "bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700",
    outline: "border-2 border-gray-300 text-gray-700 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300",
    ghost: "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300",
    gold: "bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:from-amber-600 hover:to-orange-700 shadow-lg",
  };

  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function Badge({ 
  children, 
  variant = "default",
  size = "md"
}: { 
  children: React.ReactNode; 
  variant?: "default" | "success" | "warning" | "danger" | "gold";
  size?: "sm" | "md";
}) {
  const variants = {
    default: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    gold: "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:from-amber-900/30 dark:to-orange-900/30 dark:text-amber-300",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span className={cn("rounded-full font-medium", variants[variant], sizes[size])}>
      {children}
    </span>
  );
}

// Code Preview Component
function CodePreview({ 
  code, 
  language, 
  path,
  onApply 
}: { 
  code: string; 
  language: string; 
  path?: string;
  onApply?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{path || `generated.${language}`}</span>
          <Badge variant="gold" size="sm">معاينة</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
            title="نسخ"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
          </button>
        </div>
      </div>
      
      {/* Code */}
      <div className="p-4 overflow-x-auto">
        <pre className="text-sm text-gray-300 font-mono leading-relaxed">
          <code>{code}</code>
        </pre>
      </div>

      {/* Actions */}
      {onApply && (
        <div className="px-4 py-3 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
          <span className="text-sm text-gray-400">
            يمكنني تطبيق هذا الكود مباشرة على المشروع
          </span>
          <Button variant="gold" size="sm" onClick={onApply}>
            <Zap className="w-4 h-4" />
            تطبيق الكود
          </Button>
        </div>
      )}
    </div>
  );
}

// Message Component
function ChatMessage({ 
  message, 
  onApplyCode 
}: { 
  message: Message; 
  onApplyCode?: (code: string, path?: string) => void;
}) {
  const isArchitect = message.role === "architect";
  const isSystem = message.role === "system";

  return (
    <div className={cn(
      "py-6",
      isArchitect ? "bg-amber-50/50 dark:bg-amber-950/10" : ""
    )}>
      <div className="max-w-5xl mx-auto px-4 flex gap-4">
        {/* Avatar */}
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center",
          isArchitect 
            ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
            : isSystem
            ? "bg-gray-200 dark:bg-gray-800 text-gray-600"
            : "bg-gray-100 dark:bg-gray-800 text-gray-600"
        )}>
          {isArchitect ? <Crown className="w-5 h-5" /> : isSystem ? <Terminal className="w-5 h-5" /> : <User className="w-5 h-5" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={cn(
              "font-semibold",
              isArchitect ? "text-amber-700 dark:text-amber-400" : "text-gray-900 dark:text-white"
            )}>
              {isArchitect ? "المهندس الأول" : isSystem ? "النظام" : "أنت"}
            </span>
            <span className="text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {isArchitect && message.thinking && (
              <Badge variant="gold" size="sm">
                <Sparkles className="w-3 h-3 mr-1" />
                تفكير نشط
              </Badge>
            )}
          </div>

          {/* Message Content */}
          <div className="prose dark:prose-invert max-w-none">
            <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </div>
          </div>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  {att.type === "image" ? <Image className="w-4 h-4 text-gray-500" /> : <FileText className="w-4 h-4 text-gray-500" />}
                  <span className="text-sm text-gray-600 dark:text-gray-400">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Code Blocks */}
          {message.codeBlocks && message.codeBlocks.map((block, idx) => (
            <CodePreview
              key={idx}
              code={block.code}
              language={block.language}
              path={block.path}
              onApply={() => onApplyCode?.(block.code, block.path)}
            />
          ))}

          {/* Thinking Process (Collapsible) */}
          {isArchitect && message.thinking && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Terminal className="w-3 h-3" />
                <span>عملية التفكير</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {message.thinking}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function CommandHorizon() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => `architect_${Date.now()}`);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial greeting
  useEffect(() => {
    fetchGreeting();
    fetchStatus();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchGreeting = async () => {
    try {
      const response = await fetch("/api/architect?type=greeting");
      const data = await response.json();
      
      if (data.success) {
        const greetingMessage: Message = {
          id: `greeting_${Date.now()}`,
          role: "architect",
          content: data.greeting,
          timestamp: new Date(),
        };
        setMessages([greetingMessage]);
      }
    } catch (error) {
      console.error("Failed to fetch greeting:", error);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/architect?type=status");
      const data = await response.json();
      if (data.success) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to fetch status:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          sessionId,
          userId: null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        const architectMessage: Message = {
          id: `architect_${Date.now()}`,
          role: "architect",
          content: data.response.content,
          thinking: showThinking ? data.response.thinking : undefined,
          codeBlocks: data.response.codePreview ? [data.response.codePreview] : undefined,
          actions: data.response.actions,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, architectMessage]);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: "system",
        content: `عذراً، حدث خطأ: ${error}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCode = async (code: string, path?: string) => {
    if (!path) {
      alert("لم يتم تحديد مسار الملف");
      return;
    }

    try {
      const response = await fetch("/api/architect/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply-code",
          payload: { filePath: path, code },
        }),
      });

      const data = await response.json();

      const systemMessage: Message = {
        id: `system_${Date.now()}`,
        role: "system",
        content: data.success 
          ? `✅ تم تطبيق الكود بنجاح على ${path}` 
          : `❌ فشل تطبيق الكود: ${data.error}`,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, systemMessage]);
    } catch (error) {
      console.error("Failed to apply code:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getHealthIcon = (health?: SystemStatus["health"]) => {
    switch (health) {
      case "excellent": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "good": return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case "degraded": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "critical": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Shield className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 md:px-4 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                <Bot className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-gray-900 dark:text-white text-base md:text-lg">
                  المهندس الأول
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                  الذكاء السيادي | Proactive Autonomy
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
              {/* Status Indicator */}
              {status && (
                <div className="flex items-center gap-2 md:gap-3 px-2 md:px-4 py-1.5 md:py-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  {getHealthIcon(status.health)}
                  <div className="flex items-center gap-1.5 md:gap-3 text-xs md:text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {status.activeKeys} مفاتيح
                    </span>
                    <span className="text-gray-300 dark:text-gray-600 hidden md:inline">|</span>
                    <span className="text-gray-600 dark:text-gray-400 hidden md:inline">
                      كفاءة {status.apiEfficiency}%
                    </span>
                  </div>
                </div>
              )}

              <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="min-h-[44px]">
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">محادثة جديدة</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="p-6 bg-gradient-to-br from-amber-500/20 to-orange-600/20 rounded-full mb-6">
                <Crown className="w-12 h-12 text-amber-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                أهلاً بك في Command Horizon
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
                المهندس الأول في خدمتك. تحدث معي كقائد، وسأنفذ رؤيتك بدقة إلهية.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {["أريد تحليلاً للمبيعات", "أريد مكون React جديد", "حلل منافسينا", "تحسين أداء الموقع"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onApplyCode={handleApplyCode}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="تحدث مع المهندس الأول... (Shift+Enter للسطر الجديد)"
                className="w-full px-4 py-3 pr-12 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                rows={1}
                style={{ minHeight: "56px", maxHeight: "200px" }}
              />
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors" title="رفع ملف">
                  <FileText className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            <Button
              onClick={handleSend}
              loading={loading}
              disabled={!input.trim()}
              variant="gold"
              className="h-14 w-14 p-0 flex-shrink-0"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showThinking}
                  onChange={(e) => setShowThinking(e.target.checked)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                إظهار عملية التفكير
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              <span>Supreme Architect v1.0 | Gemini + Windsurf Hybrid</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
