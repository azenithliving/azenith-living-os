"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ExternalLink, Loader2, MessageCircle, Send, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ResultAction } from "@/lib/admin-result-actions";

type DockMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool?: string;
  actions?: ResultAction[];
};

type ProactiveAlert = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  href?: string;
};

function shouldOpenBrowser(text: string) {
  return /متصفح|تصفح|browser|استخدم.*المتصفح|ابحث|بحث|اتعلم|تعلم|استكشف|ai agents?|ذكاءات|موقع|رابط|https?:\/\//i.test(
    text
  );
}

export function GlobalAssistantDock() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [messages, setMessages] = useState<DockMessage[]>([
    {
      id: "hello",
      role: "assistant",
      content: "أنا موجود معك في كل لوحة الأدمن. اكتب أي طلب، أو هنبّهك لو لاحظت شيئاً يحتاج انتباهك.",
    },
  ]);
  const seenAlerts = useRef<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const hidden = pathname?.startsWith("/gate") || pathname?.includes("/login");
  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

  const pushAssistantMessage = useCallback(
    (message: Omit<DockMessage, "id" | "role">) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", ...message },
      ]);
      if (!open) setUnread((count) => Math.min(count + 1, 9));
    },
    [open]
  );

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/assistant", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (!Array.isArray(data.history)) return;
      const restored = data.history
        .filter((item: { role: string }) => item.role === "user" || item.role === "assistant")
        .slice(-10)
        .map((item: { role: string; content: string; command_executed?: string }) => ({
          id: crypto.randomUUID(),
          role: item.role === "user" ? "user" : "assistant",
          content: item.content,
          tool: item.command_executed,
        })) as DockMessage[];
      if (restored.length > 0) {
        setMessages((prev) => [prev[0], ...restored]);
      }
    } catch {
      /* keep local dock state */
    }
  }, []);

  const pollProactive = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/proactive", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { alerts?: ProactiveAlert[] };
      for (const alert of data.alerts || []) {
        if (alert.id === "all-clear" || seenAlerts.current.has(alert.id)) continue;
        seenAlerts.current.add(alert.id);
        pushAssistantMessage({
          content: `${alert.title}\n${alert.description}`,
          tool: "proactive_watch",
          actions: alert.href
            ? [{ label: "افتح المكان", href: alert.href, kind: "internal" }]
            : undefined,
        });
      }
    } catch {
      /* silent polling */
    }
  }, [pushAssistantMessage]);

  useEffect(() => {
    if (hidden) return;
    void loadHistory();
    void pollProactive();
    const timer = window.setInterval(() => {
      void pollProactive();
    }, 25_000);
    return () => window.clearInterval(timer);
  }, [hidden, loadHistory, pollProactive]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      scrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);

    if (shouldOpenBrowser(trimmed)) {
      pushAssistantMessage({
        content: "سأستخدم المتصفح الحي من صفحة المساعد لتنفيذ هذه المهمة. افتح صفحة المساعد لو أردت مشاهدة التصفح لحظة بلحظة.",
        tool: "browser_handoff",
        actions: [{ label: "افتح المتصفح الحي", href: "/admin/assistant", kind: "internal" }],
      });
    }

    try {
      const response = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "فشل إرسال الطلب");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply || "تمت المعالجة.",
          tool: data.command?.name,
          actions: Array.isArray(data.actions) ? data.actions : [],
        },
      ]);
    } catch (error) {
      pushAssistantMessage({
        content: error instanceof Error ? error.message : "حصل خطأ أثناء التواصل مع المساعد.",
      });
    } finally {
      setLoading(false);
    }
  }

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          setUnread(0);
        }}
        className="fixed bottom-24 left-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-2xl border border-[#C5A059]/45 bg-[#15110a] text-[#f2dca5] shadow-2xl shadow-black/50 transition-transform hover:scale-105"
        title="المساعد الموحد"
      >
        <MessageCircle className="h-6 w-6" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-[#03131a]">
            {unread}
          </span>
        )}
      </button>

      {!open && latestAssistant && (
        <div className="pointer-events-none fixed bottom-40 left-6 z-[9998] hidden max-w-[280px] rounded-2xl border border-white/10 bg-[#101010]/90 p-3 text-xs text-white/70 shadow-2xl shadow-black/40 backdrop-blur md:block">
          <div className="mb-1 flex items-center gap-1 font-semibold text-[#f2dca5]">
            <Bot className="h-3.5 w-3.5" />
            المساعد
          </div>
          <p className="line-clamp-2">{latestAssistant.content}</p>
        </div>
      )}

      {open && (
        <div className="fixed bottom-40 left-6 z-[9999] flex h-[min(72vh,560px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101010]/95 text-white shadow-2xl shadow-black/70 backdrop-blur" dir="rtl">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4 text-[#C5A059]" />
              المساعد الموحد
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-200" />}
            </div>
            <div className="flex items-center gap-1">
              <Link href="/admin/agents?tab=assistant" className="rounded-lg p-1 text-white/55 hover:bg-white/10" title="افتح الصفحة الكاملة">
                <ExternalLink className="h-4 w-4" />
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-white/55 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-xs">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border px-3 py-2 ${
                  message.role === "user"
                    ? "mr-8 border-[#C5A059]/25 bg-[#C5A059]/10 text-[#f0dca8]"
                    : "ml-8 border-white/10 bg-white/[0.04] text-white/80"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.tool && <p className="mt-1 font-mono text-[10px] text-[#C5A059]/80">{message.tool}</p>}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <Link
                        key={`${action.label}-${action.href}`}
                        href={action.href}
                        className="rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 px-2 py-1 text-[10px] text-[#f0dca8]"
                      >
                        {action.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div ref={scrollRef} />
          </div>

          <form
            className="border-t border-white/10 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(input);
            }}
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={loading}
                placeholder="اكتب للمساعد..."
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs outline-none placeholder:text-white/35"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="rounded-xl bg-[#C5A059] px-3 py-2 text-[#1a1a1a] disabled:opacity-45"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
