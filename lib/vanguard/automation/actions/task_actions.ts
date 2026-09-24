/**
 * VANGUARD Phase 5: Smart Automation - Task Management Actions
 * 
 * Actions for creating and managing tasks
 */

import { BaseAction, ActionContext, ActionConfig, ActionResult, ActionRegistry } from './base_action';
import { createClient } from '@/utils/supabase/client';

// Create Task Action
export class CreateTaskAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { 
        title, 
        description, 
        assignedTo, 
        dueDate, 
        priority, 
        relatedLeadId,
        metadata 
      } = config.params;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_tasks')
        .insert({
          title: this.resolveTemplate(title, context.variables),
          description: description ? this.resolveTemplate(description, context.variables) : null,
          assigned_to: assignedTo ? (context.variables[assignedTo] || assignedTo) : null,
          due_date: dueDate ? new Date(this.resolveTemplate(dueDate, context.variables)).toISOString() : null,
          priority: priority || 'medium',
          status: 'pending',
          related_lead_id: relatedLeadId ? (context.variables[relatedLeadId] || relatedLeadId) : null,
          metadata: {
            ...metadata,
            createdByWorkflow: context.workflowId,
          },
        })
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('task.created', {
        taskId: data.id,
        assignedTo: data.assigned_to,
      }, context);

      return {
        success: true,
        data: { taskId: data.id, task: data },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create task',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['title']);
  }
}

// Update Task Action
export class UpdateTaskAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { taskId, updates } = config.params;
      
      const resolvedTaskId = context.variables[taskId] || taskId;
      const resolvedUpdates: Record<string, any> = {};

      for (const [key, value] of Object.entries(updates)) {
        resolvedUpdates[key] = typeof value === 'string' 
          ? this.resolveTemplate(value, context.variables)
          : value;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_tasks')
        .update(resolvedUpdates)
        .eq('id', resolvedTaskId)
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('task.updated', {
        taskId: data.id,
        changes: Object.keys(resolvedUpdates),
      }, context);

      return {
        success: true,
        data: { taskId: data.id, task: data },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update task',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['taskId', 'updates']);
  }
}

// Complete Task Action
export class CompleteTaskAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { taskId, notes } = config.params;
      
      const resolvedTaskId = context.variables[taskId] || taskId;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_notes: notes ? this.resolveTemplate(notes, context.variables) : null,
        })
        .eq('id', resolvedTaskId)
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('task.completed', {
        taskId: data.id,
      }, context);

      return {
        success: true,
        data: { taskId: data.id, task: data },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to complete task',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['taskId']);
  }
}

// Assign Task Action
export class AssignTaskAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { taskId, assignedTo } = config.params;
      
      const resolvedTaskId = context.variables[taskId] || taskId;
      const resolvedAssignedTo = context.variables[assignedTo] || assignedTo;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_tasks')
        .update({
          assigned_to: resolvedAssignedTo,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', resolvedTaskId)
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('task.assigned', {
        taskId: data.id,
        assignedTo: resolvedAssignedTo,
      }, context);

      return {
        success: true,
        data: { taskId: data.id, assignedTo: resolvedAssignedTo },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign task',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['taskId', 'assignedTo']);
  }
}

// Register task actions
ActionRegistry.register('create_task', new CreateTaskAction());
ActionRegistry.register('update_task', new UpdateTaskAction());
ActionRegistry.register('complete_task', new CompleteTaskAction());
ActionRegistry.register('assign_task', new AssignTaskAction());
