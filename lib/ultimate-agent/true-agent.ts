/**
 * TRUE AGENT - Real Intelligence, Not Programmed Responses
 * 
 * This is NOT a rule-based system. This is a reasoning-based agent.
 * The LLM decides what to do, not hardcoded if/else statements.
 */

import {
  reason,
  executeBasedOnReasoning,
  learnFromInteraction,
  type ReasoningContext,
} from "./reasoning-core";
import { storeMemory, getRecentMemories } from "./memory-store";
import { TOOL_DEFINITIONS } from "@/lib/real-tool-executor";

export interface TrueAgentContext {
  userId: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface TrueAgentResult {
  message: string;
  understanding?: string;
  reasoning?: string;
  action?: string;
  success: boolean;
  needsMoreInfo?: boolean;
  suggestions?: string[];
  data?: unknown;
}

/**
 * The True Agent - Processes messages through reasoning, not patterns
 */
export class TrueAgent {
  private userId: string;
  private conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Process a user message with genuine reasoning
   */
  async process(message: string): Promise<TrueAgentResult> {
    // Store user message
    await this.addToHistory("user", message);

    // Build reasoning context
    const reasoningContext: ReasoningContext = {
      userMessage: message,
      conversationHistory: this.conversationHistory,
      userId: this.userId,
      availableTools: TOOL_DEFINITIONS,
    };

    // REASON - The core intelligence
    const reasoning = await reason(reasoningContext);

    // Store the reasoning process
    await storeMemory({
      type: "decision",
      category: "reasoning",
      content: `فهم: ${reasoning.understanding} | نية: ${reasoning.intent} | ثقة: ${reasoning.confidence}`,
      priority: "normal",
      context: {
        userId: this.userId,
        originalMessage: message,
        confidence: reasoning.confidence,
      },
    }).catch(() => {});

    // EXECUTE based on reasoning
    const execution = await executeBasedOnReasoning(reasoning, reasoningContext);

    // Store assistant response
    await this.addToHistory("assistant", execution.message);

    // LEARN from this interaction
    await learnFromInteraction(
      message,
      reasoning,
      { success: execution.success },
      this.userId
    );

    // Build result
    const result: TrueAgentResult = {
      message: execution.message,
      understanding: reasoning.understanding,
      reasoning: reasoning.reasoning,
      action: reasoning.selectedTool || "conversation",
      success: execution.success,
      needsMoreInfo: reasoning.needsClarification,
      suggestions: this.generateSuggestions(reasoning),
      data: execution.data,
    };

    return result;
  }

  /**
   * Continue a conversation with additional context
   */
  async continue(previousMessage: string, userClarification: string): Promise<TrueAgentResult> {
    // Combine previous intent with new info
    const combinedMessage = `${previousMessage} (توضيح: ${userClarification})`;
    return this.process(combinedMessage);
  }

  /**
   * Self-reflection: Analyze if the agent understood correctly
   */
  async reflect(): Promise<{ correct: boolean; reflection: string }> {
    const recent = await getRecentMemories(3, ["decision", "learning"]);
    
    if (!recent.memories || recent.memories.length === 0) {
      return { correct: true, reflection: "لا يوجد تاريخ للتحليل" };
    }

    const lastInteraction = recent.memories[0];
    const wasMisunderstanding = recent.memories.some(m => m.category === "learning" && m.content.includes("خطأ"));

    return {
      correct: !wasMisunderstanding,
      reflection: wasMisunderstanding 
        ? "كان هناك سوء فهم في التفاعل الأخير"
        : "التفاعل الأخير كان ناجحًا",
    };
  }

  private async addToHistory(role: "user" | "assistant", content: string): Promise<void> {
    this.conversationHistory.push({ role, content });
    
    // Keep only last 20 messages
    if (this.conversationHistory.length > 20) {
      this.conversationHistory = this.conversationHistory.slice(-20);
    }

    // Store in persistent memory
    await storeMemory({
      type: "interaction",
      category: "conversation",
      content,
      priority: "normal",
      context: { userId: this.userId, role },
    }).catch(() => {});
  }

  private generateSuggestions(reasoning: import("./reasoning-core").ReasoningResult): string[] {
    if (reasoning.needsClarification) {
      // Suggest what info is needed
      return reasoning.missingInfo.map(info => `أخبرني بـ ${info}`);
    }

    if (reasoning.selectedTool) {
      // Suggest related actions
      return ["أكمل", "عدل", "ألغِ"];
    }

    return ["واصل", "ساعدني", "حالة النظام"];
  }
}

/**
 * Factory function to create a True Agent instance
 */
export function createTrueAgent(userId: string): TrueAgent {
  return new TrueAgent(userId);
}

/**
 * Quick process function for one-off interactions
 */
export async function processWithTrueAgent(
  message: string,
  userId: string
): Promise<TrueAgentResult> {
  const agent = createTrueAgent(userId);
  return agent.process(message);
}
