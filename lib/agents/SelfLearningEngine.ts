/**
 * Self-Learning Engine - Improves agent responses based on user interactions
 * Records feedback, identifies patterns, and evolves agent behavior
 */

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export interface InteractionFeedback {
  interactionId: string;
  agentKey: string;
  userMessage: string;
  agentResponse: string;
  rating?: "positive" | "negative" | "neutral";
  feedback?: string;
  context?: Record<string, any>;
}

export interface LearnedPattern {
  id: string;
  agentKey: string;
  pattern: string;
  successCount: number;
  failureCount: number;
  successRate: number;
  lastUsed: string;
}

export class SelfLearningEngine {
  async recordInteraction(feedback: InteractionFeedback): Promise<boolean> {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) return false;

      await supabase.from("agent_learnings").insert({
        company_id: "00000000-0000-0000-0000-000000000000",
        agent_profile_id: null,
        lesson_type: feedback.rating === "positive" ? "success_pattern" : feedback.rating === "negative" ? "failure_avoidance" : "optimization",
        context: `User: ${feedback.userMessage.slice(0, 200)} | Agent: ${feedback.agentResponse.slice(0, 200)}`,
        pattern: {
          userMessage: feedback.userMessage,
          agentResponse: feedback.agentResponse,
          rating: feedback.rating,
          feedback: feedback.feedback,
          context: feedback.context,
        },
        success_rate: feedback.rating === "positive" ? 100 : feedback.rating === "negative" ? 0 : 50,
        used_count: 1,
        success_count: feedback.rating === "positive" ? 1 : 0,
        failure_count: feedback.rating === "negative" ? 1 : 0,
        last_used_at: new Date().toISOString(),
        is_active: true,
      });

      return true;
    } catch (err) {
      console.error("[LearningEngine] Failed to record interaction:", err);
      return false;
    }
  }

  async getLearnedPatterns(agentKey: string, limit = 50): Promise<LearnedPattern[]> {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) return [];

      const { data } = await supabase
        .from("agent_learnings")
        .select("*")
        .eq("is_active", true)
        .order("last_used_at", { ascending: false })
        .limit(limit);

      if (!data) return [];

      return data.map((row: any) => ({
        id: row.id,
        agentKey,
        pattern: row.context || "",
        successCount: row.success_count || 0,
        failureCount: row.failure_count || 0,
        successRate: row.success_rate || 0,
        lastUsed: row.last_used_at || "",
      }));
    } catch (err) {
      console.error("[LearningEngine] Failed to get patterns:", err);
      return [];
    }
  }

  async getImprovementSuggestions(agentKey: string): Promise<string[]> {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) return [];

      const { data } = await supabase
        .from("agent_learnings")
        .select("context, pattern, success_rate, lesson_type")
        .eq("is_active", true)
        .order("success_rate", { ascending: true })
        .limit(20);

      if (!data || data.length === 0) return [];

      const suggestions: string[] = [];

      const failures = data.filter((d: any) => d.lesson_type === "failure_avoidance" || (d.success_rate || 0) < 50);
      if (failures.length > 0) {
        suggestions.push(`تجنب الأنماط التالية التي أدت إلى تجارب سلبية: ${failures.length} أنماط تحتاج تحسين`);
      }

      const successes = data.filter((d: any) => (d.success_rate || 0) >= 80);
      if (successes.length > 0) {
        suggestions.push(`استمر في استخدام الأنماط الناجحة: ${successes.length} أنماط بنجاح عالٍ`);
      }

      if (data.length > 10) {
        const avgSuccess = data.reduce((sum: number, d: any) => sum + (d.success_rate || 0), 0) / data.length;
        suggestions.push(`معدل النجاح الإجمالي: ${Math.round(avgSuccess)}% — ${avgSuccess >= 70 ? "أداء جيد" : "يحتاج تحسين"}`);
      }

      return suggestions;
    } catch (err) {
      console.error("[LearningEngine] Failed to get suggestions:", err);
      return [];
    }
  }

  async getOptimalPrompt(agentKey: string, basePrompt: string): Promise<string> {
    try {
      const patterns = await this.getLearnedPatterns(agentKey, 10);

      if (patterns.length === 0) return basePrompt;

      const topPatterns = patterns
        .filter((p) => p.successRate >= 70)
        .slice(0, 3);

      if (topPatterns.length === 0) return basePrompt;

      let enhancedPrompt = basePrompt;
      enhancedPrompt += "\n\n## أنماط ناجحة تم تعلمها:\n";
      topPatterns.forEach((p, i) => {
        enhancedPrompt += `${i + 1}. ${p.pattern.slice(0, 150)}\n`;
      });

      return enhancedPrompt;
    } catch (err) {
      console.error("[LearningEngine] Failed to get optimal prompt:", err);
      return basePrompt;
    }
  }

  async generateAgentReport(agentKey: string): Promise<{
    totalInteractions: number;
    successRate: number;
    topPatterns: LearnedPattern[];
    improvements: string[];
    recommendation: string;
  }> {
    const patterns = await this.getLearnedPatterns(agentKey, 100);
    const improvements = await this.getImprovementSuggestions(agentKey);

    const totalInteractions = patterns.reduce((sum, p) => sum + p.successCount + p.failureCount, 0);
    const totalSuccesses = patterns.reduce((sum, p) => sum + p.successCount, 0);
    const successRate = totalInteractions > 0 ? Math.round((totalSuccesses / totalInteractions) * 100) : 0;

    let recommendation = "استمر في الأداء الحالي";
    if (successRate < 50) {
      recommendation = "يحتاج تحسين عاجل — راجع الأنماط الفاشلة وتجنبها";
    } else if (successRate < 70) {
      recommendation = "أداء مقبول لكن يحتاج تحسين — ركز على نقاط الضعف";
    } else if (successRate >= 90) {
      recommendation = "أداء ممتاز — استمر وحاول توسيع النطاق";
    }

    return {
      totalInteractions,
      successRate,
      topPatterns: patterns.slice(0, 5),
      improvements,
      recommendation,
    };
  }
}

export const selfLearningEngine = new SelfLearningEngine();
