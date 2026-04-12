/**
 * Coder Agent
 * Specialized in writing, testing, and debugging code
 * Uses OpenRouter with DeepSeek-V3 or Codestral for coding tasks
 */

import { routeRequest, getBestModelForTask } from "../openrouter-service";

export interface CoderTask {
  id: string;
  description: string;
  language?: string;
  codeContext?: string;
}

export interface CoderResult {
  success: boolean;
  code?: string;
  explanation?: string;
  tests?: string;
  error?: string;
  executionTime: number;
}

export class CoderAgent {
  private readonly name = "Coder";
  private readonly role = "Expert Programmer";
  private readonly goal = "Write clean, efficient, well-documented code";

  async execute(task: CoderTask): Promise<CoderResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Write the code
      const codeResponse = await this.writeCode(task);
      
      if (!codeResponse.success) {
        return {
          success: false,
          error: codeResponse.error,
          executionTime: Date.now() - startTime,
        };
      }

      // Step 2: Generate explanation
      const explanationResponse = await this.generateExplanation(task, codeResponse.code || "");

      // Step 3: Generate tests (if applicable)
      const testResponse = await this.generateTests(task, codeResponse.code || "");

      return {
        success: true,
        code: codeResponse.code,
        explanation: explanationResponse.explanation,
        tests: testResponse.tests,
        executionTime: Date.now() - startTime,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async writeCode(task: CoderTask): Promise<{ success: boolean; code?: string; error?: string }> {
    const prompt = this.buildCodePrompt(task);
    
    const response = await routeRequest({
      modelPreference: "deepseek/deepseek-coder-v2",
      prompt,
      systemPrompt: `You are an expert programmer. Write clean, efficient, well-documented code.
Follow best practices and include error handling. Only return the code, no extra text.`,
      temperature: 0.3,
      maxTokens: 2048,
    });

    if (!response.success) {
      return { success: false, error: response.error };
    }

    // Extract code from markdown if present
    const code = this.extractCode(response.content);
    
    return { success: true, code };
  }

  private async generateExplanation(task: CoderTask, code: string): Promise<{ explanation?: string }> {
    const prompt = `Explain this code in detail:

Language: ${task.language || "unknown"}
Code:
\`\`\`
${code}
\`\`\`

Provide:
1. What the code does
2. Key functions/logic
3. Any assumptions or dependencies`;

    const response = await routeRequest({
      modelPreference: getBestModelForTask("general"),
      prompt,
      temperature: 0.5,
      maxTokens: 1024,
    });

    return { explanation: response.success ? response.content : undefined };
  }

  private async generateTests(task: CoderTask, code: string): Promise<{ tests?: string }> {
    if (!this.shouldGenerateTests(task)) {
      return { tests: undefined };
    }

    const prompt = `Write unit tests for this code:

Language: ${task.language || "unknown"}
Code:
\`\`\`
${code}
\`\`\`

Include edge cases and error scenarios.`;

    const response = await routeRequest({
      modelPreference: "deepseek/deepseek-coder-v2",
      prompt,
      temperature: 0.3,
      maxTokens: 1024,
    });

    return { tests: response.success ? this.extractCode(response.content) : undefined };
  }

  private buildCodePrompt(task: CoderTask): string {
    let prompt = `Task: ${task.description}\n\n`;
    
    if (task.language) {
      prompt += `Language: ${task.language}\n\n`;
    }
    
    if (task.codeContext) {
      prompt += `Context:\n${task.codeContext}\n\n`;
    }
    
    prompt += `Write the complete, production-ready code. Include comments and error handling.`;
    
    return prompt;
  }

  private extractCode(content: string): string {
    // Extract code from markdown code blocks
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/;
    const match = content.match(codeBlockRegex);
    
    if (match) {
      return match[1].trim();
    }
    
    return content.trim();
  }

  private shouldGenerateTests(task: CoderTask): boolean {
    const testableLanguages = ["javascript", "typescript", "python", "java", "go", "rust"];
    return !task.language || testableLanguages.includes(task.language.toLowerCase());
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
export const coderAgent = new CoderAgent();
