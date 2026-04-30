"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Globe,
  Link2,
  Monitor,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";

interface ManagedBrowserSessionSuccess {
  success: true;
  browser: {
    label: string;
    viewerUrl: string;
    healthUrl: string;
    source?: "self-hosted" | "oci";
  };
}

interface ManagedBrowserSessionFailure {
  success: false;
  error: string;
  details?: string;
}

interface ManagedBrowserHealthSuccess {
  success: true;
  ok: true;
  checkedAt: string;
}

interface ManagedBrowserHealthFailure {
  success: false;
  ok: false;
  checkedAt: string;
  error: string;
}

type ManagedBrowserSessionResponse =
  | ManagedBrowserSessionSuccess
  | ManagedBrowserSessionFailure;
type ManagedBrowserHealthResponse =
  | ManagedBrowserHealthSuccess
  | ManagedBrowserHealthFailure;
type ViewerMode = "managed" | "custom";

const CUSTOM_VIEWER_URL_KEY = "admin_browser_custom_viewer_url";
const PREFERRED_VIEWER_MODE_KEY = "admin_browser_preferred_mode";
const HEALTH_POLL_INTERVAL_MS = 30_000;

const launchers = [
  {
    label: "WhatsApp Web",
    description: "Fast direct launch in your current browser.",
    url: "https://web.whatsapp.com/",
  },
  {
    label: "Telegram Web",
    description: "Useful when you need a light messaging window.",
    url: "https://web.telegram.org/",
  },
  {
    label: "Facebook",
    description: "Open the full web app in a separate tab.",
    url: "https://www.facebook.com/",
  },
  {
    label: "Instagram",
    description: "Open the full web app in a separate tab.",
    url: "https://www.instagram.com/",
  },
];

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function normalizeViewerUrl(value: string) {
  const trimmedValue = value.trim().replace(/['"`]/g, "");

  if (!trimmedValue) {
    return { ok: false as const, error: "Viewer URL is required." };
  }

  try {
    const parsedUrl = new URL(trimmedValue);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return { ok: false as const, error: "Viewer URL must use http or https." };
    }

    return { ok: true as const, url: parsedUrl.toString() };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Invalid viewer URL.",
    };
  }
}

