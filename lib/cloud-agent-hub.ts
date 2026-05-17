/**
 * Cloud Agent Hub — runs the full multi-agent workflow inside Next.js (Vercel).
 * No separate AACA process or local computer required.
 */

import { runMastermind } from "./mastermind-graph";
import { getSystemHealth } from "./architect-tools";
import { parseAacaIntent } from "./aaca-client";

export const CLOUD_AGENTS = [
  "orchestrator",
  "dev",
  "security",
  "qa",
  "ops",
  "communication",
  "evolution",
] as const;

export interface CloudAgentMissionResult {
  mode: "cloud";
  taskType: string;
  agents: readonly string[];
  createdBy: string;
  systemHealth?: unknown;
  mastermind: {
    success: boolean;
    summary: string;
    details: string;
    recommendations: string[];
    metrics?: Record<string, number>;
    errors: string[];
  };
}

const MISSION_TIMEOUT_MS = 55_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Mission timeout")), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

/**
 * Execute admin work through all virtual agents (Mastermind graph + system health).
 */
export async function runCloudAgentMission(
  message: string,
  createdBy: string
): Promise<CloudAgentMissionResult> {
  const { text, taskType } = parseAacaIntent(message);
  const userId = createdBy.replace(/[^a-zA-Z0-9@._-]/g, "_").slice(0, 64) || "admin";

  const mission = async (): Promise<CloudAgentMissionResult> => {
    const [healthResult, state] = await Promise.all([
      getSystemHealth().catch(() => null),
      runMastermind(text, userId, {
        source: "cloud-agent-hub",
        taskType,
        createdBy,
      }),
    ]);

    const report = state.finalReport;
    const success = state.errors.length === 0;

    return {
      mode: "cloud",
      taskType,
      agents: CLOUD_AGENTS,
      createdBy,
      systemHealth: healthResult?.data ?? healthResult,
      mastermind: {
        success,
        summary: report?.summary || (success ? "اكتملت المهمة" : "اكتملت مع أخطاء"),
        details: report?.details || state.logs.slice(-5).join("\n"),
        recommendations: report?.recommendations || [],
        metrics: report?.metrics,
        errors: state.errors,
      },
    };
  };

  return withTimeout(mission(), MISSION_TIMEOUT_MS);
}
