/**
 * Ops Agent
 * Specialized in DevOps, monitoring, and infrastructure management
 * Uses general-purpose models for operational tasks
 */

import { routeRequest, getBestModelForTask } from "../openrouter-service";

export interface OpsTask {
  id: string;
  type: "monitoring" | "health_check" | "log_analysis" | "alert_response" | "config_review";
  target: string;
  parameters?: Record<string, unknown>;
}

export interface HealthStatus {
  component: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency?: number;
  errorRate?: number;
  lastChecked: string;
  details?: string;
}

export interface OpsResult {
  success: boolean;
  healthStatus?: HealthStatus[];
  alerts?: string[];
  recommendations?: string[];
  summary?: string;
  error?: string;
  executionTime: number;
}

export class OpsAgent {
  private readonly name = "Ops";
  private readonly role = "DevOps Engineer";
  private readonly goal = "Monitor system health and maintain operational excellence";

  async execute(task: OpsTask): Promise<OpsResult> {
    const startTime = Date.now();
    
    try {
      switch (task.type) {
        case "monitoring":
          return await this.monitorSystem(task, startTime);
        case "health_check":
          return await this.checkHealth(task, startTime);
        case "log_analysis":
          return await this.analyzeLogs(task, startTime);
        case "alert_response":
          return await this.respondToAlert(task, startTime);
        case "config_review":
          return await this.reviewConfig(task, startTime);
        default:
          return {
            success: false,
            error: `Unknown task type: ${task.type}`,
            executionTime: Date.now() - startTime,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async monitorSystem(task: OpsTask, startTime: number): Promise<OpsResult> {
    const prompt = `Monitor the following system and provide status:

System: ${task.target}
${task.parameters ? `Parameters: ${JSON.stringify(task.parameters, null, 2)}\n` : ""}

Analyze:
1. System availability
2. Performance metrics
3. Resource utilization
4. Error rates
5. Any anomalies

Provide status and recommendations.`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("general"),
      prompt,
      systemPrompt: "You are a DevOps engineer. Monitor systems and provide actionable insights.",
      temperature: 0.3,
    });

    return {
      success: response.success,
      summary: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private async checkHealth(task: OpsTask, startTime: number): Promise<OpsResult> {
    const prompt = `Perform health check for:

Component: ${task.target}

Check and report on:
1. Response time/latency
2. Error rate
3. Resource usage (CPU, memory, disk)
4. Dependency health
5. Overall status

Respond in JSON:
{
  "healthStatus": [
    {
      "component": "name",
      "status": "healthy|degraded|unhealthy",
      "latency": milliseconds,
      "errorRate": percentage,
      "details": "description"
    }
  ],
  "alerts": ["any active alerts"],
  "recommendations": ["actions to take"]
}`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("general"),
      prompt,
      temperature: 0.3,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const parsed = JSON.parse(response.content);
      return {
        success: true,
        healthStatus: parsed.healthStatus || [],
        alerts: parsed.alerts || [],
        recommendations: parsed.recommendations || [],
        executionTime: Date.now() - startTime,
      };
    } catch {
      // Fallback if JSON parsing fails
      return {
        success: true,
        summary: response.content,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async analyzeLogs(task: OpsTask, startTime: number): Promise<OpsResult> {
    const prompt = `Analyze the following logs:

Logs:
${task.target}

Identify:
1. Error patterns and frequency
2. Warning signs
3. Performance issues
4. Security events
5. Root causes of problems

Provide summary and actionable recommendations.`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("analysis"),
      prompt,
      temperature: 0.3,
    });

    return {
      success: response.success,
      summary: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private async respondToAlert(task: OpsTask, startTime: number): Promise<OpsResult> {
    const prompt = `Respond to this alert:

Alert: ${task.target}
${task.parameters ? `Context: ${JSON.stringify(task.parameters)}\n` : ""}

Provide:
1. Severity assessment
2. Immediate actions to take
3. Root cause analysis
4. Prevention measures
5. Runbook steps if applicable`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("general"),
      prompt,
      systemPrompt: "You are an SRE responding to production alerts. Be specific and actionable.",
      temperature: 0.4,
    });

    return {
      success: response.success,
      summary: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  private async reviewConfig(task: OpsTask, startTime: number): Promise<OpsResult> {
    const prompt = `Review this configuration:

Configuration:
${task.target}

Check for:
1. Security best practices
2. Performance optimizations
3. Resource efficiency
4. Maintainability
5. Compliance with standards

Provide recommendations for improvements.`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("general"),
      prompt,
      temperature: 0.3,
    });

    return {
      success: response.success,
      summary: response.success ? response.content : undefined,
      error: response.error,
      executionTime: Date.now() - startTime,
    };
  }

  getInfo(): { name: string; role: string; goal: string } {
    return {
      name: this.name,
      role: this.role,
      goal: this.goal,
    };
  }
}

// Singleton instance
export const opsAgent = new OpsAgent();
