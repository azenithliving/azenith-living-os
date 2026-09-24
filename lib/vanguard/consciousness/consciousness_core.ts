/**
 * lib/vanguard/consciousness/consciousness_core.ts
 * ================================================
 * THE SOUL OF THE SYSTEM — Consciousness Core
 *
 * Manages: state machine, goals, beliefs, attention, autonomous decision cycles,
 * periodic reflection, self-evolution scheduling, persistent state.
 *
 * The ConsciousnessCore is a long-lived singleton that runs as a background
 * async loop inside Vercel Edge/Node runtimes. It awakens when a session starts,
 * runs its main loop until explicitly put to sleep, and persists all state to
 * Supabase so it survives cold starts.
 */

import {
  ConsciousnessState,
  GoalPriority,
  GoalStatus,
  type Goal,
  type Belief,
  type Memory,
  type ConsciousnessStateSnapshot,
  type VanguardIdentity,
  type VanguardError,
  type Result,
  makeGoal,
  makeError,
  Ok,
  Err,
} from "@/lib/vanguard/types";

import { logger } from "@/lib/vanguard/observability/logger";

// ════════════════════════════════════════════════════════════════════════════
// CONSCIOUSNESS METRICS
// ════════════════════════════════════════════════════════════════════════════

export interface ConsciousnessMetrics {
  cycleCount: number;
  reflectionCount: number;
  evolutionCount: number;
  errorCount: number;
  startTimeMs: number;
  lastCycleMs: number;
  avgCycleMs: number;
  decisionsMade: number;
  actionsExecuted: number;
  actionsFailed: number;
  goalsCompleted: number;
  goalsFailed: number;
  beliefsFormed: number;
  memoriesStored: number;
  memoriesRecalled: number;
}

