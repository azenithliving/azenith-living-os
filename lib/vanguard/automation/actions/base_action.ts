/**
 * VANGUARD Phase 5: Smart Automation - Base Action Interface
 * 
 * Defines base interface and types for all workflow actions
 */

import { EventBus } from '../event_bus';

// Action execution context
export interface ActionContext {
  workflowId: string;
  executionId: string;
  stepId: string;
  variables: Record<string, any>;
  userId?: string;
  organizationId?: string;
  timestamp: Date;
}

// Action execution result
export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// Action configuration
export interface ActionConfig {
  type: string;
  params: Record<string, any>;
  retryable?: boolean;
  timeout?: number; // milliseconds
  requiredPermissions?: string[];
}

// Base action interface
export interface IAction {
  execute(context: ActionContext, config: ActionConfig): Promise<ActionResult>;
  validate(config: ActionConfig): { valid: boolean; error?: string };
  rollback?(context: ActionContext, config: ActionConfig): Promise<void>;
}

// Action registry for dynamic action loading
export class ActionRegistry {
  private static actions: Map<string, IAction> = new Map();

  static register(type: string, action: IAction): void {
    this.actions.set(type, action);
  }

  static get(type: string): IAction | undefined {
    return this.actions.get(type);
  }

  static getAll(): string[] {
    return Array.from(this.actions.keys());
  }

  static has(type: string): boolean {
    return this.actions.has(type);
  }
}

// Base action class with common functionality
export abstract class BaseAction implements IAction {
  protected eventBus: EventBus;

  constructor() {
    this.eventBus = EventBus.getInstance();
  }

  abstract execute(context: ActionContext, config: ActionConfig): Promise<ActionResult>;
  
  abstract validate(config: ActionConfig): { valid: boolean; error?: string };

  protected async publishEvent(eventType: string, data: any, context: ActionContext): Promise<void> {
    await this.eventBus.publish(
      eventType as any,
      data,
      {
        metadata: {
          workflowId: context.workflowId,
          executionId: context.executionId,
          stepId: context.stepId,
        },
      }
    );
  }

  protected validateRequired(config: ActionConfig, requiredFields: string[]): { valid: boolean; error?: string } {
    for (const field of requiredFields) {
      if (!(field in config.params)) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }
    return { valid: true };
  }

  protected resolveTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] !== undefined ? String(variables[key]) : match;
    });
  }
}
