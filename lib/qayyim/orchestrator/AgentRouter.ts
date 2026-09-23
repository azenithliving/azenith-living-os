/**
 * AgentRouter — توجيه المهام الفرعية إلى الوكيل الصحيح مع إدارة التبعيات
 *
 * يستقبل قائمة SubTask → يتحقق من الاعتماديات → يعيد المهام الجاهزة للتنفيذ
 */

import type { QayyimAgentBase } from "../QayyimAgentBase";
import type { QayyimTask, QayyimResult } from "../QayyimAgentBase";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutableTask {
  id: string;
  agentKey: string;
  type: string;
  title: string;
  description: string;
  context: Record<string, any>;
  priority: "low" | "medium" | "high" | "critical";
  dependsOn: string[];
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: QayyimResult;
}

export interface RouteDecision {
  readyTasks: RoutableTask[];  // Tasks whose dependencies are all completed
  blockedTasks: RoutableTask[]; // Tasks still waiting on deps
  done: boolean;               // All tasks completed/failed
}

// ── Priority order ─────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ── AgentRouter class ─────────────────────────────────────────────────────────

export class AgentRouter {
  private agentRegistry: Record<string, QayyimAgentBase>;

  constructor(registry: Record<string, QayyimAgentBase>) {
    this.agentRegistry = registry;
  }

  /**
   * Decide which tasks are ready to run right now.
   */
  getReadyTasks(tasks: RoutableTask[]): RouteDecision {
    const completedIds = new Set(
      tasks.filter((t) => t.status === "completed").map((t) => t.id)
    );
    const pendingTasks = tasks.filter((t) => t.status === "pending");

    // A task is "ready" when all its dependencies are completed
    const readyTasks = pendingTasks
      .filter((t) => t.dependsOn.every((dep) => completedIds.has(dep)))
      .sort(
        (a, b) =>
          (PRIORITY_ORDER[b.priority] ?? 1) -
          (PRIORITY_ORDER[a.priority] ?? 1)
      );

    const blockedTasks = pendingTasks.filter(
      (t) => !t.dependsOn.every((dep) => completedIds.has(dep))
    );

    const activeOrPending = tasks.filter(
      (t) => t.status === "pending" || t.status === "running"
    );

    return {
      readyTasks,
      blockedTasks,
      done: activeOrPending.length === 0,
    };
  }

  /**
   * Execute a single RoutableTask against its agent.
   */
  async executeTask(task: RoutableTask): Promise<QayyimResult> {
    const agent = this.agentRegistry[task.agentKey];

    if (!agent) {
      return {
        success: false,
        taskId: task.id,
        output: `⚠️ الوكيل "${task.agentKey}" غير موجود في السجل. تحقق من agentKey.`,
        confidence: 0,
      };
    }

    const qayyimTask: QayyimTask = {
      id: task.id,
      type: task.type,
      title: task.title,
      description: task.description,
      context: task.context,
      priority: task.priority,
      dependsOn: task.dependsOn,
    };

    return agent.process(qayyimTask);
  }

  /**
   * Execute all ready tasks concurrently (respects dependencies).
   */
  async executeReadyBatch(tasks: RoutableTask[]): Promise<RoutableTask[]> {
    const { readyTasks } = this.getReadyTasks(tasks);
    if (readyTasks.length === 0) return tasks;

    // Mark all ready tasks as running
    const updated = tasks.map((t) =>
      readyTasks.find((r) => r.id === t.id) ? { ...t, status: "running" as const } : t
    );

    // Execute concurrently
    const results = await Promise.allSettled(
      readyTasks.map((task) => this.executeTask(task))
    );

    // Update statuses with results
    return updated.map((task) => {
      const readyIndex = readyTasks.findIndex((r) => r.id === task.id);
      if (readyIndex === -1) return task;

      const settled = results[readyIndex];
      if (settled.status === "fulfilled") {
        return {
          ...task,
          status: settled.value.success ? ("completed" as const) : ("failed" as const),
          result: settled.value,
        };
      } else {
        return {
          ...task,
          status: "failed" as const,
          result: {
            success: false,
            taskId: task.id,
            output: `خطأ غير متوقع: ${settled.reason?.message || "unknown"}`,
          },
        };
      }
    });
  }

  /**
   * Get agent instance for direct access.
   */
  getAgent(agentKey: string): QayyimAgentBase | null {
    return this.agentRegistry[agentKey] ?? null;
  }

  /**
   * List available agent keys.
   */
  listAgents(): string[] {
    return Object.keys(this.agentRegistry);
  }
}