function makeMetrics(): ConsciousnessMetrics {
  return {
    cycleCount: 0,
    reflectionCount: 0,
    evolutionCount: 0,
    errorCount: 0,
    startTimeMs: Date.now(),
    lastCycleMs: 0,
    avgCycleMs: 0,
    decisionsMade: 0,
    actionsExecuted: 0,
    actionsFailed: 0,
    goalsCompleted: 0,
    goalsFailed: 0,
    beliefsFormed: 0,
    memoriesStored: 0,
    memoriesRecalled: 0,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EXECUTION RESULT
// ════════════════════════════════════════════════════════════════════════════

export interface StepResult {
  readonly success: boolean;
  readonly result: unknown;
  readonly error: string | null;
  readonly latencyMs: number;
}

// ════════════════════════════════════════════════════════════════════════════
// REFLECTION OUTPUT
// ════════════════════════════════════════════════════════════════════════════

export interface ReflectionOutput {
  readonly newBeliefs: Belief[];
  readonly goalAdjustments: Array<{ goalId: string; changes: Partial<Goal> }>;
  readonly newStrategies: Array<{
    name: string;
    description: string;
    steps: string[];
    estimatedSuccessRate: number;
  }>;
  readonly insights: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// PERSISTENCE INTERFACE
// ════════════════════════════════════════════════════════════════════════════

export interface ConsciousnessPersistence {
  saveState(state: SerializableConsciousnessState): Promise<Result<void, VanguardError>>;
  loadState(): Promise<Result<SerializableConsciousnessState | null, VanguardError>>;
  getActiveGoals(): Promise<Result<Goal[], VanguardError>>;
  storeGoal(goal: Goal): Promise<Result<void, VanguardError>>;
  storeBelief(belief: Belief): Promise<Result<void, VanguardError>>;
  storeMemory(memory: Memory): Promise<Result<string, VanguardError>>;
  retrieveRelevantMemories(query: string, limit: number): Promise<Result<Memory[], VanguardError>>;
  getRelevantBeliefs(context: Record<string, unknown>): Promise<Result<Belief[], VanguardError>>;
}

// ════════════════════════════════════════════════════════════════════════════
// SERIALIZABLE STATE (for persistence)
// ════════════════════════════════════════════════════════════════════════════

export interface SerializableConsciousnessState {
  readonly identity: VanguardIdentity;
  readonly state: ConsciousnessState;
  readonly goals: Record<string, Goal>;
  readonly rootGoalIds: string[];
  readonly beliefs: Record<string, Belief>;
  readonly currentContext: Record<string, unknown>;
  readonly attentionFocus: string | null;
  readonly metrics: ConsciousnessMetrics;
  readonly decisionHistory: DecisionRecord[];
  readonly timestamp: string;
}

export interface DecisionRecord {
  readonly type: "action" | "error" | "belief_update" | "goal_update" | "reflection";
  readonly description: string;
  readonly context: Record<string, unknown>;
  readonly timestamp: string;
  readonly outcome?: "success" | "failure" | "pending";
}

// ════════════════════════════════════════════════════════════════════════════
// CONSCIOUSNESS CORE
// ════════════════════════════════════════════════════════════════════════════

export class ConsciousnessCore {
  private state: ConsciousnessState = ConsciousnessState.DORMANT;
  private readonly identity: VanguardIdentity;
  private goals: Map<string, Goal> = new Map();
  private rootGoalIds: string[] = [];
  private beliefs: Map<string, Belief> = new Map();
  private currentContext: Record<string, unknown> = {};
  private attentionFocus: string | null = null;
  private metrics: ConsciousnessMetrics = makeMetrics();
  private decisionHistory: DecisionRecord[] = [];
  private running = false;
  private mainLoopTimer: ReturnType<typeof setTimeout> | null = null;

  // Injected dependencies
  private readonly persistence: ConsciousnessPersistence;
  private readonly onStateChange?: (state: ConsciousnessState) => void;
  private readonly onError?: (error: VanguardError) => void;

  constructor(opts: {
    identity: VanguardIdentity;
    persistence: ConsciousnessPersistence;
    onStateChange?: (state: ConsciousnessState) => void;
    onError?: (error: VanguardError) => void;
  }) {
    this.identity = opts.identity;
    this.persistence = opts.persistence;
    this.onStateChange = opts.onStateChange;
    this.onError = opts.onError;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Awaken the consciousness — load context, goals, beliefs, start main loop */
  async awaken(context: Record<string, unknown>): Promise<Result<void, VanguardError>> {
    if (this.state !== ConsciousnessState.DORMANT) {
      return Err(
        makeError("ALREADY_AWAKE", `Consciousness already ${this.state}`, { state: this.state })
      );
    }

    this.transitionState(ConsciousnessState.AWAKENING);
    logger.info("[ConsciousnessCore] Awakening...", { context });

    // 1. Load previous state if available
    const prevStateResult = await this.persistence.loadState();
    if (prevStateResult.ok && prevStateResult.value) {
      this.hydrateFrom(prevStateResult.value);
    }

    // 2. Load active goals from DB
    const goalsResult = await this.persistence.getActiveGoals();
    if (goalsResult.ok) {
      for (const goal of goalsResult.value) {
        this.goals.set(goal.id, goal);
        if (goal.parentId === null) {
          if (!this.rootGoalIds.includes(goal.id)) {
            this.rootGoalIds.push(goal.id);
          }
        }
      }
    }

    // 3. Load relevant beliefs
    const beliefsResult = await this.persistence.getRelevantBeliefs(context);
    if (beliefsResult.ok) {
      for (const belief of beliefsResult.value) {
        this.beliefs.set(belief.id, belief);
      }
    }

    // 4. Merge incoming context
    this.currentContext = { ...this.currentContext, ...context };
    this.buildInternalContext();

    // 5. Seed default goals if none exist
    if (this.rootGoalIds.length === 0) {
      await this.seedDefaultGoals();
    }

    this.running = true;
    this.transitionState(ConsciousnessState.ACTIVE);
    this.scheduleNextCycle();

    logger.info("[ConsciousnessCore] Fully awake", {
      activeGoals: this.goals.size,
      beliefs: this.beliefs.size,
    });

    return Ok(undefined);
  }

  /** Put consciousness to sleep — save state, cancel loop */
  async sleep(): Promise<void> {
    logger.info("[ConsciousnessCore] Going to sleep...");
    this.running = false;

    if (this.mainLoopTimer) {
      clearTimeout(this.mainLoopTimer);
      this.mainLoopTimer = null;
    }

    this.transitionState(ConsciousnessState.DORMANTING);
    await this.persistState();
    this.transitionState(ConsciousnessState.DORMANT);
    logger.info("[ConsciousnessCore] Asleep");
  }

  /** Add a goal to the hierarchy */
  async addGoal(goal: Goal, parentId?: string): Promise<Result<string, VanguardError>> {
    if (parentId && this.goals.has(parentId)) {
      const parent = this.goals.get(parentId)!;
      parent.childrenIds.push(goal.id);
      goal = { ...goal, parentId };
    } else {
      this.rootGoalIds.push(goal.id);
    }
    this.goals.set(goal.id, goal);
    await this.persistence.storeGoal(goal);
    return Ok(goal.id);
  }

  /** Add a belief */
  async addBelief(belief: Belief): Promise<Result<string, VanguardError>> {
    this.beliefs.set(belief.id, belief);
    await this.persistence.storeBelief(belief);
    this.metrics.beliefsFormed++;
    return Ok(belief.id);
  }

  /** Store a memory */
  async storeMemory(memory: Memory): Promise<Result<string, VanguardError>> {
    const result = await this.persistence.storeMemory(memory);
    if (result.ok) {
      this.metrics.memoriesStored++;
    }
    return result;
  }

  /** Recall relevant memories */
  async recall(query: string, limit = 10): Promise<Memory[]> {
    const result = await this.persistence.retrieveRelevantMemories(query, limit);
    if (result.ok) {
      this.metrics.memoriesRecalled += result.value.length;
      return result.value;
    }
    return [];
  }

  /**
   * Semantic search across all memory types (Phase 2 integration)
   * Uses vector similarity + reranking for best results
   */
  async searchSemanticMemory(
    query: string,
    options?: {
      entityTypes?: string[];
      limit?: number;
      contextDomain?: string;
    }
  ): Promise<Array<{
    content: string;
    entity_type: string;
    similarity: number;
    metadata: Record<string, unknown>;
  }>> {
    // Dynamic import to avoid circular dependency
    const { searchMemory } = await import("@/lib/vanguard/memory/semantic_memory_engine");

    const result = await searchMemory({
      query,
      entityTypes: options?.entityTypes,
      limit: options?.limit || 10,
      contextDomain: options?.contextDomain,
      rerank: true,
    });

    if (result.ok) {
      this.metrics.memoriesRecalled += result.value.results.length;
      return result.value.results.map((r) => ({
        content: r.content,
        entity_type: r.entity_type,
        similarity: r.finalScore,
        metadata: r.metadata,
      }));
    }

    logger.warn("[ConsciousnessCore] Semantic search failed", { error: result.error.message });
    return [];
  }

  /**
   * Store memory with semantic embedding (Phase 2 integration)
   */
  async storeSemanticMemory(
    entity_type: string,
    entity_id: string,
    content: string,
    metadata?: Record<string, unknown>
  ): Promise<string | null> {
    // Dynamic import
    const { storeMemory } = await import("@/lib/vanguard/memory/semantic_memory_engine");

    const result = await storeMemory({
      entity_type,
      entity_id,
      content,
      metadata,
    });

    if (result.ok) {
      this.metrics.memoriesStored++;
      logger.debug("[ConsciousnessCore] Semantic memory stored", {
        id: result.value.id,
        entity_type,
      });
      return result.value.id;
    }

    logger.error("[ConsciousnessCore] Failed to store semantic memory", {
      error: result.error.message,
    });
    return null;
  }

  /**
   * Send channel-aware response (Phase 3 integration)
   * Adapts tone and format based on communication channel
   */
  async sendChannelResponse(
    channelType: "whatsapp" | "email" | "webchat",
    to: string,
    message: string,
    options?: {
      urgency?: "low" | "medium" | "high";
      relationshipStage?: "new" | "familiar" | "established";
      conversationTopic?: "sales" | "support" | "general";
      customerMood?: "positive" | "neutral" | "frustrated";
      mediaUrl?: string;
      mediaType?: "image" | "document" | "audio" | "video";
      subject?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Dynamic imports
      const { createChannelRouter } = await import("@/lib/vanguard/channels/channel_router");
      const { adaptTone } = await import("@/lib/vanguard/channels/tone_adapter");
      const { createWhatsAppAdapter } = await import("@/lib/vanguard/channels/whatsapp_adapter");
      const { createEmailAdapter } = await import("@/lib/vanguard/channels/email_adapter");

      // Adapt message tone for channel
      const adaptedMessage = adaptTone(message, channelType, {
        urgency: options?.urgency,
        relationshipStage: options?.relationshipStage,
        conversationTopic: options?.conversationTopic,
        customerMood: options?.customerMood,
      });

      // Create router with adapters
      const router = createChannelRouter();
      
      if (channelType === "whatsapp") {
        router.registerWhatsApp(createWhatsAppAdapter());
      } else if (channelType === "email") {
        router.registerEmail(createEmailAdapter());
      }

      // Send message
      const result = await router.sendMessage({
        channelType,
        to,
        text: adaptedMessage,
        options: {
          mediaUrl: options?.mediaUrl,
          mediaType: options?.mediaType,
          subject: options?.subject,
          metadata: options?.metadata,
        },
      });

      if (result.ok) {
        logger.info("[ConsciousnessCore] Channel response sent", {
          channelType,
          to,
          messageId: result.value.messageId,
        });

        return {
          success: true,
          messageId: result.value.messageId,
        };
      } else {
        logger.error("[ConsciousnessCore] Channel response failed", {
          channelType,
          to,
          error: result.error.message,
        });

        return {
          success: false,
          error: result.error.message,
        };
      }
    } catch (error) {
      logger.error("[ConsciousnessCore] sendChannelResponse error", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute a single tool action (Phase 4)
   */
  async executeAction(
    toolId: string,
    input: unknown,
    options?: {
      verificationLevel?: 'none' | 'basic' | 'standard' | 'strict';
      retryOnFailure?: boolean;
      maxRetries?: number;
    }
  ): Promise<Result<{
    success: boolean;
    data?: unknown;
    error?: { code: string; message: string; messageAr: string };
    verification?: {
      status: 'passed' | 'warning' | 'failed';
      confidence: number;
    };
    metrics: {
      executionTimeMs: number;
      cached?: boolean;
    };
  }, VanguardError>> {
    try {
      const { toolRegistry } = await import('@/lib/vanguard/execution/tool_registry');
      const { resultVerifier } = await import('@/lib/vanguard/execution/result_verifier');
      const { executionMonitor } = await import('@/lib/vanguard/execution/execution_monitor');

      logger.info('[ConsciousnessCore] Executing action', { toolId });

      // Get tool
      const tool = toolRegistry.getTool(toolId);
      if (!tool) {
        return Err(makeError('TOOL_NOT_FOUND', `Tool "${toolId}" not found`, { toolId }));
      }

      // Check if tool requires approval
      const requiresApproval = toolRegistry.requiresApproval(toolId);
      if (requiresApproval) {
        logger.warn('[ConsciousnessCore] Tool requires approval', { toolId, riskLevel: tool.definition.riskLevel });
      }

      // Execute with retry logic
      const maxRetries = options?.retryOnFailure ? (options.maxRetries || 3) : 1;
      let lastResult;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        if (attempt > 0) {
          logger.info('[ConsciousnessCore] Retrying action', { toolId, attempt: attempt + 1 });
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        // Execute tool
        lastResult = await toolRegistry.executeTool(toolId, input, {
          userId: this.currentContext.userId as string | undefined,
          sessionId: this.currentContext.sessionId as string | undefined,
          conversationId: this.currentContext.conversationId as string | undefined,
          channel: this.currentContext.channel as 'whatsapp' | 'email' | 'webchat' | undefined,
          metadata: this.currentContext
        });

        if (lastResult.success) {
          break;
        }
      }

      if (!lastResult) {
        return Err(makeError('EXECUTION_FAILED', 'Tool execution failed'));
      }

      // Verify result
      let verification;
      const verificationLevel = options?.verificationLevel || 'standard';
      
      if (verificationLevel !== 'none' && lastResult.success) {
        verification = await resultVerifier.verify(
          lastResult,
          {
            toolId,
            input,
            metadata: this.currentContext
          },
          verificationLevel
        );

        logger.info('[ConsciousnessCore] Result verification', {
          toolId,
          status: verification.status,
          confidence: verification.confidence
        });
      }

      // Log execution
      await executionMonitor.logExecution(
        toolId,
        tool.definition.name,
        input,
        lastResult,
        {
          userId: this.currentContext.userId as string | undefined,
          sessionId: this.currentContext.sessionId as string | undefined,
          conversationId: this.currentContext.conversationId as string | undefined,
          channel: this.currentContext.channel as 'whatsapp' | 'email' | 'webchat' | undefined
        },
        verification
      );

      // Update metrics
      this.metrics.actionsExecuted++;
      if (!lastResult.success) {
        this.metrics.actionsFailed++;
      }

      return Ok({
        success: lastResult.success,
        data: lastResult.data,
        error: lastResult.error,
        verification: verification ? {
          status: verification.status,
          confidence: verification.confidence
        } : undefined,
        metrics: {
          executionTimeMs: lastResult.metadata.executionTimeMs,
          cached: lastResult.metadata.cached
        }
      });
    } catch (error) {
      return Err(
        makeError('ACTION_EXECUTION_ERROR', error instanceof Error ? error.message : 'Unknown error', { toolId })
      );
    }
  }

  /**
   * Execute an action pipeline (Phase 4)
   */
  async executePipeline(
    name: string,
    nameAr: string,
    steps: Array<{
      toolId: string;
      input: unknown;
      dependsOn?: string[];
      optional?: boolean;
      retryOnFailure?: boolean;
    }>,
    options?: {
      mode?: 'sequential' | 'parallel' | 'mixed';
      continueOnError?: boolean;
      enableRollback?: boolean;
      verificationLevel?: 'none' | 'basic' | 'standard' | 'strict';
    }
  ): Promise<Result<{
    planId: string;
    status: 'completed' | 'partial' | 'failed';
    completedSteps: number;
    failedSteps: number;
    totalDurationMs: number;
    steps: Array<{
      stepId: string;
      toolId: string;
      status: string;
      data?: unknown;
      error?: { code: string; message: string };
      durationMs?: number;
    }>;
  }, VanguardError>> {
    try {
      const { createPipeline } = await import('@/lib/vanguard/execution/action_pipeline');

      logger.info('[ConsciousnessCore] Executing pipeline', { name, nameAr, stepCount: steps.length });

      // Build pipeline
      const builder = createPipeline(name, nameAr)
        .withContext({
          userId: this.currentContext.userId as string | undefined,
          sessionId: this.currentContext.sessionId as string | undefined,
          conversationId: this.currentContext.conversationId as string | undefined,
          channel: this.currentContext.channel as 'whatsapp' | 'email' | 'webchat' | undefined,
          metadata: this.currentContext
        })
        .withMode(options?.mode || 'mixed');

      if (options?.continueOnError) {
        builder.continueOnError(true);
      }

      if (options?.enableRollback) {
        builder.enableRollback(true);
      }

      // Add steps
      for (const step of steps) {
        builder.addStep({
          toolId: step.toolId,
          input: step.input,
          dependsOn: step.dependsOn,
          optional: step.optional,
          retryOnFailure: step.retryOnFailure
        });
      }

      // Execute
      const result = await builder.execute();

      // Update metrics
      this.metrics.actionsExecuted += result.totalSteps;
      this.metrics.actionsFailed += result.failedSteps;

      logger.info('[ConsciousnessCore] Pipeline execution complete', {
        planId: result.planId,
        status: result.status,
        completedSteps: result.completedSteps,
        failedSteps: result.failedSteps,
        totalDurationMs: result.totalDurationMs
      });

      return Ok({
        planId: result.planId,
        status: result.status,
        completedSteps: result.completedSteps,
        failedSteps: result.failedSteps,
        totalDurationMs: result.totalDurationMs,
        steps: result.steps.map(s => ({
          stepId: s.stepId,
          toolId: s.toolId,
          status: s.status,
          data: s.result?.data,
          error: s.error,
          durationMs: s.durationMs
        }))
      });
    } catch (error) {
      return Err(
        makeError('PIPELINE_EXECUTION_ERROR', error instanceof Error ? error.message : 'Unknown error', { name })
      );
    }
  }

  /**
   * Get or create conversation across channels (Phase 3 integration)
   */
  async getConversation(
    channelType: "whatsapp" | "email" | "webchat",
    identifier: string
  ): Promise<{
    conversationId: string;
    history: Array<{
      from: "user" | "agent";
      text: string;
      timestamp: number;
      channelType: string;
    }>;
    context: Record<string, unknown>;
  } | null> {
    try {
      const { getConversationManager } = await import("@/lib/vanguard/channels/conversation_manager");
      const manager = getConversationManager();

      const result = await manager.getOrCreateConversation(channelType, identifier);

      if (!result.ok) {
        logger.error("[ConsciousnessCore] Failed to get conversation", {
          error: result.error.message,
        });
        return null;
      }

      const conversation = result.value;
      const history = manager.getHistory(conversation.id, 50);
      const context = manager.getContext(conversation.id);

      return {
        conversationId: conversation.id,
        history: history.map((msg) => ({
          from: msg.from,
          text: msg.text,
          timestamp: msg.timestamp,
          channelType: msg.channelType,
        })),
        context,
      };
    } catch (error) {
      logger.error("[ConsciousnessCore] getConversation error", { error });
      return null;
    }
  }

  /** Current status snapshot */
  getStatus(): ConsciousnessStateSnapshot {
    return {
      state: this.state,
      activeGoalCount: [...this.goals.values()].filter((g) => g.status === GoalStatus.ACTIVE).length,
      attentionFocus: this.attentionFocus,
      cycleCount: this.metrics.cycleCount,
      timestamp: new Date().toISOString(),
    };
  }

  /** Get all active goals sorted by priority */
  getActiveGoals(): Goal[] {
    return [...this.goals.values()]
      .filter((g) => g.status === GoalStatus.ACTIVE)
      .sort((a, b) => b.priority - a.priority);
  }

  /** Get current context */
  getContext(): Record<string, unknown> {
    return { ...this.currentContext };
  }

  /** Update context (e.g. from a new conversation turn) */
  updateContext(patch: Record<string, unknown>): void {
    this.currentContext = { ...this.currentContext, ...patch };
    this.buildInternalContext();
  }

  // ── Private: Main Loop ────────────────────────────────────────────────────

  private scheduleNextCycle(delayMs = 1000): void {
    if (!this.running) return;
    this.mainLoopTimer = setTimeout(() => void this.runCycle(), delayMs);
  }

  private async runCycle(): Promise<void> {
    if (!this.running) return;
    const cycleStart = Date.now();

    try {
      await this.updateAttention();
      await this.reviewGoals();
      await this.autonomousDecisionCycle();

      // Periodic reflection every 10 cycles
      if (this.metrics.cycleCount > 0 && this.metrics.cycleCount % 10 === 0) {
        await this.periodicReflection();
      }

      // Self-evolution every 100 cycles
      if (this.metrics.cycleCount > 0 && this.metrics.cycleCount % 100 === 0) {
        await this.triggerEvolution();
      }
    } catch (err) {
      const vErr = makeError(
        "CYCLE_ERROR",
        `Cycle ${this.metrics.cycleCount} failed: ${String(err)}`,
        { cycle: this.metrics.cycleCount }
      );
      this.handleError(vErr);
    }

    const elapsed = Date.now() - cycleStart;
    this.metrics.cycleCount++;
    this.metrics.lastCycleMs = elapsed;
    this.metrics.avgCycleMs =
      (this.metrics.avgCycleMs * (this.metrics.cycleCount - 1) + elapsed) / this.metrics.cycleCount;

    // Adaptive sleep: aim for 1s cycle, back off under load
    const nextDelay = Math.max(100, 1000 - elapsed);
    this.scheduleNextCycle(nextDelay);
  }

  // ── Private: Attention ────────────────────────────────────────────────────

  private async updateAttention(): Promise<void> {
    const critical = this.getActiveGoals().filter((g) => g.priority === GoalPriority.CRITICAL);
    if (critical.length > 0) {
      this.attentionFocus = critical[0].id;
      return;
    }

    const high = this.getActiveGoals().filter((g) => g.priority === GoalPriority.HIGH);
    if (high.length > 0) {
      // Most urgent = highest urgency metadata
      const mostUrgent = high.reduce((prev, curr) =>
        ((curr.metadata.urgency as number) ?? 0) > ((prev.metadata.urgency as number) ?? 0)
          ? curr
          : prev
      );
      this.attentionFocus = mostUrgent.id;
      return;
    }

    const activeConversation = this.currentContext.activeConversation as string | undefined;
    if (activeConversation) {
      this.attentionFocus = `conversation:${activeConversation}`;
      return;
    }

    this.attentionFocus = null;
  }

  // ── Private: Goal Review ──────────────────────────────────────────────────

  private async reviewGoals(): Promise<void> {
    for (const [goalId, goal] of this.goals.entries()) {
      if (goal.status !== GoalStatus.ACTIVE) continue;

      // Check deadline
      if (goal.deadline) {
        const deadline = new Date(goal.deadline);
        if (Date.now() > deadline.getTime()) {
          goal.status = GoalStatus.FAILED;
          goal.metadata = { ...goal.metadata, failureReason: "deadline_exceeded" };
          this.metrics.goalsFailed++;
          logger.warn("[ConsciousnessCore] Goal failed: deadline exceeded", { goalId });
        }
      }

      // Check success criteria
      for (const criterion of goal.successCriteria) {
        if (criterion.checkFn) {
          try {
            const met = await criterion.checkFn();
            if (met) {
              goal.progress = 1.0;
              goal.status = GoalStatus.COMPLETED;
              goal.completedAt = new Date().toISOString();
              this.metrics.goalsCompleted++;
              logger.info("[ConsciousnessCore] Goal completed", { goalId, criterion: criterion.id });
              break;
            }
          } catch (err) {
            logger.warn("[ConsciousnessCore] Goal criterion check failed", {
              goalId,
              criterionId: criterion.id,
              error: String(err),
            });
          }
        }
      }

      // Remove completed/failed goals from root list
      if (goal.status === GoalStatus.COMPLETED || goal.status === GoalStatus.FAILED) {
        const idx = this.rootGoalIds.indexOf(goalId);
        if (idx !== -1) this.rootGoalIds.splice(idx, 1);
      }
    }
  }

  // ── Private: Autonomous Decisions ────────────────────────────────────────

  private async autonomousDecisionCycle(): Promise<void> {
    const primaryGoal = this.getActiveGoals().find((g) => this.rootGoalIds.includes(g.id));
    if (!primaryGoal) return;

    this.transitionState(ConsciousnessState.EXECUTING);
    this.metrics.decisionsMade++;

    try {
      // The planning + execution is delegated to specialized engines
      // imported lazily to avoid circular deps
      const { planAndExecuteGoal } = await import("@/lib/vanguard/planning/planning_engine");
      const result = await planAndExecuteGoal(primaryGoal, this.currentContext);

      if (result.ok) {
        this.metrics.actionsExecuted++;
        this.recordDecision({
          type: "action",
          description: `Executed plan for goal: ${primaryGoal.description}`,
          context: { goalId: primaryGoal.id },
          outcome: "success",
        });
      } else {
        this.recordDecision({
          type: "error",
          description: `Plan failed for goal: ${primaryGoal.description}`,
          context: { goalId: primaryGoal.id, error: result.error.message },
          outcome: "failure",
        });
      }
    } catch (err) {
      // Planning engine not yet available — skip gracefully
      logger.debug("[ConsciousnessCore] Planning engine not available yet", { error: String(err) });
    } finally {
      this.transitionState(ConsciousnessState.ACTIVE);
    }
  }

  // ── Private: Reflection ───────────────────────────────────────────────────

  private async periodicReflection(): Promise<void> {
    this.transitionState(ConsciousnessState.REFLECTING);
    logger.info("[ConsciousnessCore] Starting periodic reflection", {
      cycle: this.metrics.cycleCount,
    });

    try {
      const { reflect } = await import("@/lib/vanguard/reflection/reflection_engine");
      const output: ReflectionOutput = await reflect({
        recentDecisions: this.decisionHistory.slice(-50),
        currentGoals: this.getActiveGoals(),
        beliefs: [...this.beliefs.values()],
        context: this.currentContext,
      });

      // Apply reflection outputs
      for (const belief of output.newBeliefs) {
        await this.adoptBelief(belief);
      }
      for (const adj of output.goalAdjustments) {
        this.adjustGoal(adj.goalId, adj.changes);
      }

      this.metrics.reflectionCount++;
      logger.info("[ConsciousnessCore] Reflection complete", {
        newBeliefs: output.newBeliefs.length,
        adjustments: output.goalAdjustments.length,
        insights: output.insights,
      });
    } catch (err) {
      logger.debug("[ConsciousnessCore] Reflection engine not available yet", {
        error: String(err),
      });
    } finally {
      this.transitionState(ConsciousnessState.ACTIVE);
    }
  }

  // ── Private: Evolution ────────────────────────────────────────────────────

  private async triggerEvolution(): Promise<void> {
    this.transitionState(ConsciousnessState.EVOLVING);
    logger.info("[ConsciousnessCore] Triggering evolution cycle", {
      cycle: this.metrics.cycleCount,
    });

    try {
      const { evolve } = await import("@/lib/vanguard/evolution/evolution_engine");
      await evolve({
        metrics: this.metrics,
        decisionHistory: this.decisionHistory.slice(-100),
        beliefs: [...this.beliefs.values()],
      });
      this.metrics.evolutionCount++;
    } catch (err) {
      logger.debug("[ConsciousnessCore] Evolution engine not available yet", {
        error: String(err),
      });
    } finally {
      this.transitionState(ConsciousnessState.ACTIVE);
    }
  }

  // ── Private: Helpers ──────────────────────────────────────────────────────

  private transitionState(newState: ConsciousnessState): void {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  private buildInternalContext(): void {
    this.currentContext = {
      ...this.currentContext,
      identityName: this.identity.name,
      activeGoalCount: this.getActiveGoals().length,
      attentionFocus: this.attentionFocus,
      state: this.state,
      cycleCount: this.metrics.cycleCount,
      timestamp: new Date().toISOString(),
    };
  }

  private async adoptBelief(belief: Belief): Promise<void> {
    const existing = this.beliefs.get(belief.id);
    if (existing) {
      // Merge evidence and average confidence
      existing.evidenceIds.push(...belief.evidenceIds);
      const merged: Belief = {
        ...existing,
        confidence: (existing.confidence + belief.confidence) / 2,
        updatedAt: new Date().toISOString(),
        lastChallenged: new Date().toISOString(),
        challengeCount: existing.challengeCount + 1,
      };
      this.beliefs.set(belief.id, merged);
    } else {
      this.beliefs.set(belief.id, belief);
      await this.persistence.storeBelief(belief);
      this.metrics.beliefsFormed++;
    }
  }

  private adjustGoal(goalId: string, changes: Partial<Goal>): void {
    const goal = this.goals.get(goalId);
    if (!goal) return;
    this.goals.set(goalId, { ...goal, ...changes, updatedAt: new Date().toISOString() });
  }

  private recordDecision(record: Omit<DecisionRecord, "timestamp">): void {
    this.decisionHistory.push({ ...record, timestamp: new Date().toISOString() });
    // Keep last 1000 decisions only
    if (this.decisionHistory.length > 1000) {
      this.decisionHistory.splice(0, this.decisionHistory.length - 1000);
    }
  }

  private handleError(error: VanguardError): void {
    this.metrics.errorCount++;
    this.recordDecision({
      type: "error",
      description: error.message,
      context: error.context ?? {},
      outcome: "failure",
    });
    this.onError?.(error);
    logger.error("[ConsciousnessCore] Error in cycle", { error });
  }

  private hydrateFrom(saved: SerializableConsciousnessState): void {
    for (const [id, goal] of Object.entries(saved.goals)) {
      this.goals.set(id, goal);
    }
    for (const [id, belief] of Object.entries(saved.beliefs)) {
      this.beliefs.set(id, belief);
    }
    this.rootGoalIds = saved.rootGoalIds;
    this.currentContext = saved.currentContext;
    this.attentionFocus = saved.attentionFocus;
    this.decisionHistory = saved.decisionHistory;
    logger.info("[ConsciousnessCore] Hydrated from saved state", { timestamp: saved.timestamp });
  }

  private async persistState(): Promise<void> {
    const state: SerializableConsciousnessState = {
      identity: this.identity,
      state: this.state,
      goals: Object.fromEntries(this.goals.entries()),
      rootGoalIds: this.rootGoalIds,
      beliefs: Object.fromEntries(this.beliefs.entries()),
      currentContext: this.currentContext,
      attentionFocus: this.attentionFocus,
      metrics: this.metrics,
      decisionHistory: this.decisionHistory.slice(-1000),
      timestamp: new Date().toISOString(),
    };

    const result = await this.persistence.saveState(state);
    if (!result.ok) {
      logger.error("[ConsciousnessCore] Failed to persist state", { error: result.error });
    }
  }

  private async seedDefaultGoals(): Promise<void> {
    const defaultGoals: Goal[] = [
      makeGoal({
        description: "تأهيل العملاء المحتملين وتحويلهم لفرص مبيعات",
        priority: GoalPriority.HIGH,
        metadata: { type: "sales", urgency: 80 },
      }),
      makeGoal({
        description: "الحفاظ على دقة المعلومات وصفر هلوسة في كل رد",
        priority: GoalPriority.CRITICAL,
        metadata: { type: "quality" },
      }),
      makeGoal({
        description: "مراقبة السوق المصري وتحديد الفرص والمخاطر",
        priority: GoalPriority.MEDIUM,
        metadata: { type: "intelligence", urgency: 40 },
      }),
      makeGoal({
        description: "التطور الذاتي المستمر وتحسين معدلات الإغلاق",
        priority: GoalPriority.LOW,
        metadata: { type: "evolution", urgency: 20 },
      }),
    ];

    for (const goal of defaultGoals) {
      await this.addGoal(goal);
    }
    logger.info("[ConsciousnessCore] Seeded default goals", { count: defaultGoals.length });
  }

  // ── Singleton ─────────────────────────────────────────────────────────────

  private static instance: ConsciousnessCore | null = null;

  static getInstance(): ConsciousnessCore | null {
    return ConsciousnessCore.instance;
  }

  static setInstance(core: ConsciousnessCore): void {
    ConsciousnessCore.instance = core;
  }

  static resetInstance(): void {
    ConsciousnessCore.instance = null;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// FACTORY — wire up with Supabase persistence
// ════════════════════════════════════════════════════════════════════════════

export async function getOrCreateConsciousnessCore(
  identity: VanguardIdentity,
  context: Record<string, unknown> = {}
): Promise<ConsciousnessCore> {
  const existing = ConsciousnessCore.getInstance();
  if (existing) return existing;

  const { SupabaseConsciousnessPersistence } = await import(
    "@/lib/vanguard/memory/supabase_persistence"
  );

  const persistence = new SupabaseConsciousnessPersistence();

  const core = new ConsciousnessCore({
    identity,
    persistence,
    onStateChange: (state) => {
      logger.debug("[ConsciousnessCore] State changed", { state });
    },
    onError: (err) => {
      logger.error("[ConsciousnessCore] Core error", { err });
    },
  });

  ConsciousnessCore.setInstance(core);
  await core.awaken(context);
  return core;
}
