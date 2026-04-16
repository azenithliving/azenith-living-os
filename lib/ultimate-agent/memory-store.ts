/**
 * Ultimate Agent Memory Store
 *
 * "Infinite memory, infinite context, infinite wisdom."
 *
 * Provides long-term memory management for the Ultimate Intelligence Agent:
 * - Store every decision, suggestion, and outcome
 * - Remember user preferences and patterns
 * - Track long-term goals and progress
 * - Context-aware memory retrieval
 */

import { createClient as createServerClient } from "@/utils/supabase/server";

// Memory types
export type MemoryType = 
  | "decision" 
  | "suggestion" 
  | "preference" 
  | "goal" 
  | "outcome" 
  | "interaction" 
  | "learning" 
  | "anomaly"
  | "prediction";

// Priority levels
export type PriorityLevel = "low" | "normal" | "high" | "critical";

// Memory entry structure
export interface MemoryEntry {
  id?: string;
  type: MemoryType;
  category: string;
  content: string;
  context?: Record<string, unknown>;
  priority: PriorityLevel;
  outcome?: "success" | "failure" | "pending" | "rejected";
  userFeedback?: "positive" | "negative" | "neutral";
  expiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// User preference structure
export interface UserPreference {
  id?: string;
  category: string;
  key: string;
  value: unknown;
  confidence: number; // 0-1, how confident we are about this preference
  source: string; // e.g., "explicit", "inferred", "pattern"
  lastConfirmed?: Date;
  createdAt?: Date;
}

// Goal structure
export interface AgentGoal {
  id?: string;
  title: string;
  description: string;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  deadline?: Date;
  status: "active" | "completed" | "paused" | "abandoned";
  priority: PriorityLevel;
  progress: number; // 0-100
  steps: GoalStep[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface GoalStep {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  order: number;
  completedAt?: Date;
}

// Memory search filters
export interface MemoryFilters {
  types?: MemoryType[];
  categories?: string[];
  priorities?: PriorityLevel[];
  outcomes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
  limit?: number;
}

/**
 * Store a new memory entry
 */
export async function storeMemory(
  entry: Omit<MemoryEntry, "id" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("agent_memory")
      .insert({
        type: entry.type,
        category: entry.category,
        content: entry.content,
        context: entry.context || {},
        priority: entry.priority,
        outcome: entry.outcome || "pending",
        user_feedback: entry.userFeedback || "neutral",
        expires_at: entry.expiresAt?.toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    return { success: true, id: data.id };
  } catch (error) {
    console.error("[MemoryStore] Failed to store memory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update an existing memory entry
 */
export async function updateMemory(
  id: string,
  updates: Partial<Omit<MemoryEntry, "id" | "createdAt">>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const updateData: Record<string, unknown> = {};
    
    if (updates.outcome !== undefined) updateData.outcome = updates.outcome;
    if (updates.userFeedback !== undefined) updateData.user_feedback = updates.userFeedback;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.context !== undefined) updateData.context = updates.context;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.expiresAt !== undefined) updateData.expires_at = updates.expiresAt?.toISOString();

    const { error } = await supabase
      .from("agent_memory")
      .update(updateData)
      .eq("id", id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("[MemoryStore] Failed to update memory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Search memories with filters
 */
export async function searchMemories(
  filters: MemoryFilters = {}
): Promise<{ success: boolean; memories?: MemoryEntry[]; error?: string }> {
  const supabase = await createServerClient();

  try {
    let query = supabase
      .from("agent_memory")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.types && filters.types.length > 0) {
      query = query.in("type", filters.types);
    }

    if (filters.categories && filters.categories.length > 0) {
      query = query.in("category", filters.categories);
    }

    if (filters.priorities && filters.priorities.length > 0) {
      query = query.in("priority", filters.priorities);
    }

    if (filters.outcomes && filters.outcomes.length > 0) {
      query = query.in("outcome", filters.outcomes);
    }

    if (filters.dateFrom) {
      query = query.gte("created_at", filters.dateFrom.toISOString());
    }

    if (filters.dateTo) {
      query = query.lte("created_at", filters.dateTo.toISOString());
    }

    if (filters.searchQuery) {
      query = query.ilike("content", `%${filters.searchQuery}%`);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    const memories: MemoryEntry[] = (data || []).map((row) => ({
      id: row.id,
      type: row.type as MemoryType,
      category: row.category,
      content: row.content,
      context: row.context || {},
      priority: row.priority as PriorityLevel,
      outcome: row.outcome,
      userFeedback: row.user_feedback,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    return { success: true, memories };
  } catch (error) {
    console.error("[MemoryStore] Failed to search memories:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get recent memories
 */
export async function getRecentMemories(
  limit: number = 50,
  types?: MemoryType[]
): Promise<{ success: boolean; memories?: MemoryEntry[]; error?: string }> {
  return searchMemories({ limit, types });
}

/**
 * Store user preference
 */
export async function storeUserPreference(
  preference: Omit<UserPreference, "id" | "createdAt">
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Check if preference already exists
    const { data: existing } = await supabase
      .from("user_preferences")
      .select("id")
      .eq("category", preference.category)
      .eq("key", preference.key)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("user_preferences")
        .update({
          value: preference.value,
          confidence: preference.confidence,
          source: preference.source,
          last_confirmed: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;
      return { success: true, id: existing.id };
    }

    // Insert new
    const { data, error } = await supabase
      .from("user_preferences")
      .insert({
        category: preference.category,
        key: preference.key,
        value: preference.value,
        confidence: preference.confidence,
        source: preference.source,
        last_confirmed: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;
    return { success: true, id: data.id };
  } catch (error) {
    console.error("[MemoryStore] Failed to store preference:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get user preferences by category
 */
export async function getUserPreferences(
  category?: string
): Promise<{ success: boolean; preferences?: UserPreference[]; error?: string }> {
  const supabase = await createServerClient();

  try {
    let query = supabase
      .from("user_preferences")
      .select("*")
      .order("confidence", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) throw error;

    const preferences: UserPreference[] = (data || []).map((row) => ({
      id: row.id,
      category: row.category,
      key: row.key,
      value: row.value,
      confidence: row.confidence,
      source: row.source,
      lastConfirmed: row.last_confirmed ? new Date(row.last_confirmed) : undefined,
      createdAt: new Date(row.created_at),
    }));

    return { success: true, preferences };
  } catch (error) {
    console.error("[MemoryStore] Failed to get preferences:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get a specific user preference
 */
export async function getUserPreference(
  category: string,
  key: string
): Promise<{ success: boolean; value?: unknown; error?: string }> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("user_preferences")
      .select("value")
      .eq("category", category)
      .eq("key", key)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found
        return { success: true, value: undefined };
      }
      throw error;
    }

    return { success: true, value: data?.value };
  } catch (error) {
    console.error("[MemoryStore] Failed to get preference:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Create a new goal
 */
export async function createGoal(
  goal: Omit<AgentGoal, "id" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("agent_goals")
      .insert({
        title: goal.title,
        description: goal.description,
        target_metric: goal.targetMetric,
        target_value: goal.targetValue,
        current_value: goal.currentValue,
        deadline: goal.deadline?.toISOString(),
        status: goal.status,
        priority: goal.priority,
        progress: goal.progress,
        steps: goal.steps,
      })
      .select("id")
      .single();

    if (error) throw error;

    return { success: true, id: data.id };
  } catch (error) {
    console.error("[MemoryStore] Failed to create goal:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get active goals
 */
export async function getActiveGoals(
  priority?: PriorityLevel
): Promise<{ success: boolean; goals?: AgentGoal[]; error?: string }> {
  const supabase = await createServerClient();

  try {
    let query = supabase
      .from("agent_goals")
      .select("*")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (priority) {
      query = query.eq("priority", priority);
    }

    const { data, error } = await query;

    if (error) throw error;

    const goals: AgentGoal[] = (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      targetMetric: row.target_metric,
      targetValue: row.target_value,
      currentValue: row.current_value,
      deadline: row.deadline ? new Date(row.deadline) : undefined,
      status: row.status,
      priority: row.priority,
      progress: row.progress,
      steps: row.steps || [],
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    return { success: true, goals };
  } catch (error) {
    console.error("[MemoryStore] Failed to get goals:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update goal progress
 */
export async function updateGoalProgress(
  goalId: string,
  progress: number,
  currentValue?: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    const updates: Record<string, unknown> = { progress };
    if (currentValue !== undefined) updates.current_value = currentValue;

    const { error } = await supabase
      .from("agent_goals")
      .update(updates)
      .eq("id", goalId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("[MemoryStore] Failed to update goal:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Complete a goal step
 */
export async function completeGoalStep(
  goalId: string,
  stepId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerClient();

  try {
    // Get current goal
    const { data: goal, error: fetchError } = await supabase
      .from("agent_goals")
      .select("steps, progress")
      .eq("id", goalId)
      .single();

    if (fetchError) throw fetchError;

    const steps: GoalStep[] = goal.steps || [];
    const stepIndex = steps.findIndex((s) => s.id === stepId);

    if (stepIndex === -1) {
      return { success: false, error: "Step not found" };
    }

    steps[stepIndex].status = "completed";
    steps[stepIndex].completedAt = new Date();

    // Recalculate progress
    const completedSteps = steps.filter((s) => s.status === "completed").length;
    const newProgress = Math.round((completedSteps / steps.length) * 100);

    const { error } = await supabase
      .from("agent_goals")
      .update({
        steps,
        progress: newProgress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error("[MemoryStore] Failed to complete step:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Learn from user feedback on a suggestion
 */
export async function learnFromFeedback(
  memoryId: string,
  feedback: "positive" | "negative" | "neutral",
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // Update the memory with feedback
  const result = await updateMemory(memoryId, { userFeedback: feedback });

  if (!result.success) return result;

  // If negative feedback, store as learning
  if (feedback === "negative" && reason) {
    await storeMemory({
      type: "learning",
      category: "user_feedback",
      content: `User rejected suggestion (ID: ${memoryId}). Reason: ${reason}`,
      priority: "high",
      context: { rejectedMemoryId: memoryId, reason },
    });
  }

  return { success: true };
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(): Promise<{
  success: boolean;
  stats?: {
    totalMemories: number;
    byType: Record<MemoryType, number>;
    byPriority: Record<PriorityLevel, number>;
    recentDecisions: number;
    activeGoals: number;
    userPreferences: number;
  };
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    // Get counts by type
    const { data: typeCounts, error: typeError } = await supabase
      .from("agent_memory")
      .select("type", { count: "exact" });

    if (typeError) throw typeError;

    // Get total memories
    const { count: totalMemories, error: totalError } = await supabase
      .from("agent_memory")
      .select("*", { count: "exact", head: true });

    if (totalError) throw totalError;

    // Get active goals count
    const { count: activeGoals, error: goalsError } = await supabase
      .from("agent_goals")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");

    if (goalsError) throw goalsError;

    // Get user preferences count
    const { count: userPreferences, error: prefError } = await supabase
      .from("user_preferences")
      .select("*", { count: "exact", head: true });

    if (prefError) throw prefError;

    // Calculate by type
    const byType: Record<string, number> = {};
    typeCounts?.forEach((row) => {
      byType[row.type] = (byType[row.type] || 0) + 1;
    });

    return {
      success: true,
      stats: {
        totalMemories: totalMemories || 0,
        byType: byType as Record<MemoryType, number>,
        byPriority: { low: 0, normal: 0, high: 0, critical: 0 }, // Simplified
        recentDecisions: 0,
        activeGoals: activeGoals || 0,
        userPreferences: userPreferences || 0,
      },
    };
  } catch (error) {
    console.error("[MemoryStore] Failed to get stats:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Clean expired memories
 */
export async function cleanExpiredMemories(): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from("agent_memory")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) throw error;

    return { success: true, deletedCount: data?.length || 0 };
  } catch (error) {
    console.error("[MemoryStore] Failed to clean memories:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
