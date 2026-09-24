/**
 * VANGUARD Phase 5: Smart Automation - Routing Actions
 * 
 * Workflow actions for intelligent routing
 */

import { BaseAction, ActionContext, ActionConfig, ActionResult, ActionRegistry } from '../actions/base_action';
import { SmartRouter, RoutingRequest } from './smart_router';
import { createClient } from '@/lib/supabase/client';

// Route Lead Action
export class RouteLeadAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { leadId, priority, requiredSkills, preferredLanguage, autoAssign } = config.params;

      const resolvedLeadId = context.variables[leadId] || leadId;
      const router = SmartRouter.getInstance();

      // Create routing request
      const request: RoutingRequest = {
        type: 'lead',
        entityId: resolvedLeadId,
        priority: priority || 'medium',
        requiredSkills: requiredSkills || [],
        preferredLanguage: preferredLanguage || 'ar',
        metadata: {
          workflowId: context.workflowId,
        },
      };

      // Route to best agent
      const result = await router.route(request);

      if (!result.success) {
        return {
          success: false,
          error: result.reason || 'Routing failed',
        };
      }

      // Auto-assign if requested
      if (autoAssign !== false && result.agentId) {
        const supabase = createClient();
        await supabase
          .from('vanguard_leads')
          .update({
            assigned_agent_id: result.agentId,
            assigned_at: new Date().toISOString(),
          })
          .eq('id', resolvedLeadId);
      }

      await this.publishEvent('lead.routed', {
        leadId: resolvedLeadId,
        agentId: result.agentId,
        score: result.score,
      }, context);

      return {
        success: true,
        data: {
          leadId: resolvedLeadId,
          agentId: result.agentId,
          agentName: result.agent?.name,
          score: result.score,
          reason: result.reason,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to route lead',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['leadId']);
  }
}

// Route Conversation Action
export class RouteConversationAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { conversationId, priority, requiredSkills, autoAssign } = config.params;

      const resolvedConversationId = context.variables[conversationId] || conversationId;
      const router = SmartRouter.getInstance();

      const request: RoutingRequest = {
        type: 'conversation',
        entityId: resolvedConversationId,
        priority: priority || 'medium',
        requiredSkills: requiredSkills || [],
        metadata: {
          workflowId: context.workflowId,
        },
      };

      const result = await router.route(request);

      if (!result.success) {
        return {
          success: false,
          error: result.reason || 'Routing failed',
        };
      }

      // Auto-assign if requested
      if (autoAssign !== false && result.agentId) {
        const supabase = createClient();
        await supabase
          .from('vanguard_conversations')
          .update({
            assigned_agent_id: result.agentId,
            status: 'active',
          })
          .eq('id', resolvedConversationId);
      }

      await this.publishEvent('conversation.routed', {
        conversationId: resolvedConversationId,
        agentId: result.agentId,
        score: result.score,
      }, context);

      return {
        success: true,
        data: {
          conversationId: resolvedConversationId,
          agentId: result.agentId,
          agentName: result.agent?.name,
          score: result.score,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to route conversation',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['conversationId']);
  }
}

// Find Best Agent Action
export class FindBestAgentAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { priority, requiredSkills, preferredLanguage, minCapacity } = config.params;

      const router = SmartRouter.getInstance();
      
      // Get available agents matching criteria
      const agents = router.getAvailableAgents({
        skills: requiredSkills || [],
        languages: preferredLanguage ? [preferredLanguage] : undefined,
        minCapacity: minCapacity || 1,
      });

      if (agents.length === 0) {
        return {
          success: false,
          error: 'No available agents matching criteria',
        };
      }

      // Sort by utilization (least busy first)
      agents.sort((a, b) => a.capacity.utilizationRate - b.capacity.utilizationRate);
      
      const bestAgent = agents[0];

      return {
        success: true,
        data: {
          agentId: bestAgent.id,
          agentName: bestAgent.name,
          agentEmail: bestAgent.email,
          availability: bestAgent.availability,
          utilizationRate: bestAgent.capacity.utilizationRate,
          skills: bestAgent.skills,
          alternativeAgents: agents.slice(1, 4).map(a => ({
            agentId: a.id,
            name: a.name,
            utilizationRate: a.capacity.utilizationRate,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to find best agent',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return { valid: true };
  }
}

// Rebalance Workload Action
export class RebalanceWorkloadAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const router = SmartRouter.getInstance();
      
      await router.rebalanceWorkload();

      const stats = router.getRoutingStats();

      return {
        success: true,
        data: {
          totalAgents: stats.totalAgents,
          availableAgents: stats.availableAgents,
          avgUtilization: stats.avgUtilization,
          rebalanced: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to rebalance workload',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return { valid: true };
  }
}

// Get Routing Stats Action
export class GetRoutingStatsAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const router = SmartRouter.getInstance();
      const stats = router.getRoutingStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get routing stats',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return { valid: true };
  }
}

// Register routing actions
ActionRegistry.register('route_lead', new RouteLeadAction());
ActionRegistry.register('route_conversation', new RouteConversationAction());
ActionRegistry.register('find_best_agent', new FindBestAgentAction());
ActionRegistry.register('rebalance_workload', new RebalanceWorkloadAction());
ActionRegistry.register('get_routing_stats', new GetRoutingStatsAction());