export default function BrowserWorkspacePage() {
  const [managedBrowser, setManagedBrowser] =
    useState<ManagedBrowserSessionSuccess["browser"] | null>(null);
  const [managedStatus, setManagedStatus] = useState<"loading" | "ready" | "error">("loading");
  const [managedHealth, setManagedHealth] = useState<{ ok: boolean; checkedAt?: string }>({
    ok: false,
  });
  const [managedError, setManagedError] = useState<string | null>(null);
  const [customViewerUrl, setCustomViewerUrl] = useState("");
  const [customViewerDraft, setCustomViewerDraft] = useState("");
  const [preferredMode, setPreferredMode] = useState<ViewerMode | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);

  const refreshManagedHealth = useCallback(
    async (nextBrowser?: ManagedBrowserSessionSuccess["browser"]) => {
      const target = nextBrowser || managedBrowser;
      if (!target?.healthUrl) return;

      try {
        const response = await fetch(target.healthUrl, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await parseJsonResponse<ManagedBrowserHealthResponse>(response);

        if (!response.ok || !payload.ok) {
          setManagedHealth({
            ok: false,
            checkedAt: payload.checkedAt,
          });
          return;
        }

        setManagedHealth({
          ok: true,
          checkedAt: payload.checkedAt,
        });
      } catch {
        setManagedHealth({
          ok: false,
        });
      }
    },
    [managedBrowser]
  );

  const loadManagedSession = useCallback(async () => {
    setManagedStatus("loading");
    setManagedError(null);

    try {
      const response = await fetch("/api/admin/remote-browser/session", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await parseJsonResponse<ManagedBrowserSessionResponse>(response);

      if (!response.ok || !payload.success) {
        setManagedBrowser(null);
        setManagedStatus("error");
        setManagedError(
          payload.success
            ? "Managed browser unavailable."
            : payload.details || payload.error || "Managed browser unavailable."
        );
        return;
      }

      setManagedBrowser(payload.browser);
      setManagedStatus("ready");
      await refreshManagedHealth(payload.browser);
    } catch (requestError) {
      setManagedBrowser(null);
      setManagedStatus("error");
      setManagedError(
        requestError instanceof Error
          ? requestError.message
          : "Managed browser session request failed."
      );
    }
  }, [refreshManagedHealth]);

  useEffect(() => {
    const savedCustomViewerUrl = localStorage.getItem(CUSTOM_VIEWER_URL_KEY);
    const savedPreferredMode = localStorage.getItem(PREFERRED_VIEWER_MODE_KEY);

    if (savedCustomViewerUrl) {
      const normalized = normalizeViewerUrl(savedCustomViewerUrl);
      if (normalized.ok) {
        // Sync persisted browser settings after mount to avoid SSR/localStorage coupling.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCustomViewerUrl(normalized.url);
        setCustomViewerDraft(normalized.url);
      } else {
        localStorage.removeItem(CUSTOM_VIEWER_URL_KEY);
      }
    }

    if (savedPreferredMode === "managed" || savedPreferredMode === "custom") {
      setPreferredMode(savedPreferredMode);
    }

    void loadManagedSession();
  }, [loadManagedSession]);

  useEffect(() => {
    if (managedStatus !== "ready" || !managedBrowser) return;

    const interval = window.setInterval(() => {
      void refreshManagedHealth(managedBrowser);
    }, HEALTH_POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [managedBrowser, managedStatus, refreshManagedHealth]);

  const activeMode = useMemo<ViewerMode | null>(() => {
    const hasCustomViewer = Boolean(customViewerUrl);
    const hasManagedViewer = managedStatus === "ready" && Boolean(managedBrowser);

    if (preferredMode === "custom" && hasCustomViewer) {
      return "custom";
    }

    if (preferredMode === "managed" && hasManagedViewer) {
      return "managed";
    }

    if (hasCustomViewer) {
      return "custom";
    }

    if (hasManagedViewer) {
      return "managed";
    }

    return null;
  }, [customViewerUrl, managedBrowser, managedStatus, preferredMode]);

  const activeViewerUrl = useMemo(() => {
    if (activeMode === "managed") return managedBrowser?.viewerUrl || "";
    if (activeMode === "custom") return customViewerUrl;
    return "";
  }, [activeMode, customViewerUrl, managedBrowser?.viewerUrl]);

  const activeViewerLabel = useMemo(() => {
    if (activeMode === "managed") return managedBrowser?.label || "Managed Browser";

    if (activeMode === "custom" && customViewerUrl) {
      try {
        return new URL(customViewerUrl).host;
      } catch {
        return "Custom Viewer";
      }
    }

    return "Browser Workspace";
  }, [activeMode, customViewerUrl, managedBrowser?.label]);

  const setViewerMode = (mode: ViewerMode) => {
    setPreferredMode(mode);
    localStorage.setItem(PREFERRED_VIEWER_MODE_KEY, mode);
    setViewerError(null);
  };

  const handleSaveCustomViewer = () => {
    const normalized = normalizeViewerUrl(customViewerDraft);

    if (!normalized.ok) {
      setViewerError(normalized.error);
      return;
    }

    localStorage.setItem(CUSTOM_VIEWER_URL_KEY, normalized.url);
    localStorage.setItem(PREFERRED_VIEWER_MODE_KEY, "custom");
    setCustomViewerUrl(normalized.url);
    setCustomViewerDraft(normalized.url);
    setPreferredMode("custom");
    setViewerError(null);
    setFrameKey((current) => current + 1);
  };

  const handleClearCustomViewer = () => {
    localStorage.removeItem(CUSTOM_VIEWER_URL_KEY);
    if (preferredMode === "custom") {
      localStorage.removeItem(PREFERRED_VIEWER_MODE_KEY);
      setPreferredMode(null);
    }
    setCustomViewerUrl("");
    setCustomViewerDraft("");
    setViewerError(null);
  };

  const openActiveViewer = () => {
    if (!activeViewerUrl) return;
    window.open(activeViewerUrl, "_blank", "noopener,noreferrer");
  };

  const launchStandalone = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(197,160,89,0.18),transparent_30%),rgba(255,255,255,0.03)] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#C5A059]/25 bg-[#C5A059]/10 text-[#C5A059]">
                <Globe className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-semibold tracking-tight">Browser Workspace</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">
                One real workspace instead of two fake shells. Use a managed remote browser,
                connect your own viewer URL, or launch the major web apps directly in a separate
                browser tab.
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50/90">
              Direct iframe access to arbitrary sites is not reliable because many sites block
              embedding. The honest paths are a real remote browser or a standalone tab.
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#C5A059]/20 bg-[#C5A059]/10 text-[#C5A059]">
                  <Monitor className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Managed Session</h2>
                  <p className="text-sm text-white/50">
                    Uses the remote browser backend already wired into this project.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white/60">Status</span>
                  {managedStatus === "ready" ? (
                    <span className="flex items-center gap-2 text-sm text-emerald-400">
                      <Wifi className="h-4 w-4" />
                      Ready
                    </span>
                  ) : managedStatus === "loading" ? (
                    <span className="flex items-center gap-2 text-sm text-[#C5A059]">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Checking
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-rose-400">
                      <WifiOff className="h-4 w-4" />
                      Unavailable
                    </span>
                  )}
                </div>

                {managedBrowser && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm text-white/70">{managedBrowser.label}</p>
                    {managedBrowser.source && (
                      <p className="text-xs uppercase tracking-[0.24em] text-white/35">
                        Source {managedBrowser.source}
                      </p>
                    )}
                  </div>
                )}

                {managedHealth.checkedAt && managedStatus === "ready" && (
                  <p className="mt-2 text-xs text-white/40">
                    Last health check {new Date(managedHealth.checkedAt).toLocaleTimeString()}
                  </p>
                )}

                {managedError && (
                  <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm leading-6 text-rose-100/90">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-300" />
                      <span>{managedError}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => setViewerMode("managed")}
                  disabled={managedStatus !== "ready" || !managedBrowser}
                  className="rounded-2xl bg-[#C5A059] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#d7b26a] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                >
                  Use Managed Session
                </button>
                <button
                  onClick={() => void loadManagedSession()}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
                  <Link2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Custom Viewer URL</h2>
                  <p className="text-sm text-white/50">
                    For your own noVNC, KasmVNC, Guacamole, or other browser-accessible viewer.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <label className="block text-sm text-white/60" htmlFor="custom-viewer-url">
                  Viewer URL
                </label>
                <input
                  id="custom-viewer-url"
                  type="url"
                  value={customViewerDraft}
                  onChange={(event) => setCustomViewerDraft(event.target.value)}
                  placeholder="https://browser.example.com/vnc.html"
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#C5A059]/50"
                />

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-white/65">
                  The viewer must allow embedding from this admin origin. If it does not, use
                  <span className="mx-1 font-medium text-white">Open Active Viewer</span>
                  to run it in a dedicated tab instead.
                </div>

                {viewerError && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100/90">
                    {viewerError}
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={handleSaveCustomViewer}
                  className="flex items-center gap-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-[#03131a] transition hover:bg-cyan-400"
                >
                  <Save className="h-4 w-4" />
                  Save Viewer
                </button>
                <button
                  onClick={() => setViewerMode("custom")}
                  disabled={!customViewerUrl}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
                >
                  Use Custom Viewer
                </button>
                <button
                  onClick={handleClearCustomViewer}
                  disabled={!customViewerUrl && !customViewerDraft}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Quick Launch</h2>
                  <p className="text-sm text-white/50">
                    Immediate access to the sites you asked for, without any fake device frame.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {launchers.map((launcher) => (
                  <button
                    key={launcher.label}
                    onClick={() => launchStandalone(launcher.url)}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-left transition hover:border-white/20 hover:bg-black/45"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{launcher.label}</p>
                      <p className="mt-1 text-xs text-white/45">{launcher.description}</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-white/40" />
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-[#C5A059]" />
                <div className="space-y-3 text-sm leading-6 text-white/65">
                  <p>
                    If you want a truly isolated full browser, keep using a remote desktop/browser
                    session. That is the only reliable way to browse any site without fighting iframe
                    restrictions.
                  </p>
                  <p>
                    If you want zero hosting cost and no cloud card requirement, the strongest path is
                    to run the browser viewer on your own machine and expose it through your own viewer
                    URL.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-black/35 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.28em] text-white/35">Active Viewer</p>
                <h2 className="mt-2 truncate text-xl font-semibold">{activeViewerLabel}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/55">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    {activeMode === "managed"
                      ? `Managed ${managedBrowser?.source || "browser"}`
                      : activeMode === "custom"
                        ? "Custom viewer URL"
                        : "No active viewer"}
                  </span>
                  {activeMode === "managed" && (
                    <span
                      className={`flex items-center gap-2 ${
                        managedHealth.ok ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {managedHealth.ok ? (
                        <Wifi className="h-4 w-4" />
                      ) : (
                        <WifiOff className="h-4 w-4" />
                      )}
                      {managedHealth.ok ? "Healthcheck ok" : "Healthcheck failing"}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setFrameKey((current) => current + 1)}
                  disabled={!activeViewerUrl}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
                >
                  Reload Frame
                </button>
                <button
                  onClick={openActiveViewer}
                  disabled={!activeViewerUrl}
                  className="flex items-center gap-2 rounded-2xl bg-[#C5A059] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#d7b26a] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/30"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open Active Viewer
                </button>
              </div>
            </div>

            <div className="relative min-h-[70vh] overflow-hidden rounded-[1.75rem] border border-white/10 bg-black">
              {activeViewerUrl ? (
                <iframe
                  key={`${activeMode}-${frameKey}-${activeViewerUrl}`}
                  src={activeViewerUrl}
                  title={activeViewerLabel}
                  className="h-[70vh] w-full border-0 bg-black xl:h-[78vh]"
                  allow="clipboard-read; clipboard-write; fullscreen"
                />
              ) : (
                <div className="flex h-[70vh] flex-col items-center justify-center px-8 text-center xl:h-[78vh]">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/5 text-white/50">
                    <Globe className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-semibold">No viewer is active yet</h3>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55">
                    Configure a custom viewer URL or bring the managed browser online. The old
                    computer and phone mockups are gone; this page only connects to a real viewer.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
