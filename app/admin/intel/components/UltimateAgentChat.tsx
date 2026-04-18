"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  Command,
  Gauge,
  Goal,
  Loader2,
  MessageSquare,
  ScanSearch,
  Send,
  Shield,
  Sparkles,
  TrendingUp,
  User,
  WandSparkles,
  XCircle,
  Zap,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: Date;
  type?: "command" | "response" | "error";
  metadata?: {
    actionTaken?: string;
    requiresApproval?: boolean;
    suggestions?: string[];
    data?: {
      intent?: string;
      model?: string;
    };
  };
}

interface ApprovalRequest {
  id: string;
  actionType: string;
  description: string;
  riskLevel: string;
  requestedAt: string;
}

interface AgentStatusSnapshot {
  isActive: boolean;
  mode: string;
  actionsToday: number;
  pendingApprovals: number;
  goalsActive: number;
  anomaliesDetected: number;
  modelMesh: Array<{ provider: string; healthy: boolean; keys: number }>;
  capabilities: string[];
}

const QUICK_COMMANDS = [
  { icon: Command, label: "حالة الوكيل", command: "حالة الوكيل" },
  { icon: TrendingUp, label: "المؤشرات", command: "المؤشرات" },
  { icon: AlertTriangle, label: "الشذوذ", command: "الشذوذ" },
  { icon: WandSparkles, label: "الفرص", command: "الفرص" },
  { icon: ScanSearch, label: "لقطة للنظام", command: "لقطة للنظام" },
  { icon: MessageSquare, label: "خطط لمهمة", command: "خطط لمهمة جديدة لتحسين المنصة" },
  { icon: Shield, label: "الموافقات", command: "الموافقات" },
  { icon: Zap, label: "نسخ احتياطي", command: "نسخ احتياطي" },
];

function fetchAdmin(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, {
    credentials: "include",
    ...init,
  });
}

