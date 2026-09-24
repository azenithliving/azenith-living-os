/**
 * VANGUARD Action Pipeline Orchestrator
 * 
 * منسق خط الأوامر - تنفيذ متسلسل ومتوازٍ للأدوات
 * Orchestrates sequential and parallel tool execution with dependency resolution
 */

import { toolRegistry } from './tool_registry';
import type { ToolExecutionContext, ToolExecutionResult } from './tool_registry';

// ============================================================================
// Types
// ============================================================================

export type ExecutionMode = 'sequential' | 'parallel' | 'mixed';
export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'rolled_back';

export interface ActionStep {
  id: string;
  toolId: string;
  input: unknown;
  dependsOn?: string[];
  optional?: boolean;
  retryOnFailure?: boolean;
  maxRetries?: number;
  rollbackOnFailure?: boolean;
  description?: string;
  descriptionAr?: string;
}

export interface ExecutionPlan {
  id: string;
  name: string;
  nameAr: string;
  steps: ActionStep[];
  mode: ExecutionMode;
  context: ToolExecutionContext;
  continueOnError?: boolean;
  enableRollback?: boolean;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface StepResult {
  stepId: string;
  toolId: string;
  status: ActionStatus;
  result?: ToolExecutionResult<unknown>;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  retryCount?: number;
  error?: {
    code: string;
    message: string;
    messageAr: string;
  };
}

export interface PipelineResult {
  planId: string;
  status: 'completed' | 'partial' | 'failed';
  steps: StepResult[];
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  error?: {
    code: string;
    message: string;
    messageAr: string;
  };
}

// ============================================================================
// Dependency Graph
// ============================================================================

class DependencyGraph {
  private adjacencyList: Map<string, Set<string>> = new Map();
  private inDegree: Map<string, number> = new Map();

  constructor(steps: ActionStep[]) {
    // Initialize graph
    for (const step of steps) {
      this.adjacencyList.set(step.id, new Set());
      this.inDegree.set(step.id, 0);
    }

    // Build edges
    for (const step of steps) {
      if (step.dependsOn && step.dependsOn.length > 0) {
        for (const depId of step.dependsOn) {
          if (!this.adjacencyList.has(depId)) {
            throw new Error(`Invalid dependency: step "${step.id}" depends on non-existent step "${depId}"`);
          }
          this.adjacencyList.get(depId)!.add(step.id);
          this.inDegree.set(step.id, (this.inDegree.get(step.id) || 0) + 1);
        }
      }
    }
  }

  /**
   * Check for circular dependencies
   */
  hasCycle(): boolean {
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.adjacencyList.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) return true;
      }
    }

    return false;
  }

  /**
   * Get execution order (topological sort)
   */
  getExecutionOrder(): string[][] {
    if (this.hasCycle()) {
      throw new Error('Circular dependency detected in execution plan');
    }

    const inDegree = new Map(this.inDegree);
    const levels: string[][] = [];
    const queue: string[] = [];

    // Find all nodes with no dependencies
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const currentLevel = [...queue];
      levels.push(currentLevel);
      queue.length = 0;

      for (const nodeId of currentLevel) {
        const neighbors = this.adjacencyList.get(nodeId) || new Set();
        for (const neighbor of neighbors) {
          const newDegree = (inDegree.get(neighbor) || 0) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) {
            queue.push(neighbor);
          }
        }
      }
    }

    return levels;
  }

  /**
   * Get dependencies of a step
   */
  getDependencies(stepId: string): string[] {
    const deps: string[] = [];
    for (const [id, neighbors] of this.adjacencyList.entries()) {
      if (neighbors.has(stepId)) {
        deps.push(id);
      }
    }
    return deps;
  }
}

// ============================================================================
// Action Pipeline Orchestrator
// ============================================================================

export class ActionPipeline {
  private results: Map<string, StepResult> = new Map();
  private completedSteps: Set<string> = new Set();
  private failedSteps: Set<string> = new Set();

