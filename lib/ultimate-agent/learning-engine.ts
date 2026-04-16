/**
 * Learning Engine for Ultimate Agent
 * Tracks feedback, learns from rejections, improves suggestions
 */

import { storeMemory, searchMemories, updateMemory } from "./memory-store";
import type { MemoryEntry } from "./memory-store";

export interface LearningStats {
  totalFeedback: number;
  rejections: number;
  rejectionTypes: Record<string, number>;
  improvementScore: number;
}

export class LearningEngine {
  private rejectionThreshold = 2; // Avoid after 2 rejections

  // Analyze feedback and learn
  async learnFromFeedback(memoryId: string, feedback: "positive" | "negative", reason: string): Promise<{ success: boolean; action: string }> {
    const result = await updateMemory(memoryId, { 
      userFeedback: feedback, 
      outcome: feedback === "positive" ? "success" : "failure" 
    });
    
    if (!result.success) return { success: false, action: "update_failed" };

    if (feedback === "negative") {
      // Extract rejection type (color, automation, etc.)
      const rejectedType = this.extractRejectionType(reason);
      await storeMemory({
        type: "learning",
        category: "rejection_pattern",
        content: `Rejected: ${reason}`,
        priority: "critical",
        context: { 
          rejectedType,
          count: 1,
          memoryId,
          reason 
        }
      });
      return { success: true, action: "learned_rejection", rejectedType };
    }

    return { success: true, action: "learned_positive" };
  }

  // Check if suggestion should be avoided
  async shouldAvoidSuggestion(type: string): Promise<boolean> {
    const rejections = await searchMemories({
      types: ["learning"],
      categories: ["rejection_pattern"],
      limit: 50
    });

    const typeCount = rejections.memories?.filter((m: MemoryEntry) => {
      return (m.context as any)?.rejectedType === type;
    }).length || 0;

    return typeCount >= this.rejectionThreshold;
  }

  private extractRejectionType(reason: string): string {
    const lower = reason.toLowerCase();
    if (lower.includes("لون") || lower.includes("color")) return "color_change";
    if (lower.includes("قاعدة") || lower.includes("automation")) return "automation_rule";
    if (lower.includes("قسم") || lower.includes("section")) return "new_section";
    if (lower.includes("واتساب") || lower.includes("whatsapp")) return "whatsapp_notification";
    return "general";
  }

  async getLearningStats(): Promise<LearningStats> {
    const feedbackMemories = await searchMemories({
      types: ["learning"],
      limit: 1000
    });

    const rejections = feedbackMemories.memories?.filter((m: MemoryEntry) => {
      return (m.context as any)?.rejectedType;
    }) || [];

    const rejectionTypes = rejections.reduce((acc, m) => {
      const type = (m.context as any)?.rejectedType || "unknown";
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const improvementScore = rejections.length / (feedbackMemories.memories?.length || 1) * 100;

    return {
      totalFeedback: feedbackMemories.memories?.length || 0,
      rejections: rejections.length,
      rejectionTypes,
      improvementScore: 100 - improvementScore
    };
  }
}

export const learningEngine = new LearningEngine();

