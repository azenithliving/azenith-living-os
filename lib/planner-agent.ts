/**
 * Strategic Planner Agent
 * Uses Kimi K2 or GLM-4.5 via OpenRouter for strategic planning
 * Breaks down complex commands into actionable subtasks
 */

import { routeRequest, getBestModelForTask } from "./openrouter-service";

export interface PlannerInput {
  command: string;
  context?: {
    userId?: string;
    previousCommands?: string[];
    systemState?: Record<string, unknown>;
    constraints?: string[];
  };
}

export interface Subtask {
  id: string;
  title: string;
  description: string;
  assignedAgent: "coder" | "security" | "analyst" | "ops" | "general";
  dependencies: string[];
  estimatedMinutes: number;
  priority: "high" | "medium" | "low";
  successCriteria: string[];
}

export interface StrategicPlan {
  goal: string;
  subtasks: Subtask[];
  estimatedTotalMinutes: number;
  criticalPath: string[];
  risks: string[];
  mitigations: string[];
}

export interface PlannerResult {
  success: boolean;
  plan?: StrategicPlan;
  error?: string;
  executionTime: number;
}

export class PlannerAgent {
  private readonly name = "Strategic Planner";
  private readonly role = "Master Strategist";
  private readonly goal = "Decompose complex objectives into executable strategies";

  async createPlan(input: PlannerInput): Promise<PlannerResult> {
    const startTime = Date.now();
    
    try {
      // Use Kimi K2 or equivalent for strategic planning
      const response = await routeRequest({
        modelPreference: "moonshotai/kimi-k2", // or GLM-4.5 if available
        prompt: this.buildPlanningPrompt(input),
        systemPrompt: `You are a master strategist and project planner. Your role is to:
1. Analyze complex requests
2. Break them down into clear, actionable subtasks
3. Identify dependencies and critical paths
4. Assign appropriate agent types to each subtask
5. Estimate time and identify risks

Always respond with valid JSON matching the requested format.`,
        temperature: 0.4,
        maxTokens: 3000,
      });

      if (!response.success) {
        // Fallback to general model if Kimi K2 fails
        const fallbackResponse = await routeRequest({
          modelPreference: getBestModelForTask("planning"),
          prompt: this.buildPlanningPrompt(input),
          temperature: 0.4,
          maxTokens: 3000,
        });

        if (!fallbackResponse.success) {
          return {
            success: false,
            error: fallbackResponse.error,
            executionTime: Date.now() - startTime,
          };
        }

        return this.parsePlanResponse(fallbackResponse.content, input.command, startTime);
      }

      return this.parsePlanResponse(response.content, input.command, startTime);

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Planning failed",
        executionTime: Date.now() - startTime,
      };
    }
  }

  private buildPlanningPrompt(input: PlannerInput): string {
    let prompt = `Create a strategic execution plan for the following objective:

OBJECTIVE: ${input.command}

`;

    if (input.context) {
      if (input.context.previousCommands?.length) {
        prompt += `CONTEXT - Previous Commands:\n${input.context.previousCommands.map(c => `- ${c}`).join("\n")}\n\n`;
      }

      if (input.context.systemState) {
        prompt += `CONTEXT - System State:\n${JSON.stringify(input.context.systemState, null, 2)}\n\n`;
      }

      if (input.context.constraints?.length) {
        prompt += `CONSTRAINTS:\n${input.context.constraints.map(c => `- ${c}`).join("\n")}\n\n`;
      }
    }

    prompt += `Break this down into a strategic plan. For each subtask, specify:
1. A clear title and description
2. The most appropriate agent type (coder/security/analyst/ops/general)
3. Dependencies on other subtasks
4. Time estimate in minutes
5. Priority level
6. Success criteria

Also identify:
- The critical path (must complete in sequence)
- Potential risks
- Mitigation strategies

Respond with JSON in this exact format:
{
  "goal": "clear statement of the overall objective",
  "subtasks": [
    {
      "id": "task-1",
      "title": "Brief task title",
      "description": "Detailed description of what needs to be done",
      "assignedAgent": "coder|security|analyst|ops|general",
      "dependencies": ["task-0"],
      "estimatedMinutes": 15,
      "priority": "high|medium|low",
      "successCriteria": ["criterion 1", "criterion 2"]
    }
  ],
  "criticalPath": ["task-1", "task-2"],
  "risks": ["potential risk 1", "risk 2"],
  "mitigations": ["mitigation for risk 1", "mitigation for risk 2"]
}`;

    return prompt;
  }

  private parsePlanResponse(
    content: string,
    originalCommand: string,
    startTime: number
  ): PlannerResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      
      const parsed = JSON.parse(jsonContent);

      const plan: StrategicPlan = {
        goal: parsed.goal || originalCommand,
        subtasks: parsed.subtasks || this.createFallbackSubtasks(originalCommand),
        estimatedTotalMinutes: this.calculateTotalTime(parsed.subtasks || []),
        criticalPath: parsed.criticalPath || [],
        risks: parsed.risks || [],
        mitigations: parsed.mitigations || [],
      };

      return {
        success: true,
        plan,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      // Create fallback plan if parsing fails
      const fallbackPlan: StrategicPlan = {
        goal: originalCommand,
        subtasks: this.createFallbackSubtasks(originalCommand),
        estimatedTotalMinutes: 30,
        criticalPath: ["task-1"],
        risks: ["Unable to parse AI response"],
        mitigations: ["Using simplified plan"],
      };

      return {
        success: true,
        plan: fallbackPlan,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private createFallbackSubtasks(command: string): Subtask[] {
    return [
      {
        id: "task-1",
        title: "Analyze Request",
        description: `Analyze and understand: ${command}`,
        assignedAgent: "analyst",
        dependencies: [],
        estimatedMinutes: 5,
        priority: "high",
        successCriteria: ["Clear understanding of objective"],
      },
      {
        id: "task-2",
        title: "Execute Primary Action",
        description: `Execute main task based on analysis`,
        assignedAgent: "general",
        dependencies: ["task-1"],
        estimatedMinutes: 15,
        priority: "high",
        successCriteria: ["Task completed successfully"],
      },
      {
        id: "task-3",
        title: "Review and Validate",
        description: "Review results and validate correctness",
        assignedAgent: "analyst",
        dependencies: ["task-2"],
        estimatedMinutes: 10,
        priority: "medium",
        successCriteria: ["Results validated", "No errors found"],
      },
    ];
  }

  private calculateTotalTime(subtasks: Subtask[]): number {
    return subtasks.reduce((total, task) => total + (task.estimatedMinutes || 0), 0);
  }

  async refinePlan(plan: StrategicPlan, feedback: string): Promise<PlannerResult> {
    const startTime = Date.now();

    const prompt = `Refine this strategic plan based on feedback:

CURRENT PLAN:
Goal: ${plan.goal}
Subtasks: ${plan.subtasks.length} tasks
Critical Path: ${plan.criticalPath.join(" → ")}

FEEDBACK:
${feedback}

Update the plan addressing the feedback. Respond with the same JSON format.`;

    const response = await routeRequest({
      modelPreference: "moonshotai/kimi-k2",
      prompt,
      temperature: 0.4,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error,
        executionTime: Date.now() - startTime,
      };
    }

    return this.parsePlanResponse(response.content, plan.goal, startTime);
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
export const plannerAgent = new PlannerAgent();