  /**
   * Execute an execution plan
   */
  async execute(plan: ExecutionPlan): Promise<PipelineResult> {
    const startTime = new Date().toISOString();
    const startTimeMs = Date.now();

    this.results.clear();
    this.completedSteps.clear();
    this.failedSteps.clear();

    console.log(`[ActionPipeline] Starting execution plan: ${plan.name} (${plan.nameAr})`);

    try {
      // Validate plan
      this.validatePlan(plan);

      // Build dependency graph
      const graph = new DependencyGraph(plan.steps);
      const executionLevels = graph.getExecutionOrder();

      console.log(`[ActionPipeline] Execution order: ${executionLevels.length} levels`);

      // Execute levels
      for (let levelIndex = 0; levelIndex < executionLevels.length; levelIndex++) {
        const level = executionLevels[levelIndex];
        console.log(`[ActionPipeline] Executing level ${levelIndex + 1}/${executionLevels.length} (${level.length} steps)`);

        const levelResults = await this.executeLevel(level, plan);

        // Check for failures
        const levelFailed = levelResults.some(r => r.status === 'failed' && !plan.continueOnError);
        if (levelFailed && !plan.continueOnError) {
          console.log(`[ActionPipeline] Level ${levelIndex + 1} failed, stopping execution`);
          
          // Mark remaining steps as skipped
          this.skipRemainingSteps(executionLevels, levelIndex + 1, plan);
          
          // Rollback if enabled
          if (plan.enableRollback) {
            await this.rollback(plan);
          }
          
          break;
        }
      }

      // Build result
      const endTime = new Date().toISOString();
      const totalDurationMs = Date.now() - startTimeMs;
      const steps = Array.from(this.results.values());

      const completedCount = steps.filter(s => s.status === 'completed').length;
      const failedCount = steps.filter(s => s.status === 'failed').length;
      const skippedCount = steps.filter(s => s.status === 'skipped').length;

      let status: 'completed' | 'partial' | 'failed';
      if (failedCount === 0 && skippedCount === 0) {
        status = 'completed';
      } else if (completedCount > 0) {
        status = 'partial';
      } else {
        status = 'failed';
      }

      return {
        planId: plan.id,
        status,
        steps,
        totalSteps: plan.steps.length,
        completedSteps: completedCount,
        failedSteps: failedCount,
        skippedSteps: skippedCount,
        startTime,
        endTime,
        totalDurationMs
      };
    } catch (error) {
      const endTime = new Date().toISOString();
      const totalDurationMs = Date.now() - startTimeMs;

      return {
        planId: plan.id,
        status: 'failed',
        steps: Array.from(this.results.values()),
        totalSteps: plan.steps.length,
        completedSteps: this.completedSteps.size,
        failedSteps: this.failedSteps.size,
        skippedSteps: plan.steps.length - this.completedSteps.size - this.failedSteps.size,
        startTime,
        endTime,
        totalDurationMs,
        error: {
          code: 'PIPELINE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ في تنفيذ خط الأوامر'
        }
      };
    }
  }

