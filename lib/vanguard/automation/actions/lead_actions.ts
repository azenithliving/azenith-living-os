/**
 * VANGUARD Phase 5: Smart Automation - Lead Management Actions
 * 
 * Actions for lead lifecycle management (create, update, assign, score)
 */

import { BaseAction, ActionContext, ActionConfig, ActionResult, ActionRegistry } from './base_action';
import { createClient } from '@/utils/supabase/client';

// Create Lead Action
export class CreateLeadAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { name, email, phone, source, status, metadata } = config.params;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_leads')
        .insert({
          name: this.resolveTemplate(name, context.variables),
          email: email ? this.resolveTemplate(email, context.variables) : null,
          phone: phone ? this.resolveTemplate(phone, context.variables) : null,
          source: source || 'workflow',
          status: status || 'new',
          metadata: {
            ...metadata,
            createdByWorkflow: context.workflowId,
          },
        })
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('lead.created', {
        leadId: data.id,
        source: 'workflow',
      }, context);

      return {
        success: true,
        data: { leadId: data.id, lead: data },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create lead',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['name']);
  }
}

// Update Lead Action
export class UpdateLeadAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { leadId, updates } = config.params;
      
      const resolvedLeadId = context.variables[leadId] || leadId;
      const resolvedUpdates: Record<string, any> = {};

      for (const [key, value] of Object.entries(updates)) {
        resolvedUpdates[key] = typeof value === 'string' 
          ? this.resolveTemplate(value, context.variables)
          : value;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_leads')
        .update(resolvedUpdates)
        .eq('id', resolvedLeadId)
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('lead.updated', {
        leadId: data.id,
        changes: Object.keys(resolvedUpdates),
      }, context);

      return {
        success: true,
        data: { leadId: data.id, lead: data },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update lead',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['leadId', 'updates']);
  }
}

// Assign Lead Action
export class AssignLeadAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { leadId, agentId, reason } = config.params;
      
      const resolvedLeadId = context.variables[leadId] || leadId;
      const resolvedAgentId = context.variables[agentId] || agentId;

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_leads')
        .update({
          assigned_agent_id: resolvedAgentId,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', resolvedLeadId)
        .select()
        .single();

      if (error) throw error;

      // Log assignment
      await supabase.from('vanguard_lead_activities').insert({
        lead_id: resolvedLeadId,
        activity_type: 'assignment',
        description: reason || 'Assigned by workflow',
        metadata: {
          agentId: resolvedAgentId,
          workflowId: context.workflowId,
        },
      });

      await this.publishEvent('lead.assigned', {
        leadId: data.id,
        agentId: resolvedAgentId,
        reason,
      }, context);

      return {
        success: true,
        data: { leadId: data.id, agentId: resolvedAgentId },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to assign lead',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['leadId', 'agentId']);
  }
}

// Update Lead Score Action
export class UpdateLeadScoreAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { leadId, score, reason } = config.params;
      
      const resolvedLeadId = context.variables[leadId] || leadId;
      const newScore = typeof score === 'string' 
        ? parseFloat(this.resolveTemplate(score, context.variables))
        : score;

      const supabase = createClient();
      
      // Get current score
      const { data: currentLead } = await supabase
        .from('vanguard_leads')
        .select('score, metadata')
        .eq('id', resolvedLeadId)
        .single();

      const oldScore = currentLead?.score || 0;

      // Update score
      const { data, error } = await supabase
        .from('vanguard_leads')
        .update({
          score: newScore,
          metadata: {
            ...currentLead?.metadata,
            lastScoreUpdate: new Date().toISOString(),
            scoreHistory: [
              ...(currentLead?.metadata?.scoreHistory || []).slice(-9),
              { score: newScore, timestamp: new Date().toISOString(), reason },
            ],
          },
        })
        .eq('id', resolvedLeadId)
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('lead.score_updated', {
        leadId: data.id,
        oldScore,
        newScore,
        reason,
      }, context);

      return {
        success: true,
        data: { leadId: data.id, oldScore, newScore },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update lead score',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    const validation = this.validateRequired(config, ['leadId', 'score']);
    if (!validation.valid) return validation;

    const score = parseFloat(config.params.score);
    if (isNaN(score)) {
      return { valid: false, error: 'Score must be a number' };
    }

    return { valid: true };
  }
}

// Convert Lead Action
export class ConvertLeadAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { leadId, opportunityData } = config.params;
      
      const resolvedLeadId = context.variables[leadId] || leadId;

      const supabase = createClient();
      
      // Update lead status
      const { data: lead, error: leadError } = await supabase
        .from('vanguard_leads')
        .update({
          status: 'converted',
          converted_at: new Date().toISOString(),
        })
        .eq('id', resolvedLeadId)
        .select()
        .single();

      if (leadError) throw leadError;

      // Create opportunity if data provided
      let opportunityId = null;
      if (opportunityData) {
        const { data: opportunity, error: oppError } = await supabase
          .from('vanguard_opportunities')
          .insert({
            lead_id: resolvedLeadId,
            name: opportunityData.name || lead.name,
            value: opportunityData.value,
            stage: opportunityData.stage || 'qualification',
            probability: opportunityData.probability || 50,
            expected_close_date: opportunityData.expectedCloseDate,
          })
          .select()
          .single();

        if (oppError) throw oppError;
        opportunityId = opportunity.id;
      }

      await this.publishEvent('lead.converted', {
        leadId: lead.id,
        opportunityId,
      }, context);

      return {
        success: true,
        data: { leadId: lead.id, opportunityId },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to convert lead',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['leadId']);
  }
}

// Register lead actions
ActionRegistry.register('create_lead', new CreateLeadAction());
ActionRegistry.register('update_lead', new UpdateLeadAction());
ActionRegistry.register('assign_lead', new AssignLeadAction());
ActionRegistry.register('update_lead_score', new UpdateLeadScoreAction());
ActionRegistry.register('convert_lead', new ConvertLeadAction());
