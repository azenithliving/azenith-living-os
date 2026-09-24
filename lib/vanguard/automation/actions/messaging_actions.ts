/**
 * VANGUARD Phase 5: Smart Automation - Messaging Actions
 * 
 * Actions for sending messages across channels (WhatsApp, Email, WebSocket)
 */

import { BaseAction, ActionContext, ActionConfig, ActionResult, ActionRegistry } from './base_action';
import { createClient } from '@/utils/supabase/client';

// Send WhatsApp Message Action
export class SendWhatsAppMessageAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { to, message, template, templateParams } = config.params;
      
      const resolvedTo = this.resolveTemplate(to, context.variables);
      const resolvedMessage = template 
        ? this.resolveTemplate(template, { ...context.variables, ...templateParams })
        : this.resolveTemplate(message, context.variables);

      // Store message in database (will be picked up by WhatsApp channel)
      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_messages')
        .insert({
          conversation_id: context.variables.conversationId || null,
          channel: 'whatsapp',
          direction: 'outbound',
          content: resolvedMessage,
          metadata: {
            to: resolvedTo,
            workflowId: context.workflowId,
            automated: true,
          },
        })
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('message.sent', {
        messageId: data.id,
        channel: 'whatsapp',
        to: resolvedTo,
      }, context);

      return {
        success: true,
        data: { messageId: data.id, to: resolvedTo },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send WhatsApp message',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    if (!config.params.to) {
      return { valid: false, error: 'Missing required field: to' };
    }
    if (!config.params.message && !config.params.template) {
      return { valid: false, error: 'Either message or template is required' };
    }
    return { valid: true };
  }
}

// Send Email Action
export class SendEmailAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { to, subject, body, cc, bcc, template, templateParams } = config.params;

      const resolvedTo = this.resolveTemplate(to, context.variables);
      const resolvedSubject = this.resolveTemplate(subject, context.variables);
      const resolvedBody = template
        ? this.resolveTemplate(template, { ...context.variables, ...templateParams })
        : this.resolveTemplate(body, context.variables);

      const supabase = createClient();
      const { data, error } = await supabase
        .from('vanguard_messages')
        .insert({
          conversation_id: context.variables.conversationId || null,
          channel: 'email',
          direction: 'outbound',
          content: resolvedBody,
          metadata: {
            to: resolvedTo,
            subject: resolvedSubject,
            cc: cc ? this.resolveTemplate(cc, context.variables) : undefined,
            bcc: bcc ? this.resolveTemplate(bcc, context.variables) : undefined,
            workflowId: context.workflowId,
            automated: true,
          },
        })
        .select()
        .single();

      if (error) throw error;

      await this.publishEvent('message.sent', {
        messageId: data.id,
        channel: 'email',
        to: resolvedTo,
        subject: resolvedSubject,
      }, context);

      return {
        success: true,
        data: { messageId: data.id, to: resolvedTo },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    const required = ['to', 'subject'];
    const validation = this.validateRequired(config, required);
    if (!validation.valid) return validation;

    if (!config.params.body && !config.params.template) {
      return { valid: false, error: 'Either body or template is required' };
    }
    return { valid: true };
  }
}

// Send Push Notification Action (via WebSocket)
export class SendPushNotificationAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { userId, title, message, priority, data } = config.params;

      const resolvedTitle = this.resolveTemplate(title, context.variables);
      const resolvedMessage = this.resolveTemplate(message, context.variables);

      await this.publishEvent('notification.push', {
        userId: userId || context.userId,
        title: resolvedTitle,
        message: resolvedMessage,
        priority: priority || 'medium',
        data: data || {},
        workflowId: context.workflowId,
      }, context);

      return {
        success: true,
        data: { userId, title: resolvedTitle },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['title', 'message']);
  }
}

// Register messaging actions
ActionRegistry.register('send_whatsapp', new SendWhatsAppMessageAction());
ActionRegistry.register('send_email', new SendEmailAction());
ActionRegistry.register('send_notification', new SendPushNotificationAction());
