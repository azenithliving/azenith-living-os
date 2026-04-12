/**
 * Task Router - Intelligent task distribution using Mastermind provider selection
 * Routes tasks to the optimal AI provider based on task type
 */

import { azenithMastermind } from "@/lib/mastermind-core";
import {
  getNextAvailableKey,
  setKeyCooldown,
  incrementKeyUsage,
} from "@/lib/api-keys-service";
import {
  askGroq,
  askMistral,
  askOpenRouter,
} from "@/lib/ai-orchestrator";

export type TaskType = "translation" | "code" | "vision" | "creative" | "general";

interface TaskRequest {
  taskType: TaskType;
  prompt: string;
  imageUrl?: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
    jsonMode?: boolean;
  };
}

interface TaskResult {
  success: boolean;
  content: string;
  provider: string;
  model: string;
  error?: string;
}

/**
 * TaskRouter - Routes tasks to optimal providers
 */
export class TaskRouter {
  private static instance: TaskRouter;
  private fallbackAttempts = 2;

  private constructor() {}

  static getInstance(): TaskRouter {
    if (!TaskRouter.instance) {
      TaskRouter.instance = new TaskRouter();
    }
    return TaskRouter.instance;
  }

  /**
   * Execute a task with optimal provider selection
   */
  async executeTask(request: TaskRequest): Promise<TaskResult> {
    const { taskType, prompt, imageUrl, options } = request;

    try {
      // Use Mastermind to select best provider
      const selection = await azenithMastermind.selectBestProvider(
        taskType === "general" ? "creative" : taskType
      );

      console.log(`[TaskRouter] Selected provider: ${selection.provider} for ${taskType}`);
      console.log(`[TaskRouter] Reason: ${selection.reason}`);

      // Get next available key
      const keyResult = await getNextAvailableKey(selection.provider);

      if (!keyResult) {
        // Try fallback if primary provider has no keys
        return await this.executeWithFallback(request, selection.provider);
      }

      // Execute based on provider
      let result: { success: boolean; content: string; error?: string };

      switch (selection.provider) {
        case "groq":
          result = await askGroq(prompt, {
            model: selection.model,
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
            jsonMode: options?.jsonMode,
          });
          break;

        case "mistral":
          result = await askMistral(prompt, {
            model: selection.model,
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
          });
          break;

        case "openrouter":
          result = await askOpenRouter(prompt, imageUrl, {
            model: selection.model,
            temperature: options?.temperature,
            maxTokens: options?.maxTokens,
          });
          break;

        default:
          throw new Error(`Unknown provider: ${selection.provider}`);
      }

      // Track usage
      if (result.success) {
        await incrementKeyUsage(selection.provider, keyResult.key);
      } else if (result.error?.includes("429") || result.error?.includes("rate limit")) {
        // Set cooldown on rate limit
        await setKeyCooldown(selection.provider, keyResult.key, 60000); // 1 minute cooldown
      }

      return {
        success: result.success,
        content: result.content,
        provider: selection.provider,
        model: selection.model,
        error: result.error,
      };
    } catch (error) {
      console.error("[TaskRouter] Error executing task:", error);
      return {
        success: false,
        content: "",
        provider: "unknown",
        model: "unknown",
        error: error instanceof Error ? error.message : "Task execution failed",
      };
    }
  }

  /**
   * Execute with fallback provider
   */
  private async executeWithFallback(
    request: TaskRequest,
    failedProvider: string
  ): Promise<TaskResult> {
    const fallbackOrder: Array<"groq" | "mistral" | "openrouter"> = ["groq", "mistral", "openrouter"];

    // Remove failed provider and try others
    const providersToTry = fallbackOrder.filter((p) => p !== failedProvider);

    for (const provider of providersToTry.slice(0, this.fallbackAttempts)) {
      const keyResult = await getNextAvailableKey(provider);
      if (!keyResult) continue;

      try {
        let result: { success: boolean; content: string; error?: string };

        switch (provider) {
          case "groq":
            result = await askGroq(request.prompt, request.options);
            break;
          case "mistral":
            result = await askMistral(request.prompt, request.options);
            break;
          case "openrouter":
            result = await askOpenRouter(request.prompt, request.imageUrl, request.options);
            break;
          default:
            continue;
        }

        if (result.success) {
          await incrementKeyUsage(provider, keyResult.key);
          return {
            success: true,
            content: result.content,
            provider,
            model: "fallback",
          };
        }
      } catch (err) {
        console.warn(`[TaskRouter] Fallback to ${provider} failed:`, err);
      }
    }

    return {
      success: false,
      content: "",
      provider: "none",
      model: "none",
      error: "All providers exhausted",
    };
  }

  /**
   * Batch execute multiple tasks
   */
  async executeBatch(requests: TaskRequest[]): Promise<TaskResult[]> {
    return Promise.all(requests.map((req) => this.executeTask(req)));
  }

  /**
   * Quick execution methods
   */
  async translate(text: string, targetLang: string): Promise<TaskResult> {
    return this.executeTask({
      taskType: "translation",
      prompt: `Translate the following text to ${targetLang}:\n\n${text}`,
    });
  }

  async generateCode(prompt: string, language?: string): Promise<TaskResult> {
    return this.executeTask({
      taskType: "code",
      prompt: language
        ? `Write ${language} code for: ${prompt}`
        : `Write code for: ${prompt}`,
    });
  }

  async analyzeImage(imageUrl: string, prompt?: string): Promise<TaskResult> {
    return this.executeTask({
      taskType: "vision",
      prompt: prompt || "Describe this image in detail",
      imageUrl,
    });
  }

  async generateCreative(prompt: string): Promise<TaskResult> {
    return this.executeTask({
      taskType: "creative",
      prompt,
    });
  }
}

// Export singleton instance
export const taskRouter = TaskRouter.getInstance();
