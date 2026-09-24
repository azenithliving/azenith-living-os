/**
 * VANGUARD Phase 5: Smart Automation - Notification Actions
 * 
 * Workflow actions for sending notifications
 */

import { BaseAction, ActionContext, ActionConfig, ActionResult, ActionRegistry } from '../actions/base_action';
import { NotificationEngine, NotificationChannel, NotificationPriority } from './notification_engine';

// Send Notification Action
export class SendNotificationAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { channel, recipient, title, body, priority, data, scheduledFor } = config.params;

      const resolvedRecipient = this.resolveTemplate(recipient, context.variables);
      const resolvedTitle = this.resolveTemplate(title, context.variables);
      const resolvedBody = this.resolveTemplate(body, context.variables);

      const engine = NotificationEngine.getInstance();
      
      const notificationId = await engine.send({
        channel: channel as NotificationChannel,
        recipient: resolvedRecipient,
        title: resolvedTitle,
        body: resolvedBody,
        priority: (priority as NotificationPriority) || 'normal',
        data: data || {},
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        metadata: {
          workflowId: context.workflowId,
          executionId: context.executionId,
        },
      });

      await this.publishEvent('notification.created', {
        notificationId,
        channel,
        recipient: resolvedRecipient,
      }, context);

      return {
        success: true,
        data: {
          notificationId,
          recipient: resolvedRecipient,
          channel,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send notification',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    const validation = this.validateRequired(config, ['channel', 'recipient', 'title', 'body']);
    if (!validation.valid) return validation;

    const validChannels = ['push', 'email', 'sms', 'whatsapp', 'in_app'];
    if (!validChannels.includes(config.params.channel)) {
      return { valid: false, error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` };
    }

    return { valid: true };
  }
}

// Send Template Notification Action
export class SendTemplateNotificationAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { templateId, recipient, templateData, priority, scheduledFor, locale } = config.params;

      const resolvedRecipient = this.resolveTemplate(recipient, context.variables);
      
      // Resolve template data variables
      const resolvedTemplateData: Record<string, any> = {};
      for (const [key, value] of Object.entries(templateData || {})) {
        resolvedTemplateData[key] = typeof value === 'string'
          ? this.resolveTemplate(value, context.variables)
          : value;
      }

      const engine = NotificationEngine.getInstance();
      
      const notificationId = await engine.sendFromTemplate({
        templateId,
        recipient: resolvedRecipient,
        templateData: resolvedTemplateData,
        priority: (priority as NotificationPriority) || 'normal',
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        locale: locale || 'ar',
      });

      await this.publishEvent('notification.created', {
        notificationId,
        templateId,
        recipient: resolvedRecipient,
      }, context);

      return {
        success: true,
        data: {
          notificationId,
          recipient: resolvedRecipient,
          templateId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send template notification',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return this.validateRequired(config, ['templateId', 'recipient', 'templateData']);
  }
}

// Send Batch Notification Action
export class SendBatchNotificationAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const { name, channel, recipients, title, body, priority, templateId, templateData } = config.params;

      // Resolve recipients
      const resolvedRecipients: string[] = [];
      for (const recipient of recipients || []) {
        const resolved = typeof recipient === 'string'
          ? this.resolveTemplate(recipient, context.variables)
          : recipient;
        resolvedRecipients.push(resolved);
      }

      const resolvedTitle = this.resolveTemplate(title, context.variables);
      const resolvedBody = this.resolveTemplate(body, context.variables);

      const engine = NotificationEngine.getInstance();
      
      const batchId = await engine.createBatch({
        name: name || 'Workflow Batch',
        channel: channel as NotificationChannel,
        recipients: resolvedRecipients,
        title: resolvedTitle,
        body: resolvedBody,
        priority: (priority as NotificationPriority) || 'normal',
        templateId,
        templateData,
      });

      await this.publishEvent('notification.batch_created', {
        batchId,
        recipientCount: resolvedRecipients.length,
        channel,
      }, context);

      return {
        success: true,
        data: {
          batchId,
          recipientCount: resolvedRecipients.length,
          channel,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create batch notification',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    const validation = this.validateRequired(config, ['channel', 'recipients', 'title', 'body']);
    if (!validation.valid) return validation;

    if (!Array.isArray(config.params.recipients)) {
      return { valid: false, error: 'recipients must be an array' };
    }

    if (config.params.recipients.length === 0) {
      return { valid: false, error: 'recipients array cannot be empty' };
    }

    return { valid: true };
  }
}

// Get Notification Stats Action
export class GetNotificationStatsAction extends BaseAction {
  async execute(context: ActionContext, config: ActionConfig): Promise<ActionResult> {
    try {
      const engine = NotificationEngine.getInstance();
      const stats = engine.getStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get notification stats',
      };
    }
  }

  validate(config: ActionConfig): { valid: boolean; error?: string } {
    return { valid: true };
  }
}

// Register notification actions
ActionRegistry.register('send_notification', new SendNotificationAction());
ActionRegistry.register('send_template_notification', new SendTemplateNotificationAction());
ActionRegistry.register('send_batch_notification', new SendBatchNotificationAction());
ActionRegistry.register('get_notification_stats', new GetNotificationStatsAction());
