"use client";

/**
 * Ultimate Agent Chat Component
 *
 * Advanced chat interface for interacting with the Ultimate Intelligence Agent
 * Features: Command suggestions, real-time responses, approval handling
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Loader2,
  Command,
  TrendingUp,
  Shield,
  Zap,
  MessageSquare,
  Clock
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: Date;
  type?: "command" | "response" | "approval_request" | "error" | "suggestion";
  metadata?: {
    actionTaken?: string;
    requiresApproval?: boolean;
    suggestions?: string[];
    data?: unknown;
  };
}

interface ApprovalRequest {
  id: string;
  actionType: string;
  description: string;
  riskLevel: string;
  requestedAt: string;
}

const QUICK_COMMANDS = [
  { icon: TrendingUp, label: "المؤشرات", command: "المؤشرات" },
  { icon: AlertTriangle, label: "الشذوذ", command: "الشذوذ" },
  { icon: Zap, label: "الفرص", command: "الفرص" },
  { icon: Shield, label: "الموافقات", command: "الموافقات" },
  { icon: Command, label: "الحالة", command: "حالة الوكيل" },
  { icon: Sparkles, label: "توصيات", command: "توصيات استراتيجية" },
  { icon: MessageSquare, label: "الخطط", command: "خطط لإضافة قسم جديد" },
  { icon: Clock, label: "النسخ الاحتياطية", command: "نسخ احتياطي" },
];


export function UltimateAgentChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "agent",
      content: "مرحباً! أنا الوكيل الذكي لـ Azenith Living. كيف يمكنني مساعدتك اليوم؟",
      timestamp: new Date(),
      type: "response",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch pending approvals periodically
  useEffect(() => {
    fetchPendingApprovals();
    const interval = setInterval(fetchPendingApprovals, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch("/api/admin/agent/ultimate?action=approvals");
      const data = await response.json();
      if (data.success && data.requests) {
        setPendingApprovals(data.requests);
      }
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
    }
  };

  const sendCommand = useCallback(async (command: string) => {
    if (!command.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: command,
      timestamp: new Date(),
      type: "command",
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/agent/ultimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "command",
          payload: { command, context: {} },
        }),
      });

      const data = await response.json();

      const agentMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: data.message || data.error || "تم تنفيذ الأمر",
        timestamp: new Date(),
        type: data.success ? "response" : "error",
        metadata: {
          actionTaken: data.actionTaken,
          requiresApproval: data.requiresApproval,
          suggestions: data.suggestions,
          data: data.data,
        },
      };

      setMessages((prev) => [...prev, agentMessage]);

      // Refresh approvals if needed
      if (data.requiresApproval || data.actionTaken === "approval_requested") {
        fetchPendingApprovals();
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: "عذراً، حدث خطأ في الاتصال بالوكيل. يرجى المحاولة مرة أخرى.",
        timestamp: new Date(),
        type: "error",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleApproval = async (requestId: string, approved: boolean) => {
    try {
      const response = await fetch("/api/admin/agent/ultimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "handle_approval",
          payload: { requestId, approved },
        }),
      });

      const data = await response.json();

      const systemMessage: Message = {
        id: Date.now().toString(),
        role: "system",
        content: data.message,
        timestamp: new Date(),
        type: data.success ? "response" : "error",
      };

      setMessages((prev) => [...prev, systemMessage]);

      // Refresh approvals
      fetchPendingApprovals();
    } catch (error) {
      console.error("Failed to handle approval:", error);
    }
  };

  const handleQuickCommand = (command: string) => {
    sendCommand(command);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendCommand(input);
  };

  return (
    <Card className="w-full h-[600px] flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">الوكيل الذكي</CardTitle>
              <p className="text-xs text-muted-foreground">Ultimate Intelligence Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingApprovals.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {pendingApprovals.length} موافقات
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Sparkles className="h-3 w-3" />
              نشط
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 p-0">
        {/* Quick Commands */}
        <div className="px-4">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-2 pb-2">
              {QUICK_COMMANDS.map((cmd) => (
                <Button
                  key={cmd.label}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 gap-1"
                  onClick={() => handleQuickCommand(cmd.command)}
                  disabled={isLoading}
                >
                  <cmd.icon className="h-3 w-3" />
                  {cmd.label}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <div className="px-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium text-sm">موافقات معلقة</span>
              </div>
              {pendingApprovals.slice(0, 2).map((req) => (
                <div
                  key={req.id}
                  className="bg-white rounded p-2 flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{req.description}</p>
                    <Badge variant={req.riskLevel === "critical" ? "destructive" : "secondary"} className="text-xs">
                      {req.riskLevel}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-green-600"
                      onClick={() => handleApproval(req.id, true)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-600"
                      onClick={() => handleApproval(req.id, false)}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`p-2 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.role === "system"
                      ? "bg-secondary"
                      : "bg-muted"
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
                <div
                  className={`flex-1 max-w-[80%] ${
                    message.role === "user" ? "text-right" : ""
                  }`}
                >
                  <div
                    className={`inline-block rounded-lg px-3 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : message.role === "system"
                        ? "bg-secondary border border-border"
                        : message.type === "error"
                        ? "bg-red-50 text-red-800 border border-red-200"
                        : "bg-muted"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {message.timestamp.toLocaleTimeString("ar-SA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {message.metadata?.suggestions && (
                      <div className="flex gap-1 flex-wrap">
                        {message.metadata.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => sendCommand(suggestion)}
                            className="text-xs text-primary hover:underline"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">جاري المعالجة...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="اكتب أمراً أو سؤالاً..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