  /**
   * Validate execution plan
   */
  private validatePlan(plan: ExecutionPlan): void {
    if (!plan.steps || plan.steps.length === 0) {
      throw new Error('Execution plan must have at least one step');
    }

    // Check for duplicate step IDs
    const stepIds = new Set<string>();
    for (const step of plan.steps) {
      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step ID: ${step.id}`);
      }
      stepIds.add(step.id);
    }

    // Check for invalid tool IDs
    for (const step of plan.steps) {
      const tool = toolRegistry.getTool(step.toolId);
      if (!tool) {
        throw new Error(`Invalid tool ID in step "${step.id}": ${step.toolId}`);
      }
    }
  }

  /**
   * Execute a level (parallel execution)
   */
  private async executeLevel(stepIds: string[], plan: ExecutionPlan): Promise<StepResult[]> {
    const steps = plan.steps.filter(s => stepIds.includes(s.id));
    
    // Execute all steps in parallel
    const promises = steps.map(step => this.executeStep(step, plan));
    const results = await Promise.all(promises);
    
    return results;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: ActionStep, plan: ExecutionPlan): Promise<StepResult> {
    const stepStartTime = new Date().toISOString();
    const stepStartTimeMs = Date.now();

    console.log(`[ActionPipeline] Executing step: ${step.id} (${step.toolId})`);

    // Check if dependencies failed
    if (step.dependsOn && step.dependsOn.length > 0) {
      const depsFailed = step.dependsOn.some(depId => this.failedSteps.has(depId));
      if (depsFailed && !step.optional) {
        const result: StepResult = {
          stepId: step.id,
          toolId: step.toolId,
          status: 'skipped',
          startTime: stepStartTime,
          endTime: new Date().toISOString(),
          durationMs: Date.now() - stepStartTimeMs,
          error: {
            code: 'DEPENDENCY_FAILED',
            message: 'Skipped due to failed dependency',
            messageAr: 'تم التخطي بسبب فشل الخطوة السابقة'
          }
        };
        this.results.set(step.id, result);
        return result;
      }
    }

    // Execute with retry logic
    const maxRetries = step.retryOnFailure ? (step.maxRetries || 3) : 1;
    let lastError: ToolExecutionResult<unknown> | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        console.log(`[ActionPipeline] Retry attempt ${attempt + 1}/${maxRetries} for step: ${step.id}`);
        await this.delay(1000 * attempt); // Exponential backoff
      }

      try {
        const toolResult = await toolRegistry.executeTool(
          step.toolId,
          step.input,
          plan.context
        );

        const stepEndTime = new Date().toISOString();
        const durationMs = Date.now() - stepStartTimeMs;

        if (toolResult.success) {
          const result: StepResult = {
            stepId: step.id,
            toolId: step.toolId,
            status: 'completed',
            result: toolResult,
            startTime: stepStartTime,
            endTime: stepEndTime,
            durationMs,
            retryCount: attempt
          };
          
          this.results.set(step.id, result);
          this.completedSteps.add(step.id);
          
          console.log(`[ActionPipeline] Step completed: ${step.id} (${durationMs}ms)`);
          return result;
        } else {
          lastError = toolResult;
        }
      } catch (error) {
        console.error(`[ActionPipeline] Step exception: ${step.id}`, error);
      }
    }

    // All retries failed
    const stepEndTime = new Date().toISOString();
    const durationMs = Date.now() - stepStartTimeMs;

    const result: StepResult = {
      stepId: step.id,
      toolId: step.toolId,
      status: step.optional ? 'skipped' : 'failed',
      result: lastError,
      startTime: stepStartTime,
      endTime: stepEndTime,
      durationMs,
      retryCount: maxRetries - 1,
      error: lastError?.error || {
        code: 'STEP_FAILED',
        message: 'Step execution failed',
        messageAr: 'فشل تنفيذ الخطوة'
      }
    };

    this.results.set(step.id, result);
    
    if (!step.optional) {
      this.failedSteps.add(step.id);
    }

    console.log(`[ActionPipeline] Step ${step.optional ? 'skipped' : 'failed'}: ${step.id}`);
    return result;
  }

  /**
   * Skip remaining steps
   */
  private skipRemainingSteps(levels: string[][], startLevel: number, plan: ExecutionPlan): void {
    for (let i = startLevel; i < levels.length; i++) {
      for (const stepId of levels[i]) {
        const step = plan.steps.find(s => s.id === stepId);
        if (!step) continue;

        const result: StepResult = {
          stepId: step.id,
          toolId: step.toolId,
          status: 'skipped',
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMs: 0,
          error: {
            code: 'PIPELINE_STOPPED',
            message: 'Skipped due to pipeline failure',
            messageAr: 'تم التخطي بسبب فشل خط الأوامر'
          }
        };

        this.results.set(step.id, result);
      }
    }
  }

  /**
   * Rollback completed steps
   */
  private async rollback(plan: ExecutionPlan): Promise<void> {
    console.log('[ActionPipeline] Starting rollback...');

    const completedStepIds = Array.from(this.completedSteps);
    
    // Rollback in reverse order
    for (let i = completedStepIds.length - 1; i >= 0; i--) {
      const stepId = completedStepIds[i];
      const step = plan.steps.find(s => s.id === stepId);
      
      if (!step || !step.rollbackOnFailure) continue;

      console.log(`[ActionPipeline] Rolling back step: ${stepId}`);

      const stepResult = this.results.get(stepId);
      if (stepResult) {
        stepResult.status = 'rolled_back';
        this.results.set(stepId, stepResult);
      }
    }

    console.log('[ActionPipeline] Rollback completed');
  }

  /**
   * Utility: delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get step results
   */
  getStepResults(): Map<string, StepResult> {
    return new Map(this.results);
  }

  /**
   * Get step result by ID
   */
  getStepResult(stepId: string): StepResult | undefined {
    return this.results.get(stepId);
  }

  /**
   * Get step data (successful results only)
   */
  getStepData<T = unknown>(stepId: string): T | undefined {
    const result = this.results.get(stepId);
    if (result?.status === 'completed' && result.result?.success) {
      return result.result.data as T;
    }
    return undefined;
  }
}

// ============================================================================
// Pipeline Builder (Fluent API)
// ============================================================================

export class PipelineBuilder {
  private plan: Partial<ExecutionPlan> = {
    steps: [],
    mode: 'mixed'
  };

  constructor(name: string, nameAr: string) {
    this.plan.id = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    this.plan.name = name;
    this.plan.nameAr = nameAr;
  }

  /**
   * Add a step to the pipeline
   */
  addStep(step: Omit<ActionStep, 'id'>): this {
    const id = `step_${(this.plan.steps?.length || 0) + 1}`;
    this.plan.steps!.push({ id, ...step });
    return this;
  }

  /**
   * Set execution context
   */
  withContext(context: ToolExecutionContext): this {
    this.plan.context = context;
    return this;
  }

  /**
   * Set execution mode
   */
  withMode(mode: ExecutionMode): this {
    this.plan.mode = mode;
    return this;
  }

  /**
   * Enable/disable continue on error
   */
  continueOnError(enabled: boolean = true): this {
    this.plan.continueOnError = enabled;
    return this;
  }

  /**
   * Enable/disable rollback on failure
   */
  enableRollback(enabled: boolean = true): this {
    this.plan.enableRollback = enabled;
    return this;
  }

  /**
   * Set timeout
   */
  withTimeout(timeoutMs: number): this {
    this.plan.timeout = timeoutMs;
    return this;
  }

  /**
   * Set metadata
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.plan.metadata = metadata;
    return this;
  }

  /**
   * Build the execution plan
   */
  build(): ExecutionPlan {
    if (!this.plan.context) {
      this.plan.context = {};
    }

    return this.plan as ExecutionPlan;
  }

  /**
   * Build and execute
   */
  async execute(): Promise<PipelineResult> {
    const plan = this.build();
    const pipeline = new ActionPipeline();
    return pipeline.execute(plan);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a new pipeline builder
 */
export function createPipeline(name: string, nameAr: string): PipelineBuilder {
  return new PipelineBuilder(name, nameAr);
}

/**
 * Execute a simple sequential pipeline
 */
export async function executeSequential(
  steps: Array<{ toolId: string; input: unknown }>,
  context: ToolExecutionContext = {}
): Promise<PipelineResult> {
  const builder = createPipeline('Sequential Pipeline', 'خط أوامر تسلسلي');

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    builder.addStep({
      toolId: step.toolId,
      input: step.input,
      dependsOn: i > 0 ? [`step_${i}`] : undefined
    });
  }

  return builder.withContext(context).withMode('sequential').execute();
}

/**
 * Execute a simple parallel pipeline
 */
export async function executeParallel(
  steps: Array<{ toolId: string; input: unknown }>,
  context: ToolExecutionContext = {}
): Promise<PipelineResult> {
  const builder = createPipeline('Parallel Pipeline', 'خط أوامر متوازي');

  for (const step of steps) {
    builder.addStep({
      toolId: step.toolId,
      input: step.input
    });
  }

  return builder.withContext(context).withMode('parallel').execute();
}
