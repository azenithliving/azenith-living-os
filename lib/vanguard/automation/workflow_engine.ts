/**
 * VANGUARD Workflow Engine
 * 
 * محرك سير العمل - تنفيذ workflows معقدة بخطوات متعددة
 * Complex multi-step workflow execution with conditions, loops, and parallelism
 */

import { eventBus } from './event_bus';
import { createServiceRoleClient } from '@/lib/vanguard/memory/supabase_persistence';

// ============================================================================
// Types
// ============================================================================

export type WorkflowStepType =
  | 'action'      // Execute an action
  | 'condition'   // Conditional branching
  | 'loop'        // Repeat steps
  | 'parallel'    // Execute steps in parallel
  | 'wait'        // Wait for condition or duration
  | 'transform';  // Transform data

export type WorkflowStatus = 
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export interface WorkflowStep {
  id: string;
  name: string;
  nameAr: string;
  type: WorkflowStepType;
  
  // Action step
  action?: {
    type: string; // Action type from ActionRegistry
    params: Record<string, any>; // Action parameters
    retry?: {
      maxAttempts: number;
      delayMs: number;
    };
    rollback?: {
      action: string;
      config: Record<string, unknown>;
    };
  };
  
  // Condition step
  condition?: {
    expression: string; // JavaScript expression
    trueBranch?: string[]; // Step IDs to execute if true
    falseBranch?: string[]; // Step IDs to execute if false
  };
  
  // Loop step
  loop?: {
    iterator: string; // Variable name containing array
    steps: string[]; // Step IDs to repeat
    maxIterations?: number;
  };
  
  // Parallel step
  parallel?: {
    steps: string[]; // Step IDs to execute in parallel
    waitForAll?: boolean; // Wait for all or any
  };
  
  // Wait step
  wait?: {
    duration?: number; // Wait duration in ms
    condition?: string; // Wait until condition is true
    timeout?: number; // Timeout in ms
  };
  
  // Transform step
  transform?: {
    input: string; // Input variable
    output: string; // Output variable
    script: string; // Transformation script
  };
  
  // Dependencies
  dependsOn?: string[]; // Step IDs that must complete first
  
  // Error handling
  onError?: 'fail' | 'continue' | 'retry' | 'skip';
  continueOnError?: boolean;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  descriptionAr?: string;
  version: string;
  
  // Workflow configuration
  steps: WorkflowStep[];
  initialStep: string; // ID of first step
  
  // Variables
  variables?: Record<string, unknown>;
  
  // Input/Output schema
  input?: {
    schema: Record<string, unknown>;
    required?: string[];
  };
  output?: {
    schema: Record<string, unknown>;
  };
  
  // Workflow settings
  timeout?: number; // Overall workflow timeout in ms
  retryPolicy?: {
    maxAttempts: number;
    delayMs: number;
  };
  
  // Metadata
  tags?: string[];
  category?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowStatus;
  
  // Execution context
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  variables: Record<string, unknown>;
  
  // Execution tracking
  currentStep?: string;
  completedSteps: string[];
  failedSteps: string[];
  stepResults: Map<string, StepExecutionResult>;
  
  // Timing
  startedAt: string;
  completedAt?: string;
  pausedAt?: string;
  
  // Error handling
  error?: {
    code: string;
    message: string;
    step?: string;
  };
  
  // Metadata
  triggeredBy?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface StepExecutionResult {
  stepId: string;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  retryCount?: number;
}

// ============================================================================
// Workflow Engine
// ============================================================================

export class WorkflowEngine {
  private static instance: WorkflowEngine;
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private maxConcurrentExecutions = 100;

  private constructor() {
    console.log('[WorkflowEngine] Initialized');
  }

  static getInstance(): WorkflowEngine {
    if (!WorkflowEngine.instance) {
      WorkflowEngine.instance = new WorkflowEngine();
    }
    return WorkflowEngine.instance;
  }

  /**
   * Register a workflow
   */
  async registerWorkflow(definition: Omit<WorkflowDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const workflowId = `workflow_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const workflow: WorkflowDefinition = {
      ...definition,
      id: workflowId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Validate workflow
    this.validateWorkflow(workflow);

    this.workflows.set(workflowId, workflow);

    console.log(`[WorkflowEngine] Registered workflow: ${workflowId} (${workflow.nameAr})`);

    // Persist to database
    await this.persistWorkflow(workflow);

    return workflowId;
  }

  /**
   * Start a workflow execution
   */
  async startWorkflow(
    workflowId: string,
    input: Record<string, unknown>,
    options?: {
      sessionId?: string;
      userId?: string;
      triggeredBy?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check concurrent executions
    const runningExecutions = Array.from(this.executions.values())
      .filter(e => e.status === 'running').length;
    
    if (runningExecutions >= this.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions reached');
    }

    // Create execution
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      workflowVersion: workflow.version,
      status: 'running',
      input,
      variables: { ...workflow.variables },
      completedSteps: [],
      failedSteps: [],
      stepResults: new Map(),
      startedAt: new Date().toISOString(),
      sessionId: options?.sessionId,
      userId: options?.userId,
      triggeredBy: options?.triggeredBy,
      metadata: options?.metadata
    };

    this.executions.set(executionId, execution);

    console.log(`[WorkflowEngine] Started workflow: ${workflowId} (execution: ${executionId})`);

    // Publish event
    await eventBus.publish('workflow:started', {
      executionId,
      workflowId,
      workflowName: workflow.name
    }, {
      source: 'workflow_engine',
      sessionId: options?.sessionId,
      userId: options?.userId
    });

    // Start execution (async)
    this.executeWorkflow(executionId).catch(error => {
      console.error(`[WorkflowEngine] Execution error:`, error);
    });

    return executionId;
  }

  /**
   * Execute a workflow
   */
  private async executeWorkflow(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      return;
    }

    try {
      // Set timeout
      let timeoutId: NodeJS.Timeout | null = null;
      if (workflow.timeout) {
        timeoutId = setTimeout(() => {
          this.failExecution(executionId, {
            code: 'WORKFLOW_TIMEOUT',
            message: `Workflow timed out after ${workflow.timeout}ms`
          });
        }, workflow.timeout);
      }

      // Execute steps starting from initial step
      await this.executeStep(executionId, workflow.initialStep);

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Complete execution
      await this.completeExecution(executionId);
    } catch (error) {
      await this.failExecution(executionId, {
        code: 'WORKFLOW_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(executionId: string, stepId: string): Promise<StepExecutionResult> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      throw new Error(`Execution not found: ${executionId}`);
    }

    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${execution.workflowId}`);
    }

    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    const startTime = Date.now();
    
    console.log(`[WorkflowEngine] Executing step: ${stepId} (${step.nameAr})`);

    // Check dependencies
    if (step.dependsOn && step.dependsOn.length > 0) {
      const uncompletedDeps = step.dependsOn.filter(
        depId => !execution.completedSteps.includes(depId)
      );
      
      if (uncompletedDeps.length > 0) {
        // Wait for dependencies (simplified - in production, use proper async coordination)
        throw new Error(`Step ${stepId} has uncompleted dependencies: ${uncompletedDeps.join(', ')}`);
      }
    }

    // Update current step
    execution.currentStep = stepId;

    const result: StepExecutionResult = {
      stepId,
      status: 'running',
      startedAt: new Date().toISOString()
    };

    try {
      // Execute based on step type
      switch (step.type) {
        case 'action':
          result.output = await this.executeActionStep(execution, step);
          break;
        
        case 'condition':
          result.output = await this.executeConditionStep(execution, step);
          break;
        
        case 'loop':
          result.output = await this.executeLoopStep(execution, step);
          break;
        
        case 'parallel':
          result.output = await this.executeParallelStep(execution, step);
          break;
        
        case 'wait':
          result.output = await this.executeWaitStep(execution, step);
          break;
        
        case 'transform':
          result.output = await this.executeTransformStep(execution, step);
          break;
      }

      // Mark as completed
      result.status = 'completed';
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;
      
      execution.completedSteps.push(stepId);
      execution.stepResults.set(stepId, result);

      console.log(`[WorkflowEngine] Step completed: ${stepId} (${result.durationMs}ms)`);

      // Publish event
      await eventBus.publish('workflow:step_completed', {
        executionId,
        stepId,
        stepName: step.name
      }, {
        source: 'workflow_engine',
        sessionId: execution.sessionId
      });

      return result;
    } catch (error) {
      result.status = 'failed';
      result.error = {
        code: 'STEP_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
      result.completedAt = new Date().toISOString();
      result.durationMs = Date.now() - startTime;
      
      execution.failedSteps.push(stepId);
      execution.stepResults.set(stepId, result);

      // Handle error based on step configuration
      if (step.onError === 'continue' || step.continueOnError) {
        console.warn(`[WorkflowEngine] Step failed but continuing: ${stepId}`, error);
        return result;
      } else if (step.onError === 'skip') {
        result.status = 'skipped';
        return result;
      } else {
        throw error;
      }
    }
  }

  /**
   * Execute action step
   */
  private async executeActionStep(execution: WorkflowExecution, step: WorkflowStep): Promise<unknown> {
    if (!step.action) {
      throw new Error('Action configuration missing');
    }

    const { type, params, retry } = step.action;
    const maxAttempts = retry?.maxAttempts || 1;
    const delayMs = retry?.delayMs || 1000;

    // Import action executor
    const { executeAction } = await import('./actions');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Create action context
        const context = {
          workflowId: execution.workflowId,
          executionId: execution.id,
          stepId: step.id,
          variables: execution.variables,
          userId: execution.userId,
          organizationId: execution.metadata?.organizationId as string | undefined,
          timestamp: new Date(),
        };

        // Create action config
        const config = {
          type,
          params,
          retryable: retry ? true : false,
          timeout: step.action.retry?.delayMs,
        };

        // Execute action using action registry
        const result = await executeAction(type, context, config);
        
        // Update execution variables with result data if present
        if (result.data && typeof result.data === 'object') {
          execution.variables = {
            ...execution.variables,
            [`${step.id}_result`]: result.data,
          };
        }

        return result;
      } catch (error) {
        if (attempt < maxAttempts - 1) {
          console.log(`[WorkflowEngine] Action attempt ${attempt + 1} failed, retrying...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          throw error;
        }
      }
    }

    throw new Error('Action failed after all retries');
  }

  /**
   * Execute condition step
   */
  private async executeConditionStep(execution: WorkflowExecution, step: WorkflowStep): Promise<unknown> {
    if (!step.condition) {
      throw new Error('Condition configuration missing');
    }

    // Evaluate condition expression
    const conditionMet = this.evaluateExpression(step.condition.expression, execution.variables);

    // Execute appropriate branch
    const branchSteps = conditionMet ? step.condition.trueBranch : step.condition.falseBranch;
    
    if (branchSteps) {
      for (const branchStepId of branchSteps) {
        await this.executeStep(execution.id, branchStepId);
      }
    }

    return { conditionMet, branch: conditionMet ? 'true' : 'false' };
  }

  /**
   * Execute loop step
   */
  private async executeLoopStep(execution: WorkflowExecution, step: WorkflowStep): Promise<unknown> {
    if (!step.loop) {
      throw new Error('Loop configuration missing');
    }

    const iterator = execution.variables[step.loop.iterator];
    if (!Array.isArray(iterator)) {
      throw new Error(`Loop iterator "${step.loop.iterator}" is not an array`);
    }

    const maxIterations = step.loop.maxIterations || iterator.length;
    const results: unknown[] = [];

    for (let i = 0; i < Math.min(iterator.length, maxIterations); i++) {
      // Set loop variable
      execution.variables['_loop_index'] = i;
      execution.variables['_loop_item'] = iterator[i];

      // Execute loop steps
      for (const loopStepId of step.loop.steps) {
        await this.executeStep(execution.id, loopStepId);
      }

      results.push(iterator[i]);
    }

    return { iterations: results.length, results };
  }

  /**
   * Execute parallel step
   */
  private async executeParallelStep(execution: WorkflowExecution, step: WorkflowStep): Promise<unknown> {
    if (!step.parallel) {
      throw new Error('Parallel configuration missing');
    }

    // Execute all steps in parallel
    const promises = step.parallel.steps.map(parallelStepId =>
      this.executeStep(execution.id, parallelStepId)
    );

    if (step.parallel.waitForAll !== false) {
      // Wait for all
      const results = await Promise.all(promises);
      return { completed: results.length, results };
    } else {
      // Wait for any
      const result = await Promise.race(promises);
      return { completed: 1, result };
    }
  }

  /**
   * Execute wait step
   */
  private async executeWaitStep(execution: WorkflowExecution, step: WorkflowStep): Promise<unknown> {
    if (!step.wait) {
      throw new Error('Wait configuration missing');
    }

    if (step.wait.duration) {
      // Wait for duration
      await new Promise(resolve => setTimeout(resolve, step.wait!.duration));
      return { waited: step.wait.duration };
    } else if (step.wait.condition) {
      // Wait for condition
      const timeout = step.wait.timeout || 60000; // 1 minute default
      const startTime = Date.now();

      while (Date.now() - startTime < timeout) {
        if (this.evaluateExpression(step.wait.condition, execution.variables)) {
          return { conditionMet: true, waitedMs: Date.now() - startTime };
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
      }

      throw new Error('Wait condition timeout');
    }

    return { waited: 0 };
  }

  /**
   * Execute transform step
   */
  private async executeTransformStep(execution: WorkflowExecution, step: WorkflowStep): Promise<unknown> {
    if (!step.transform) {
      throw new Error('Transform configuration missing');
    }

    const inputValue = execution.variables[step.transform.input];
    
    // Execute transformation (simplified - use safe eval in production)
    const outputValue = eval(`(${step.transform.script})(${JSON.stringify(inputValue)})`);
    
    // Store result
    execution.variables[step.transform.output] = outputValue;

    return { transformed: true, output: outputValue };
  }

  /**
   * Evaluate expression
   */
  private evaluateExpression(expression: string, variables: Record<string, unknown>): boolean {
    try {
      // Create safe context with variables
      const context = { ...variables };
      
      // Evaluate expression (simplified - use vm.runInContext in production)
      const result = eval(`(function() { with(${JSON.stringify(context)}) { return ${expression}; } })()`);
      
      return Boolean(result);
    } catch (error) {
      console.error('[WorkflowEngine] Expression evaluation error:', error);
      return false;
    }
  }

  /**
   * Complete execution
   */
  private async completeExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();

    console.log(`[WorkflowEngine] Workflow completed: ${execution.workflowId} (${executionId})`);

    // Publish event
    await eventBus.publish('workflow:completed', {
      executionId,
      workflowId: execution.workflowId,
      durationMs: new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()
    }, {
      source: 'workflow_engine',
      sessionId: execution.sessionId
    });
  }

  /**
   * Fail execution
   */
  private async failExecution(executionId: string, error: { code: string; message: string }): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) {
      return;
    }

    execution.status = 'failed';
    execution.completedAt = new Date().toISOString();
    execution.error = error;

    console.error(`[WorkflowEngine] Workflow failed: ${execution.workflowId} (${executionId})`, error);

    // Publish event
    await eventBus.publish('workflow:failed', {
      executionId,
      workflowId: execution.workflowId,
      error
    }, {
      source: 'workflow_engine',
      sessionId: execution.sessionId
    });
  }

  /**
   * Pause execution
   */
  async pauseExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') {
      return false;
    }

    execution.status = 'paused';
    execution.pausedAt = new Date().toISOString();

    console.log(`[WorkflowEngine] Workflow paused: ${executionId}`);
    return true;
  }

  /**
   * Resume execution
   */
  async resumeExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'paused') {
      return false;
    }

    execution.status = 'running';
    execution.pausedAt = undefined;

    console.log(`[WorkflowEngine] Workflow resumed: ${executionId}`);

    // Continue execution
    if (execution.currentStep) {
      this.executeWorkflow(executionId).catch(error => {
        console.error('[WorkflowEngine] Resume error:', error);
      });
    }

    return true;
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId: string): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status === 'completed' || execution.status === 'cancelled') {
      return false;
    }

    execution.status = 'cancelled';
    execution.completedAt = new Date().toISOString();

    console.log(`[WorkflowEngine] Workflow cancelled: ${executionId}`);
    return true;
  }

  /**
   * Get workflow
   */
  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * Get execution
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all workflows
   */
  getWorkflows(options?: {
    category?: string;
    tags?: string[];
  }): WorkflowDefinition[] {
    let workflows = Array.from(this.workflows.values());

    if (options?.category) {
      workflows = workflows.filter(w => w.category === options.category);
    }

    if (options?.tags) {
      workflows = workflows.filter(w =>
        w.tags && options.tags!.some(tag => w.tags!.includes(tag))
      );
    }

    return workflows;
  }

  /**
   * Validate workflow definition
   */
  private validateWorkflow(workflow: WorkflowDefinition): void {
    if (!workflow.initialStep) {
      throw new Error('Workflow must have an initial step');
    }

    const stepIds = new Set(workflow.steps.map(s => s.id));
    
    if (!stepIds.has(workflow.initialStep)) {
      throw new Error(`Initial step "${workflow.initialStep}" not found in workflow steps`);
    }

    // Validate step dependencies
    for (const step of workflow.steps) {
      if (step.dependsOn) {
        for (const depId of step.dependsOn) {
          if (!stepIds.has(depId)) {
            throw new Error(`Step "${step.id}" depends on non-existent step "${depId}"`);
          }
        }
      }
    }
  }

  /**
   * Persist workflow to database
   */
  private async persistWorkflow(workflow: WorkflowDefinition): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from('vanguard_background_tasks').insert({
        task_type: 'workflow_definition',
        task_key: workflow.id,
        status: 'completed',
        payload: workflow,
        scheduled_for: new Date().toISOString()
      });
    } catch (error) {
      console.error('[WorkflowEngine] Failed to persist workflow:', error);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalWorkflows: number;
    totalExecutions: number;
    runningExecutions: number;
    completedExecutions: number;
    failedExecutions: number;
  } {
    const executions = Array.from(this.executions.values());
    
    return {
      totalWorkflows: this.workflows.size,
      totalExecutions: executions.length,
      runningExecutions: executions.filter(e => e.status === 'running').length,
      completedExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const workflowEngine = WorkflowEngine.getInstance();
