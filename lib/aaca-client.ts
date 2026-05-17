/**
 * Bridge between Next.js admin tools and agent systems.
 * - Production (Vercel): Cloud Agent Hub — no local computer required.
 * - Optional: remote AACA_SERVICE_URL for dedicated agent server.
 */

import { runCloudAgentMission } from "./cloud-agent-hub";

export type AacaHealthStatus = "READY" | "OFFLINE" | "DEGRADED";
export type AacaRuntimeMode = "cloud" | "remote" | "local";

export interface AacaHealthResult {
  status: AacaHealthStatus;
  baseUrl: string;
  mode: AacaRuntimeMode;
  agents?: string[];
  detail?: string;
}

export interface AacaTaskInput {
  title: string;
  description?: string;
  type: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  payload?: Record<string, unknown>;
  createdBy: string;
}

export interface AacaDelegateResult {
  delegated: boolean;
  offline?: boolean;
  mode?: AacaRuntimeMode;
  task?: unknown;
  message: string;
}

const DEFAULT_PORT = 3100;
const HEALTH_TIMEOUT_MS = 4000;
const TASK_TIMEOUT_MS = 15000;

const CLOUD_AGENT_LIST = [
  "orchestrator",
  "dev",
  "security",
  "qa",
  "ops",
  "communication",
  "evolution",
];

/**
 * Cloud Agent Hub runs inside Next.js — no separate `npm run aaca:start` required.
 * Set AACA_REQUIRE_LOCAL_SERVER=true only if you insist on the standalone AACA process.
 */
export function isCloudAgentMode(): boolean {
  if (process.env.AACA_CLOUD_MODE === "false") return false;
  if (process.env.AACA_REQUIRE_LOCAL_SERVER === "true") return false;
  return true;
}

function isLocalAacaUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function getAacaBaseUrl(): string {
  const explicit = process.env.AACA_SERVICE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const port = process.env.AACA_PORT || String(DEFAULT_PORT);
  return `http://127.0.0.1:${port}`;
}

export function shouldDelegateToAaca(message: string): boolean {
  const trimmed = message.trim();
  if (/^\/aaca(\s|$)/i.test(trimmed)) return true;
  if (/^\/وكلاء(\s|$)/i.test(trimmed)) return true;
  if (/^\/agents(\s|$)/i.test(trimmed)) return true;

  const autoOff = process.env.AACA_AUTO_DELEGATE === "false";
  const autoOn =
    process.env.AACA_AUTO_DELEGATE === "true" ||
    (isCloudAgentMode() && !autoOff);

  if (!autoOn) return false;

  const lower = trimmed.toLowerCase();
  const patterns = [
    /وكيل/,
    /aaca/,
    /orchestrator/,
    /فحص\s*أمن/,
    /security\s*scan/,
    /اختبار|qa|testing/,
    /deploy|نشر/,
    /evolution|تطوير\s*ذاتي/,
    /ops|مراقبة\s*النظام/,
    /حلل|تحليل|analyze/,
    /نفّذ|نفذ|execute/,
  ];
  return patterns.some((p) => p.test(lower));
}

export function parseAacaIntent(message: string): {
  text: string;
  taskType: string;
  title: string;
} {
  const text = message
    .replace(/^\/aaca\s*/i, "")
    .replace(/^\/وكلاء\s*/i, "")
    .replace(/^\/agents\s*/i, "")
    .trim() || message.trim();
  const lower = text.toLowerCase();

  let taskType = "ANALYSIS";
  if (/أمن|security|scan|فحص/.test(lower)) taskType = "SECURITY_SCAN";
  else if (/اختبار|test|qa|build/.test(lower)) taskType = "TESTING";
  else if (/نشر|deploy|release/.test(lower)) taskType = "DEPLOYMENT";
  else if (/مراقبة|monitor|ops|health/.test(lower)) taskType = "MONITORING";
  else if (/تطوير|evolve|evolution|تحسين/.test(lower)) taskType = "EVOLUTION";
  else if (/كود|code|generate|برمج/.test(lower)) taskType = "CODE_GENERATION";
  else if (/إشعار|notify|email|واتس/.test(lower)) taskType = "NOTIFICATION";

  const title =
    text.length > 80 ? `${text.slice(0, 77)}...` : text || "Admin delegated task";

  return { text, taskType, title };
}

