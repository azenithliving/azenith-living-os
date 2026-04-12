/**
 * Crew Factory - Create and manage agent crews
 * Sovereign HyperMind - Phase 2: Unlimited Intelligence
 * 
 * Factory pattern for creating task-specific crews
 */

import {
  CoderAgent,
  SecurityAgent,
  AnalystAgent,
  OpsAgent,
  CoderTask,
  SecurityTask,
  AnalystTask,
  OpsTask,
} from "./agents";

export type AgentType = "coder" | "security" | "analyst" | "ops" | "general";

export interface CrewTask {
  id: string;
  agentType: AgentType;
  description: string;
  data?: unknown;
}

export interface CrewResult {
  taskId: string;
  agentType: AgentType;
  success: boolean;
  output?: unknown;
  error?: string;
  executionTime: number;
}

export interface TaskForce {
  id: string;
  goal: string;
  agents: AgentType[];
  execute: (tasks: CrewTask[]) => Promise<CrewResult[]>;
  executeParallel: (tasks: CrewTask[]) => Promise<CrewResult[]>;
}

export class CrewFactory {
  private agents: {
    coder: CoderAgent;
    security: SecurityAgent;
    analyst: AnalystAgent;
    ops: OpsAgent;
  };

  constructor() {
    this.agents = {
      coder: new CoderAgent(),
      security: new SecurityAgent(),
      analyst: new AnalystAgent(),
      ops: new OpsAgent(),
    };
  }

  /**
   * Create a task force (crew) for a specific goal
   */
  createTaskForce(agentTypes: AgentType[], goal: string): TaskForce {
    const id = `crew-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      goal,
      agents: [...agentTypes],
      execute: async (tasks: CrewTask[]) => this.executeSequential(tasks),
      executeParallel: async (tasks: CrewTask[]) => this.executeParallel(tasks),
    };
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(tasks: CrewTask[]): Promise<CrewResult[]> {
    const results: CrewResult[] = [];

    for (const task of tasks) {
      const result = await this.executeTask(task);
      results.push(result);

      // Stop if critical task fails
      if (!result.success && task.agentType !== "general") {
        console.warn(`[CrewFactory] Critical task ${task.id} failed, stopping crew execution`);
        break;
      }
    }

    return results;
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallel(tasks: CrewTask[]): Promise<CrewResult[]> {
    const promises = tasks.map(task => this.executeTask(task));
    return Promise.all(promises);
  }

  /**
   * Execute a single task with the appropriate agent
   */
  private async executeTask(task: CrewTask): Promise<CrewResult> {
    const startTime = Date.now();

    try {
      switch (task.agentType) {
        case "coder": {
          const coderTask: CoderTask = {
            id: task.id,
            description: task.description,
            codeContext: typeof task.data === "string" ? task.data : undefined,
          };
          const result = await this.agents.coder.execute(coderTask);
          return {
            taskId: task.id,
            agentType: "coder",
            success: result.success,
            output: result.code || result.explanation,
            error: result.error,
            executionTime: Date.now() - startTime,
          };
        }

        case "security": {
          const securityTask: SecurityTask = {
            id: task.id,
            type: "audit",
            target: task.description,
            context: typeof task.data === "string" ? task.data : undefined,
          };
          const result = await this.agents.security.execute(securityTask);
          return {
            taskId: task.id,
            agentType: "security",
            success: result.success,
            output: {
              score: result.score,
              vulnerabilities: result.vulnerabilities,
              summary: result.summary,
            },
            error: result.error,
            executionTime: Date.now() - startTime,
          };
        }

        case "analyst": {
          const taskData = task.data ?? task.description ?? "";
          const analystTask: AnalystTask = {
            id: task.id,
            type: "data_analysis",
            data: typeof taskData === "string" ? taskData : JSON.stringify(taskData),
            question: task.description,
          };
          const result = await this.agents.analyst.execute(analystTask);
          return {
            taskId: task.id,
            agentType: "analyst",
            success: result.success,
            output: {
              insights: result.insights,
              summary: result.summary,
              metrics: result.metrics,
            },
            error: result.error,
            executionTime: Date.now() - startTime,
          };
        }

        case "ops": {
          const opsTask: OpsTask = {
            id: task.id,
            type: "health_check",
            target: task.description,
          };
          const result = await this.agents.ops.execute(opsTask);
          return {
            taskId: task.id,
            agentType: "ops",
            success: result.success,
            output: {
              healthStatus: result.healthStatus,
              summary: result.summary,
            },
            error: result.error,
            executionTime: Date.now() - startTime,
          };
        }

        case "general":
        default: {
          // For general tasks, use the analyst as a fallback
          const generalTask: AnalystTask = {
            id: task.id,
            type: "report_generation",
            data: task.description,
          };
          const result = await this.agents.analyst.execute(generalTask);
          return {
            taskId: task.id,
            agentType: "general",
            success: result.success,
            output: result.summary,
            error: result.error,
            executionTime: Date.now() - startTime,
          };
        }
      }
    } catch (error) {
      return {
        taskId: task.id,
        agentType: task.agentType,
        success: false,
        error: error instanceof Error ? error.message : "Task execution failed",
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a pre-configured crew for common scenarios
   */
  createCodeReviewCrew(): TaskForce {
    return this.createTaskForce(["coder", "security", "analyst"], "Review code for quality and security");
  }

  createSecurityAuditCrew(): TaskForce {
    return this.createTaskForce(["security", "analyst", "ops"], "Perform comprehensive security audit");
  }

  createDevOpsCrew(): TaskForce {
    return this.createTaskForce(["ops", "coder", "analyst"], "Handle DevOps and infrastructure tasks");
  }

  createFullStackCrew(): TaskForce {
    return this.createTaskForce(
      ["coder", "security", "analyst", "ops"],
      "Full-stack development and deployment"
    );
  }

  /**
   * Get agent information
   */
  getAgentInfo(agentType: AgentType) {
    switch (agentType) {
      case "coder":
        return this.agents.coder.getInfo();
      case "security":
        return this.agents.security.getInfo();
      case "analyst":
        return this.agents.analyst.getInfo();
      case "ops":
        return this.agents.ops.getInfo();
      default:
        return { name: "General", role: "General Purpose", goal: "Handle various tasks" };
    }
  }
}

// Singleton instance
export const crewFactory = new CrewFactory();