export function UltimateAgentChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content:
        "أنا النواة التنفيذية في صفحة الاستخبارات. أقدر أحلل، أخطط، أشغّل أدوات حقيقية، وأطلب موافقتك قبل أي إجراء حساس.",
      timestamp: new Date(),
      type: "response",
      metadata: {
        suggestions: ["حالة الوكيل", "المؤشرات", "لقطة للنظام"],
      },
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [status, setStatus] = useState<AgentStatusSnapshot | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchPendingApprovals = useCallback(async () => {
    try {
      const response = await fetchAdmin("/api/admin/agent/ultimate?action=approvals");
      const data = await response.json();
      if (data.success && Array.isArray(data.requests)) {
        setPendingApprovals(data.requests);
      }
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      setStatusLoading(true);
      const response = await fetchAdmin("/api/admin/agent/ultimate?action=status");
      const data = await response.json();
      if (data.success && data.status) {
        setStatus(data.status);
      }
    } catch (error) {
      console.error("Failed to fetch agent status:", error);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchPendingApprovals();
    const interval = setInterval(() => {
      fetchStatus();
      fetchPendingApprovals();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPendingApprovals, fetchStatus]);

  const appendMessage = useCallback((message: Message) => {
    startTransition(() => {
      setMessages((prev) => [...prev, message]);
    });
  }, []);

  const sendCommand = useCallback(
    async (command: string) => {
      if (!command.trim() || isLoading) return;

      appendMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: command,
        timestamp: new Date(),
        type: "command",
      });

      setInput("");
      setIsLoading(true);

      try {
        const response = await fetchAdmin("/api/admin/agent/ultimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "command",
            payload: {
              command,
              conversationHistory: messages
                .filter((m) => m.role !== "system")
                .slice(-12)
                .map((m) => ({
                  role: m.role === "user" ? "user" : "assistant",
                  content: m.content,
                })),
            },
          }),
        });

        const data = await response.json();

        appendMessage({
          id: crypto.randomUUID(),
          role: "agent",
          content: data.message || data.error || "تمت المعالجة.",
          timestamp: new Date(),
          type: data.success ? "response" : "error",
          metadata: {
            actionTaken: data.actionTaken,
            requiresApproval: data.requiresApproval,
            suggestions: data.suggestions,
            data:
              data.data && typeof data.data === "object"
                ? {
                    intent: "intent" in data.data ? String(data.data.intent) : undefined,
                    model: "model" in data.data ? String(data.data.model) : undefined,
                  }
                : undefined,
          },
        });

        if (data.requiresApproval || data.actionTaken === "approval_requested") {
          fetchPendingApprovals();
        }

        fetchStatus();
      } catch {
        appendMessage({
          id: crypto.randomUUID(),
          role: "agent",
          content: "تعذر الوصول إلى الوكيل الآن. راجعي الجلسة أو الاتصال ثم حاولي مرة أخرى.",
          timestamp: new Date(),
          type: "error",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [appendMessage, fetchPendingApprovals, fetchStatus, isLoading, messages]
  );

  const handleApproval = useCallback(
    async (requestId: string, approved: boolean) => {
      try {
        const response = await fetchAdmin("/api/admin/agent/ultimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "handle_approval",
            payload: { requestId, approved },
          }),
        });

        const data = await response.json();

        appendMessage({
          id: crypto.randomUUID(),
          role: "system",
          content: data.message,
          timestamp: new Date(),
          type: data.success ? "response" : "error",
        });

        fetchPendingApprovals();
        fetchStatus();
      } catch (error) {
        console.error("Failed to handle approval:", error);
      }
    },
    [appendMessage, fetchPendingApprovals, fetchStatus]
  );

  const headerBadge = useMemo(() => {
    if (!status) return { label: "جاري الفحص", variant: "secondary" as const };
    if (status.mode === "active") return { label: "نشط", variant: "outline" as const };
    if (status.mode === "maintenance") return { label: "صيانة", variant: "secondary" as const };
    return { label: "متوقف", variant: "destructive" as const };
  }, [status]);

  return (
    <Card className="w-full min-h-[720px] border-white/10 bg-[#0f1115] text-white">
      <CardHeader className="space-y-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#C5A059]/15 p-2 text-[#C5A059]">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg text-white">الوكيل التنفيذي الذكي</CardTitle>
              <p className="text-xs text-white/60">
                Orchestration + Tools + Memory + Approval Gates
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {pendingApprovals.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {pendingApprovals.length} موافقة
              </Badge>
            )}
            <Badge variant={headerBadge.variant} className="gap-1">
              <Sparkles className="h-3 w-3" />
              {headerBadge.label}
            </Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-white/60">
              <Gauge className="h-4 w-4" />
              <span className="text-xs">الوضع</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {statusLoading ? "جاري..." : status?.mode || "غير معروف"}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-white/60">
              <Shield className="h-4 w-4" />
              <span className="text-xs">الموافقات</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {statusLoading ? "جاري..." : status?.pendingApprovals ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-white/60">
              <Goal className="h-4 w-4" />
              <span className="text-xs">الأهداف النشطة</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {statusLoading ? "جاري..." : status?.goalsActive ?? 0}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-white/60">
              <Zap className="h-4 w-4" />
              <span className="text-xs">Mesh النماذج</span>
            </div>
            <p className="text-sm font-semibold text-white">
              {statusLoading
                ? "جاري..."
                : status?.modelMesh?.map((item) => `${item.provider}:${item.healthy ? "OK" : "OFF"}`).join(" | ") ||
                  "غير متاح"}
            </p>
          </div>
        </div>

        {status?.capabilities?.length ? (
          <div className="flex flex-wrap gap-2">
            {status.capabilities.slice(0, 4).map((capability) => (
              <Badge key={capability} variant="secondary" className="bg-white/5 text-white/75">
                {capability}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {QUICK_COMMANDS.map((cmd) => (
            <Button
              key={cmd.label}
              variant="outline"
              size="sm"
              className="gap-1 border-white/10 bg-transparent text-white hover:bg-white/10"
              onClick={() => sendCommand(cmd.command)}
              disabled={isLoading}
            >
              <cmd.icon className="h-3 w-3" />
              {cmd.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex h-[560px] flex-col gap-4 p-0">
        {pendingApprovals.length > 0 ? (
          <div className="mx-4 mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="mb-3 flex items-center gap-2 text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">موافقات معلقة</span>
            </div>

            <div className="space-y-2">
              {pendingApprovals.slice(0, 3).map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">{req.description}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge
                        variant={req.riskLevel === "critical" ? "destructive" : "secondary"}
                        className="text-[10px]"
                      >
                        {req.riskLevel}
                      </Badge>
                      <span className="text-xs text-white/50">
                        {new Date(req.requestedAt).toLocaleString("ar-EG")}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                      onClick={() => handleApproval(req.id, true)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      onClick={() => handleApproval(req.id, false)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4">
          <div className="space-y-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`mt-1 rounded-lg p-2 ${
                    message.role === "user"
                      ? "bg-[#C5A059] text-[#161616]"
                      : message.role === "system"
                      ? "bg-blue-500/15 text-blue-200"
                      : message.type === "error"
                      ? "bg-rose-500/15 text-rose-200"
                      : "bg-white/10 text-white"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="h-4 w-4" />
                  ) : message.role === "system" ? (
                    <Shield className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>

                <div className={`max-w-[82%] ${message.role === "user" ? "text-right" : ""}`}>
                  <div
                    className={`rounded-2xl border px-4 py-3 ${
                      message.role === "user"
                        ? "border-[#C5A059]/30 bg-[#C5A059]/15 text-white"
                        : message.role === "system"
                        ? "border-blue-400/20 bg-blue-500/10 text-blue-50"
                        : message.type === "error"
                        ? "border-rose-400/20 bg-rose-500/10 text-rose-50"
                        : "border-white/10 bg-white/5 text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                    <span>
                      <Clock className="mr-1 inline h-3 w-3" />
                      {message.timestamp.toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {message.metadata?.data?.intent ? (
                      <Badge variant="secondary" className="bg-white/5 text-white/65">
                        {message.metadata.data.intent}
                      </Badge>
                    ) : null}

                    {message.metadata?.data?.model ? (
                      <Badge variant="secondary" className="bg-white/5 text-white/65">
                        {message.metadata.data.model}
                      </Badge>
                    ) : null}
                  </div>

                  {message.metadata?.suggestions?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.metadata.suggestions.map((suggestion) => (
                        <button
                          key={`${message.id}-${suggestion}`}
                          onClick={() => sendCommand(suggestion)}
                          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 transition hover:bg-white/10 hover:text-white"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {isLoading ? (
              <div className="flex gap-3">
                <div className="rounded-lg bg-white/10 p-2 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري التحليل والتنفيذ...
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              sendCommand(input);
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="اكتبي طلباً واضحاً: غيّر اللون الأساسي، اعمل خطة، حلّل SEO..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={isLoading}
              className="border-white/10 bg-white/5 text-white placeholder:text-white/35"
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-[#C5A059] text-[#161616] hover:bg-[#d5b26a]"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
