"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronDown,
  CopyPlus,
  ExternalLink,
  Eye,
  Maximize2,
  Minimize2,
  Globe,
  Hand,
  Laptop,
  Monitor,
  Smartphone,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

type BrowserSession =
  | {
      success: true;
      browser: {
        label: string;
        viewerUrl: string;
        healthUrl: string;
        source?: "self-hosted" | "oci";
      };
    }
  | {
      success: false;
      error: string;
      details?: string;
    };

type BuiltInBrowserStatus = {
  ready: boolean;
  url: string;
  title: string;
  startedAt?: string;
  error?: string;
  deviceMode?: "desktop" | "mobile";
  networkMode?: "direct" | "tor" | "custom";
  activeTabIndex?: number;
  tabs?: Array<{
    index: number;
    url: string;
    title: string;
    active: boolean;
  }>;
};

type BrowserChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool?: string;
};

type BrowserCopilotProps = {
  autoOpenSignal?: number;
  assistantMessages?: BrowserChatMessage[];
  assistantBusy?: boolean;
  onSendMessage?: (message: string) => void;
};

const CUSTOM_VIEWER_URL_KEY = "admin_browser_custom_viewer_url";

const SEARCH_PROVIDERS = [
  {
    id: "google",
    label: "Google",
    home: "https://www.google.com/",
    search: (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "bing",
    label: "Microsoft Bing",
    home: "https://www.bing.com/",
    search: (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "brave",
    label: "Brave",
    home: "https://search.brave.com/",
    search: (query: string) => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "duckduckgo",
    label: "DuckDuckGo",
    home: "https://duckduckgo.com/",
    search: (query: string) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  },
  {
    id: "startpage",
    label: "Startpage",
    home: "https://www.startpage.com/",
    search: (query: string) => `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}`,
  },
  {
    id: "yahoo",
    label: "Yahoo",
    home: "https://search.yahoo.com/",
    search: (query: string) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`,
  },
  {
    id: "ecosia",
    label: "Ecosia",
    home: "https://www.ecosia.org/",
    search: (query: string) => `https://www.ecosia.org/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: "youtube",
    label: "YouTube",
    home: "https://www.youtube.com/",
    search: (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  },
] as const;

const NETWORK_MODES = [
  {
    id: "direct",
    label: "مباشر",
    hint: "اتصال الجهاز الحالي",
  },
  {
    id: "tor",
    label: "Tor",
    hint: "يتطلب Tor SOCKS على الجهاز",
  },
  {
    id: "custom",
    label: "Proxy",
    hint: "يتطلب ADMIN_LIVE_BROWSER_PROXY_SERVER",
  },
] as const;

function looksLikeUrl(value: string) {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(trimmed);
}

function normalizeAddress(value: string, provider: (typeof SEARCH_PROVIDERS)[number]) {
  const trimmed = value.trim();
  if (!trimmed) return provider.home;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (looksLikeUrl(trimmed)) return `https://${trimmed}`;
  return provider.search(trimmed);
}

function normalizeViewerUrl(value: string) {
  const trimmed = value.trim().replace(/['"`]/g, "");
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function needsHumanIntervention(status: BuiltInBrowserStatus | null) {
  const haystack = `${status?.url || ""} ${status?.title || ""}`.toLowerCase();
  if (/captcha|recaptcha|challenge|verify|verification|2fa|two-factor|otp/.test(haystack)) {
    return "خطوة تحقق أو كابتشا/2FA محتاجة تدخلك. استلم التحكم، خلصها، ثم رجع للمساعد.";
  }
  if (/login|signin|sign-in|auth|account|تسجيل|دخول/.test(haystack)) {
    return "الصفحة تبدو تسجيل دخول. لو محتاجة حسابك استلم التحكم، وبعدها رجع للمساعد يكمل.";
  }
  return null;
}

function browserActionLabel(body: Record<string, unknown>) {
  const action = String(body.action || "");
  if (action === "goto") return `أفتح ${String(body.url || "صفحة")}`;
  if (action === "newTab") return "أفتح تبويب جديد";
  if (action === "switchTab") return "أبدل التبويب";
  if (action === "closeTab") return "أغلق تبويب";
  if (action === "reload") return "أحدث الصفحة";
  if (action === "back") return "أرجع للخلف";
  if (action === "forward") return "أتقدم للأمام";
  if (action === "setDevice") return `أغير العرض إلى ${body.mode === "mobile" ? "موبايل" : "كمبيوتر"}`;
  if (action === "setNetwork") return `أغير مسار الاتصال إلى ${String(body.mode || "direct")}`;
  if (action === "click") return "أنفذ ضغطة داخل الصفحة";
  if (action === "type") return "أكتب داخل الصفحة";
  if (action === "scroll") return "أمرر الصفحة";
  return "أتعامل مع المتصفح";
}

export function AssistantBrowserCopilot({
  autoOpenSignal = 0,
  assistantMessages = [],
  assistantBusy = false,
  onSendMessage,
}: BrowserCopilotProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [session, setSession] = useState<BrowserSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [controlMode, setControlMode] = useState<"assistant" | "human">("assistant");
  const [customViewerUrl, setCustomViewerUrl] = useState("");
  const [builtInBrowser, setBuiltInBrowser] = useState<BuiltInBrowserStatus | null>(null);
  const [builtInLoading, setBuiltInLoading] = useState(false);
  const [builtInError, setBuiltInError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState("https://www.google.com/");
  const [searchProviderId, setSearchProviderId] =
    useState<(typeof SEARCH_PROVIDERS)[number]["id"]>("google");
  const [screenshotKey, setScreenshotKey] = useState(0);
  const [streamKey, setStreamKey] = useState(0);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [floatingInput, setFloatingInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [liveSteps, setLiveSteps] = useState<
    Array<{ id: string; text: string; tone: "info" | "done" | "warn" }>
  >([]);

  const managedBrowser = session?.success ? session.browser : null;
  const externalBrowser = customViewerUrl
    ? {
        label: "متصفحك المتصل",
        viewerUrl: customViewerUrl,
        healthUrl: "",
      }
    : managedBrowser;
  const searchProvider =
    SEARCH_PROVIDERS.find((provider) => provider.id === searchProviderId) ||
    SEARCH_PROVIDERS[0];
  const activeNetworkMode = builtInBrowser?.networkMode || "direct";

  const statusLabel = useMemo(() => {
    if (loading || builtInLoading) return "جاري الاتصال";
    if (builtInBrowser?.ready) return "متصل";
    if (externalBrowser) return "جاهز";
    return "غير متصل";
  }, [builtInBrowser?.ready, builtInLoading, externalBrowser, loading]);

  const addLiveStep = useCallback(
    (text: string, tone: "info" | "done" | "warn" = "info") => {
      setLiveSteps((steps) => [
        { id: crypto.randomUUID(), text, tone },
        ...steps.slice(0, 8),
      ]);
      if (expanded && !copilotOpen) setUnreadCount((count) => Math.min(count + 1, 9));
    },
    [copilotOpen, expanded]
  );

  useEffect(() => {
    const saved = localStorage.getItem(CUSTOM_VIEWER_URL_KEY);
    const normalized = saved ? normalizeViewerUrl(saved) : null;
    if (normalized) setCustomViewerUrl(normalized);
    else if (saved) localStorage.removeItem(CUSTOM_VIEWER_URL_KEY);
  }, []);

  const loadRemoteSession = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/remote-browser/session", {
        method: "GET",
        cache: "no-store",
      });
      setSession((await response.json()) as BrowserSession);
    } catch (error) {
      setSession({
        success: false,
        error: error instanceof Error ? error.message : "تعذر فتح المتصفح السحابي",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBuiltInBrowser = useCallback(async () => {
    setBuiltInLoading(true);
    setBuiltInError(null);
    try {
      const response = await fetch("/api/admin/live-browser/session", {
        method: "GET",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        success: boolean;
        browser?: BuiltInBrowserStatus;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.browser) {
        throw new Error(payload.error || "تعذر تشغيل المتصفح الداخلي.");
      }
      setBuiltInBrowser(payload.browser);
      if (payload.browser.url && payload.browser.url !== "about:blank") {
        setUrlDraft(payload.browser.url);
      }
      addLiveStep(
        payload.browser.url && payload.browser.url !== "about:blank"
          ? `المتصفح على: ${payload.browser.title || payload.browser.url}`
          : "المتصفح الحي جاهز",
        "done"
      );
      setScreenshotKey((value) => value + 1);
      setStreamKey((value) => value + 1);
    } catch (error) {
      setBuiltInError(error instanceof Error ? error.message : "تعذر تشغيل المتصفح الداخلي.");
    } finally {
      setBuiltInLoading(false);
    }
  }, [addLiveStep]);

  const runBuiltInAction = useCallback(async (body: Record<string, unknown>) => {
    setBuiltInLoading(true);
    setBuiltInError(null);
    addLiveStep(browserActionLabel(body), "info");
    try {
      const response = await fetch("/api/admin/live-browser/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        success: boolean;
        browser?: BuiltInBrowserStatus;
        error?: string;
      };
      if (!response.ok || !payload.success || !payload.browser) {
        throw new Error(payload.error || "تعذر تنفيذ أمر المتصفح.");
      }
      setBuiltInBrowser(payload.browser);
      if (payload.browser.url && payload.browser.url !== "about:blank") {
        setUrlDraft(payload.browser.url);
      }
      addLiveStep(`تم: ${payload.browser.title || payload.browser.url || browserActionLabel(body)}`, "done");
      setScreenshotKey((value) => value + 1);
    } catch (error) {
      setBuiltInError(error instanceof Error ? error.message : "تعذر تنفيذ أمر المتصفح.");
      addLiveStep(error instanceof Error ? error.message : "تعذر تنفيذ أمر المتصفح", "warn");
    } finally {
      setBuiltInLoading(false);
    }
  }, [addLiveStep]);

  useEffect(() => {
    if (!open || builtInBrowser || builtInLoading) return;
    void refreshBuiltInBrowser();
  }, [builtInBrowser, builtInLoading, open, refreshBuiltInBrowser]);

  useEffect(() => {
    if (autoOpenSignal <= 0) return;
    setOpen(true);
    setCopilotOpen(true);
    addLiveStep("فتحت المتصفح تلقائيا لأن المهمة تحتاج تصفح حي.", "info");
    void refreshBuiltInBrowser();
  }, [addLiveStep, autoOpenSignal, refreshBuiltInBrowser]);

  useEffect(() => {
    if (!open || session) return;
    void loadRemoteSession();
  }, [loadRemoteSession, open, session]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      void refreshBuiltInBrowser();
    }, expanded ? 2500 : 4000);
    return () => window.clearInterval(timer);
  }, [expanded, open, refreshBuiltInBrowser]);

  useEffect(() => {
    const message = needsHumanIntervention(builtInBrowser);
    if (message) addLiveStep(message, "warn");
  }, [addLiveStep, builtInBrowser?.title, builtInBrowser?.url]);

  useEffect(() => {
    if (!expanded || copilotOpen || assistantMessages.length === 0) return;
    setUnreadCount((count) => Math.min(count + 1, 9));
  }, [assistantMessages.length, copilotOpen, expanded]);

  const openViewer = () => {
    const target = externalBrowser?.viewerUrl || builtInBrowser?.url;
    if (!target || target === "about:blank") return;
    window.open(target, "_blank", "noopener,noreferrer");
  };

  const navigateAddress = () => {
    void runBuiltInAction({
      action: "goto",
      url: normalizeAddress(urlDraft, searchProvider),
    });
  };

  const clickBuiltInScreenshot = (event: MouseEvent<HTMLImageElement>) => {
    event.currentTarget.focus();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(((event.clientX - rect.left) / rect.width) * 1280);
    const y = Math.round(((event.clientY - rect.top) / rect.height) * 720);
    void runBuiltInAction({ action: "click", x, y });
  };

  const scrollBuiltInScreenshot = (event: WheelEvent<HTMLImageElement>) => {
    if (!builtInBrowser?.ready || builtInLoading) return;
    event.preventDefault();
    void runBuiltInAction({
      action: "scroll",
      deltaX: event.deltaX,
      deltaY: event.deltaY,
    });
  };

  const sendKeyToBuiltInBrowser = (event: KeyboardEvent<HTMLImageElement>) => {
    if (!builtInBrowser?.ready || builtInLoading) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();

    if (event.key.length === 1) {
      void runBuiltInAction({ action: "type", text: event.key });
      return;
    }

    const key = event.key === " " ? "Space" : event.key;
    const supportedKeys = new Set([
      "Enter",
      "Backspace",
      "Delete",
      "Tab",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
      "Space",
    ]);

    if (supportedKeys.has(key)) {
      void runBuiltInAction({ action: "press", key });
    }
  };

  const sendFloatingMessage = () => {
    const text = floatingInput.trim();
    if (!text || !onSendMessage) return;
    setFloatingInput("");
    setCopilotOpen(true);
    onSendMessage(text);
  };

  const visibleAssistantMessages = assistantMessages.slice(-8);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-sm hover:border-cyan-300/60 md:w-auto"
      >
        <span className="flex items-center gap-2 font-semibold">
          <Monitor className="h-4 w-4 text-cyan-200" />
          المتصفح الحي
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/60">
            {statusLabel}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 text-cyan-200 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={
            expanded
              ? "fixed inset-0 z-50 overflow-hidden bg-[#0b0b0b] shadow-2xl shadow-black/70"
              : "absolute right-0 top-full z-30 mt-2 w-[min(92vw,980px)] overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl shadow-black/50"
          }
        >
          <div className={expanded ? "flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5" : "grid gap-3 border-b border-white/10 p-4 lg:grid-cols-[1fr_auto]"}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-100">
                  {builtInBrowser?.ready || externalBrowser ? (
                    <Wifi className="h-3.5 w-3.5" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" />
                  )}
                  {externalBrowser ? externalBrowser.label : builtInBrowser?.ready ? "Chromium داخلي حقيقي" : statusLabel}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
                  {controlMode === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <Hand className="h-3.5 w-3.5" />}
                  {expanded ? "" : controlMode === "assistant" ? "وضع المساعد" : "تدخل بشري"}
                </span>
                {builtInBrowser?.ready && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/55">
                    <Globe className="h-3.5 w-3.5" />
                    {expanded
                      ? ""
                      : NETWORK_MODES.find((mode) => mode.id === activeNetworkMode)?.label || "مباشر"}
                  </span>
                )}
              </div>
              <p className={expanded ? "hidden" : "mt-3 text-xs leading-6 text-white/55"}>
                التحكم صار من المتصفح نفسه: تبويبات، عنوان، رجوع، أمام، تحديث، ضغط، تمرير، وكتابة مباشرة بعد اختيار الحقل.
              </p>
            </div>

            <div className={expanded ? "flex shrink-0 items-center gap-1" : "flex flex-wrap items-start gap-2"}>
              <button
                type="button"
                onClick={() => setControlMode(controlMode === "assistant" ? "human" : "assistant")}
                title={controlMode === "assistant" ? "سلّمني التحكم" : "رجّع للمساعد"}
                className={expanded ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:border-cyan-300/50" : "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:border-cyan-300/50"}
              >
                {controlMode === "assistant" ? <Hand className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                {!expanded && (controlMode === "assistant" ? "سلّمني التحكم" : "رجّع للمساعد")}
              </button>
              <button
                type="button"
                onClick={() => {
                  void refreshBuiltInBrowser();
                  void loadRemoteSession();
                }}
                disabled={loading || builtInLoading}
                title="اتصال"
                className={expanded ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:border-cyan-300/50 disabled:opacity-50" : "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:border-cyan-300/50 disabled:opacity-50"}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading || builtInLoading ? "animate-spin" : ""}`} />
                {!expanded && "اتصال"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFrameKey((value) => value + 1);
                  setScreenshotKey((value) => value + 1);
                  setStreamKey((value) => value + 1);
                }}
                disabled={!externalBrowser && !builtInBrowser?.ready}
                title="تحديث العرض"
                className={expanded ? "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/70 hover:border-cyan-300/50 disabled:opacity-40" : "inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/70 hover:border-cyan-300/50 disabled:opacity-40"}
              >
                <Eye className="h-3.5 w-3.5" />
                {!expanded && "تحديث العرض"}
              </button>
              <button
                type="button"
                onClick={openViewer}
                disabled={!externalBrowser && (!builtInBrowser?.url || builtInBrowser.url === "about:blank")}
                title="فتح كامل"
                className={expanded ? "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300 text-[#03131a] disabled:opacity-40" : "inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#03131a] disabled:opacity-40"}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {!expanded && "فتح كامل"}
              </button>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                title={expanded ? "تصغير" : "ملء الشاشة"}
                className={expanded ? "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-300 text-[#03131a]" : "inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-3 py-2 text-xs font-semibold text-[#03131a]"}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {!expanded && "ملء الشاشة"}
              </button>
            </div>
          </div>

          <div className={expanded ? "p-0" : "p-4"}>
            <div className={expanded ? "min-h-0 overflow-hidden bg-black" : "min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-black"}>
              {externalBrowser?.viewerUrl ? (
                <iframe
                  key={`${externalBrowser.viewerUrl}-${frameKey}`}
                  src={externalBrowser.viewerUrl}
                  title="المتصفح الحي داخل المساعد"
                  className={expanded ? "h-[calc(100vh-43px)] w-full border-0 bg-black" : "h-[420px] w-full border-0 bg-black lg:h-[560px]"}
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              ) : builtInBrowser?.ready ? (
                <div className={expanded ? "flex h-[calc(100vh-43px)] flex-col bg-black" : "flex h-[420px] flex-col bg-black lg:h-[560px]"}>
                  <div className="flex items-end gap-1 border-b border-white/10 bg-[#101010] px-2 pt-2">
                    <div className="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto">
                      {(builtInBrowser.tabs || []).map((tab) => (
                        <button
                          key={tab.index}
                          type="button"
                          onClick={() => void runBuiltInAction({ action: "switchTab", index: tab.index })}
                          className={`group flex max-w-[180px] shrink-0 items-center gap-2 rounded-t-xl border px-3 py-2 text-[11px] ${
                            tab.active
                              ? "border-white/15 bg-[#151515] text-white"
                              : "border-transparent bg-white/[0.04] text-white/50 hover:bg-white/[0.07]"
                          }`}
                        >
                          <span className="truncate">{tab.title || tab.url || "تبويب جديد"}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              void runBuiltInAction({ action: "closeTab", index: tab.index });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                void runBuiltInAction({ action: "closeTab", index: tab.index });
                              }
                            }}
                            className="rounded-full p-0.5 opacity-60 hover:bg-white/10 hover:opacity-100"
                            aria-label="إغلاق التبويب"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void runBuiltInAction({ action: "newTab" })}
                      disabled={builtInLoading}
                      className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/65 hover:bg-white/10 disabled:opacity-35"
                      title="تبويب جديد"
                    >
                      <CopyPlus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 border-b border-white/10 bg-[#151515] p-2">
                    <button
                      type="button"
                      onClick={() =>
                        void runBuiltInAction({
                          action: "setDevice",
                          mode: builtInBrowser.deviceMode === "mobile" ? "desktop" : "mobile",
                        })
                      }
                      disabled={builtInLoading}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/65 hover:bg-white/10 disabled:opacity-35"
                      title={builtInBrowser.deviceMode === "mobile" ? "وضع الكمبيوتر" : "وضع الموبايل"}
                    >
                      {builtInBrowser.deviceMode === "mobile" ? (
                        <Laptop className="h-4 w-4" />
                      ) : (
                        <Smartphone className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBuiltInAction({ action: "back" })}
                      disabled={builtInLoading}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/65 hover:bg-white/10 disabled:opacity-35"
                      title="رجوع"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBuiltInAction({ action: "forward" })}
                      disabled={builtInLoading}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/65 hover:bg-white/10 disabled:opacity-35"
                      title="أمام"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void runBuiltInAction({ action: "reload" })}
                      disabled={builtInLoading}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/65 hover:bg-white/10 disabled:opacity-35"
                      title="تحديث"
                    >
                      <RefreshCw className={`h-4 w-4 ${builtInLoading ? "animate-spin" : ""}`} />
                    </button>
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5">
                      <Search className="h-3.5 w-3.5 shrink-0 text-white/35" />
                      <select
                        value={activeNetworkMode}
                        onChange={(event) =>
                          void runBuiltInAction({
                            action: "setNetwork",
                            mode: event.target.value,
                          })
                        }
                        disabled={builtInLoading}
                        className="max-w-[76px] shrink-0 bg-transparent text-[10px] text-emerald-100 outline-none disabled:opacity-45"
                        title="مسار الاتصال"
                      >
                        {NETWORK_MODES.map((mode) => (
                          <option key={mode.id} value={mode.id} className="bg-[#111] text-white">
                            {mode.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={searchProviderId}
                        onChange={(event) =>
                          setSearchProviderId(
                            event.target.value as (typeof SEARCH_PROVIDERS)[number]["id"]
                          )
                        }
                        className="max-w-[108px] shrink-0 bg-transparent text-[10px] text-cyan-100 outline-none"
                        title="محرك البحث"
                      >
                        {SEARCH_PROVIDERS.map((provider) => (
                          <option key={provider.id} value={provider.id} className="bg-[#111] text-white">
                            {provider.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={urlDraft}
                        onChange={(event) => setUrlDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            navigateAddress();
                          }
                        }}
                        className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30"
                        placeholder="ابحث أو اكتب عنوان موقع"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={navigateAddress}
                      disabled={builtInLoading}
                      className="rounded-full bg-cyan-300 px-3 py-1.5 text-xs font-semibold text-[#03131a] disabled:opacity-50"
                    >
                      اذهب
                    </button>
                  </div>

                  <div className="relative min-h-0 flex-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={
                        builtInBrowser.ready
                          ? `/api/admin/live-browser/stream?fps=${expanded ? 6 : 4}&t=${streamKey}`
                          : `/api/admin/live-browser/screenshot?t=${screenshotKey}`
                      }
                      alt="بث المتصفح الحي"
                      onClick={clickBuiltInScreenshot}
                      onKeyDown={sendKeyToBuiltInBrowser}
                      onWheel={scrollBuiltInScreenshot}
                      tabIndex={0}
                      className="h-full w-full cursor-crosshair object-contain outline-none"
                    />
                    {builtInLoading && (
                      <div className="absolute left-3 top-3 rounded-full border border-cyan-300/30 bg-black/70 px-3 py-1 text-[11px] text-cyan-100">
                        جاري التنفيذ...
                      </div>
                    )}
                    {builtInError && (
                      <div className="absolute right-3 top-3 max-w-[min(92%,560px)] rounded-xl border border-amber-400/25 bg-black/80 px-3 py-2 text-[11px] leading-5 text-amber-100">
                        <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />
                        {builtInError}
                      </div>
                    )}
                    {liveSteps.length > 0 && (
                      <div className="pointer-events-none absolute bottom-3 right-3 max-w-[min(86%,520px)] rounded-2xl border border-white/10 bg-black/75 p-2 text-[11px] text-white/75 shadow-xl">
                        <div className="mb-1 flex items-center gap-1 font-semibold text-cyan-100">
                          <Bot className="h-3.5 w-3.5" />
                          متابعة حية
                        </div>
                        <div className="space-y-1">
                          {liveSteps.slice(0, 3).map((step) => (
                            <div
                              key={step.id}
                              className={
                                step.tone === "warn"
                                  ? "text-amber-200"
                                  : step.tone === "done"
                                    ? "text-emerald-200"
                                    : "text-white/70"
                              }
                            >
                              {step.tone === "done" ? "✓ " : step.tone === "warn" ? "! " : "• "}
                              {step.text}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className={expanded ? "flex h-[calc(100vh-43px)] flex-col items-center justify-center px-6 text-center" : "flex h-[420px] flex-col items-center justify-center px-6 text-center lg:h-[560px]"}>
                  <Globe className="mb-4 h-10 w-10 text-white/25" />
                  <p className="text-sm font-semibold text-white">المتصفح الداخلي يستعد للعمل</p>
                  <p className="mt-2 max-w-md text-xs leading-6 text-white/45">
                    هذا Chromium حقيقي يعمل من السيرفر المحلي. اضغط تشغيل لو لم يبدأ تلقائياً.
                  </p>
                  {builtInError && (
                    <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-6 text-amber-100">
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />
                      {builtInError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void refreshBuiltInBrowser()}
                    disabled={builtInLoading}
                    className="mt-4 rounded-xl bg-cyan-300 px-4 py-2 text-xs font-semibold text-[#03131a] disabled:opacity-50"
                  >
                    تشغيل المتصفح الحقيقي
                  </button>
                </div>
              )}
            </div>
          </div>
          {expanded && (
            <>
              <button
                type="button"
                onClick={() => {
                  setCopilotOpen((value) => !value);
                  setUnreadCount(0);
                }}
                className="fixed bottom-4 left-4 z-[60] flex h-12 w-12 items-center justify-center rounded-2xl border border-[#C5A059]/45 bg-[#15110a] text-[#f2dca5] shadow-2xl shadow-black/60"
                title="المساعد الموحد"
              >
                <Bot className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-300 px-1 text-[10px] font-bold text-[#03131a]">
                    {unreadCount}
                  </span>
                )}
              </button>

              {copilotOpen && (
                <div className="fixed bottom-20 left-4 z-[60] flex h-[min(72vh,520px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101010]/95 shadow-2xl shadow-black/70 backdrop-blur">
                  <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Bot className="h-4 w-4 text-[#C5A059]" />
                      المساعد معك
                      {assistantBusy && <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-200" />}
                    </div>
                    <button type="button" onClick={() => setCopilotOpen(false)} className="rounded-lg p-1 text-white/55 hover:bg-white/10">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="border-b border-white/10 p-2">
                    <button
                      type="button"
                      onClick={() => setControlMode(controlMode === "assistant" ? "human" : "assistant")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#C5A059]/30 bg-[#C5A059]/10 px-3 py-2 text-xs font-semibold text-[#f1dca6]"
                    >
                      {controlMode === "assistant" ? <Hand className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      {controlMode === "assistant" ? "استلمت التحكم" : "رجع للمساعد"}
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-xs">
                    {liveSteps.length > 0 && (
                      <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-2">
                        <div className="mb-1 font-semibold text-cyan-100">سجل الجلسة الحي</div>
                        {liveSteps.slice(0, 5).map((step) => (
                          <div key={step.id} className={step.tone === "warn" ? "text-amber-200" : step.tone === "done" ? "text-emerald-200" : "text-white/65"}>
                            {step.tone === "done" ? "✓ " : step.tone === "warn" ? "! " : "• "}
                            {step.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {visibleAssistantMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-xl border px-3 py-2 ${
                          message.role === "user"
                            ? "border-[#C5A059]/25 bg-[#C5A059]/10 text-[#f0dca8]"
                            : "border-white/10 bg-white/[0.04] text-white/80"
                        }`}
                      >
                        <p className="whitespace-pre-wrap line-clamp-5">{message.content}</p>
                        {message.tool && <p className="mt-1 font-mono text-[10px] text-[#C5A059]/80">{message.tool}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/10 p-2">
                    <div className="flex gap-2">
                      <input
                        value={floatingInput}
                        onChange={(event) => setFloatingInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") sendFloatingMessage();
                        }}
                        placeholder="اكتب للمساعد..."
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white outline-none placeholder:text-white/35"
                      />
                      <button
                        type="button"
                        onClick={sendFloatingMessage}
                        disabled={!floatingInput.trim() || assistantBusy}
                        className="rounded-xl bg-[#C5A059] px-3 py-2 text-xs font-semibold text-[#1a1a1a] disabled:opacity-45"
                      >
                        إرسال
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