async function checkRemoteAacaHealth(baseUrl: string): Promise<AacaHealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/v1/health`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        status: "OFFLINE",
        baseUrl,
        mode: "remote",
        detail: `HTTP ${res.status}`,
      };
    }

    const body = (await res.json()) as {
      status?: string;
      agents?: { name?: string }[] | string[];
    };

    const agents = Array.isArray(body.agents)
      ? body.agents.map((a) => (typeof a === "string" ? a : a.name || "agent"))
      : CLOUD_AGENT_LIST;

    return {
      status: body.status === "healthy" ? "READY" : "DEGRADED",
      baseUrl,
      mode: "remote",
      agents,
      detail: body.status,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      status: "OFFLINE",
      baseUrl,
      mode: "remote",
      detail: err instanceof Error ? err.message : "unreachable",
    };
  }
}

export async function checkAacaHealth(): Promise<AacaHealthResult> {
  const remoteUrl = process.env.AACA_SERVICE_URL?.trim();

  if (remoteUrl && !isLocalAacaUrl(remoteUrl)) {
    const remote = await checkRemoteAacaHealth(remoteUrl.replace(/\/$/, ""));
    if (remote.status !== "OFFLINE") return remote;
  }

  if (isCloudAgentMode()) {
    return {
      status: "READY",
      baseUrl: process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "cloud",
      mode: "cloud",
      agents: CLOUD_AGENT_LIST,
      detail: "cloud-agent-hub",
    };
  }

  return checkRemoteAacaHealth(getAacaBaseUrl());
}

export async function createAacaTask(input: AacaTaskInput): Promise<unknown> {
  const baseUrl = getAacaBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/v1/tasks`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority || "MEDIUM",
        payload: input.payload,
        createdBy: input.createdBy,
      }),
    });
    clearTimeout(timer);

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (body as { error?: string }).error || `AACA task failed (${res.status})`
      );
    }
    return body;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function delegateToRemoteAaca(
  message: string,
  createdBy: string,
  baseUrl: string
): Promise<AacaDelegateResult> {
  const { text, taskType, title } = parseAacaIntent(message);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/v1/tasks`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        title,
        description: text,
        type: taskType,
        priority: "MEDIUM",
        payload: { source: "mastermind", rawMessage: message },
        createdBy,
      }),
    });
    clearTimeout(timer);

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (body as { error?: string }).error || `AACA task failed (${res.status})`
      );
    }

    const task = (body as { task?: unknown }).task ?? body;
    return {
      delegated: true,
      mode: "remote",
      task,
      message: `تم إرسال المهمة لسيرفر الوكلاء — النوع: ${taskType}. Orchestrator يوزّع على Dev, Security, QA, Ops, Communication, Evolution.`,
    };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function delegateToCloudHub(
  message: string,
  createdBy: string
): Promise<AacaDelegateResult> {
  const mission = await runCloudAgentMission(message, createdBy);
  const m = mission.mastermind;

  return {
    delegated: true,
    mode: "cloud",
    task: mission,
    message: m.success
      ? `✅ تم التنفيذ عبر الوكلاء السحابيين (7 وكلاء): ${m.summary}\n\n${m.details}`
      : `⚠️ اكتمل جزئياً: ${m.summary}\n${m.errors.join("; ")}`,
  };
}

/**
 * Run the 7-agent mission from natural language (no /aaca prefix required).
 */
export async function runAdminAgentMission(
  message: string,
  createdBy: string
): Promise<AacaDelegateResult> {
  const remoteUrl = process.env.AACA_SERVICE_URL?.trim();
  if (remoteUrl && !isLocalAacaUrl(remoteUrl)) {
    try {
      const remote = await checkRemoteAacaHealth(remoteUrl.replace(/\/$/, ""));
      if (remote.status !== "OFFLINE") {
        return delegateToRemoteAaca(message, createdBy, remoteUrl.replace(/\/$/, ""));
      }
    } catch {
      /* cloud fallback */
    }
  }

  if (isCloudAgentMode()) {
    try {
      return await delegateToCloudHub(message, createdBy);
    } catch (err) {
      return {
        delegated: false,
        message:
          err instanceof Error
            ? `فشل تنفيذ المهمة: ${err.message}`
            : "فشل تنفيذ المهمة",
      };
    }
  }

  try {
    return await delegateToRemoteAaca(message, createdBy, getAacaBaseUrl());
  } catch {
    try {
      return await delegateToCloudHub(message, createdBy);
    } catch (err) {
      return {
        delegated: false,
        message:
          err instanceof Error ? err.message : "تعذر تشغيل الوكلاء",
      };
    }
  }
}

/**
 * Delegate admin work to agents — cloud on Vercel, optional remote AACA server.
 */
export async function delegateToAaca(
  message: string,
  createdBy: string
): Promise<AacaDelegateResult> {
  if (!shouldDelegateToAaca(message)) {
    return {
      delegated: false,
      message: "Not an agent delegation request",
    };
  }

  const remoteUrl = process.env.AACA_SERVICE_URL?.trim();
  if (remoteUrl && !isLocalAacaUrl(remoteUrl)) {
    try {
      const remote = await checkRemoteAacaHealth(remoteUrl.replace(/\/$/, ""));
      if (remote.status !== "OFFLINE") {
        return delegateToRemoteAaca(
          message,
          createdBy,
          remoteUrl.replace(/\/$/, "")
        );
      }
    } catch {
      /* fall through to cloud */
    }
  }

  if (isCloudAgentMode()) {
    try {
      return await delegateToCloudHub(message, createdBy);
    } catch (err) {
      return {
        delegated: false,
        message:
          err instanceof Error
            ? `فشل الوكلاء السحابيون: ${err.message}`
            : "فشل الوكلاء السحابيون",
      };
    }
  }

  const health = await checkAacaHealth();
  if (health.status === "OFFLINE") {
    return {
      delegated: false,
      offline: true,
      message:
        "نظام الوكلاء غير متصل. على الموقع المنشور يعمل تلقائياً في السحابة — تأكد من النشر على Vercel.",
    };
  }

  try {
    return await delegateToRemoteAaca(message, createdBy, getAacaBaseUrl());
  } catch (err) {
    return {
      delegated: false,
      message:
        err instanceof Error
          ? `فشل إرسال المهمة: ${err.message}`
          : "فشل إرسال المهمة",
    };
  }
}
