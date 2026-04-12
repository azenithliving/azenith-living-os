import { Job } from 'bullmq';
import { EventBus } from '../events/event-bus';
import { Logger } from '../utils/logger';
import { prisma } from '../database/prisma-client';
import { 
  AITask, 
  TaskStatus, 
  TaskType,
  Notification,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  Approval,
  AIAction
} from '../types';
import nodemailer from 'nodemailer';

interface CommunicationConfig {
  email: {
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromAddress: string;
  };
  telegram: {
    enabled: boolean;
    botToken: string;
    defaultChatId: string;
  };
  dashboard: {
    enabled: boolean;
    maxMessages: number;
  };
}

interface NotificationRequest {
  taskId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipientId: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface DashboardMessage {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  data?: Record<string, unknown>;
}

const DEFAULT_CONFIG: CommunicationConfig = {
  email: {
    enabled: false,
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    fromAddress: process.env.FROM_EMAIL || 'aaca@company.com'
  },
  telegram: {
    enabled: false,
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    defaultChatId: process.env.TELEGRAM_CHAT_ID || ''
  },
  dashboard: {
    enabled: true,
    maxMessages: 1000
  }
};

export class CommunicationAgentService {
  private eventBus: EventBus;
  private logger: Logger;
  private config: CommunicationConfig;
  private emailTransporter?: nodemailer.Transporter;
  private dashboardMessages: DashboardMessage[] = [];

  constructor(eventBus: EventBus, config: Partial<CommunicationConfig> = {}) {
    this.eventBus = eventBus;
    this.logger = new Logger('CommunicationAgentService');
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.initializeEmail();
    this.setupEventHandlers();
  }

  async processJob(job: Job): Promise<unknown> {
    const { taskId, title, type, payload } = job.data;
    
    this.logger.info('Processing communication agent job', { jobId: job.id, taskId, type });

    try {
      await this.updateTaskStatus(taskId, TaskStatus.IN_PROGRESS);

      let result: unknown;

      switch (type) {
        case TaskType.NOTIFICATION:
          result = await this.sendNotification(payload as NotificationRequest);
          break;

        default:
          throw new Error(`Unknown task type: ${type}`);
      }

      await this.updateTaskStatus(taskId, TaskStatus.COMPLETED, result);

      await this.eventBus.publish({
        type: 'task:completed',
        source: 'communication-agent',
        payload: { taskId, result }
      });

      this.logger.info('Communication agent job completed', { jobId: job.id, taskId });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.logger.error('Communication agent job failed', { jobId: job.id, taskId, error: errorMessage });

      await this.updateTaskStatus(taskId, TaskStatus.FAILED, undefined, errorMessage);

      await this.eventBus.publish({
        type: 'task:failed',
        source: 'communication-agent',
        payload: { taskId, error: errorMessage }
      });

      throw error;
    }
  }

  async sendNotification(request: NotificationRequest): Promise<{
    success: boolean;
    channels: NotificationChannel[];
    errors: string[];
  }> {
    const { type, channel, recipientId, title, message, data } = request;

    this.logger.info('Sending notification', { type, channel, recipientId, title });

    const errors: string[] = [];
    const sentChannels: NotificationChannel[] = [];

    // Store in database
    const notification = await prisma.notification.create({
      data: {
        type,
        channel,
        status: NotificationStatus.PENDING,
        recipientId,
        title,
        message,
        data
      }
    });

    try {
      switch (channel) {
        case NotificationChannel.EMAIL:
          if (this.config.email.enabled && this.emailTransporter) {
            await this.sendEmail(recipientId, title, message, data);
            sentChannels.push(NotificationChannel.EMAIL);
          } else {
            errors.push('Email not configured');
          }
          break;

        case NotificationChannel.TELEGRAM:
          if (this.config.telegram.enabled) {
            await this.sendTelegram(title, message, data);
            sentChannels.push(NotificationChannel.TELEGRAM);
          } else {
            errors.push('Telegram not configured');
          }
          break;

        case NotificationChannel.DASHBOARD:
          await this.sendToDashboard(type, title, message, data);
          sentChannels.push(NotificationChannel.DASHBOARD);
          break;

        case NotificationChannel.SLACK:
          // Slack implementation would go here
          errors.push('Slack not yet implemented');
          break;

        case NotificationChannel.WEBHOOK:
          // Webhook implementation would go here
          errors.push('Webhook not yet implemented');
          break;
      }

      // Update notification status
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: sentChannels.length > 0 ? NotificationStatus.SENT : NotificationStatus.FAILED,
          sentAt: sentChannels.length > 0 ? new Date() : undefined,
          error: errors.length > 0 ? errors.join(', ') : undefined
        }
      });

      return {
        success: sentChannels.length > 0,
        channels: sentChannels,
        errors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          error: errorMessage
        }
      });

      return {
        success: false,
        channels: [],
        errors: [errorMessage]
      };
    }
  }

  async notifyApprovalRequired(approval: Approval, action: AIAction): Promise<void> {
    const title = `Approval Required: ${action.type}`;
    const message = `Action ${action.id} of type ${action.type} requires your approval. ` +
      `Requested at ${approval.requestedAt.toISOString()}. Expires at ${approval.expiresAt.toISOString()}`;

    // Send to all configured channels
    const channels: NotificationChannel[] = [];
    
    if (this.config.email.enabled) {
      channels.push(NotificationChannel.EMAIL);
    }
    if (this.config.telegram.enabled) {
      channels.push(NotificationChannel.TELEGRAM);
    }
    channels.push(NotificationChannel.DASHBOARD);

    for (const channel of channels) {
      await this.sendNotification({
        taskId: 'approval-notification',
        type: NotificationType.APPROVAL_REQUIRED,
        channel,
        recipientId: 'admin',
        title,
        message,
        data: {
          approvalId: approval.id,
          actionId: action.id,
          actionType: action.type,
          expiresAt: approval.expiresAt.toISOString()
        }
      });
    }
  }

  async notifySecurityAlert(finding: { severity: string; message: string; file?: string }): Promise<void> {
    const title = `Security Alert: ${finding.severity.toUpperCase()}`;
    const message = `${finding.message}${finding.file ? ` in ${finding.file}` : ''}`;

    await this.sendNotification({
      taskId: 'security-alert',
      type: NotificationType.SECURITY_ALERT,
      channel: NotificationChannel.DASHBOARD,
      recipientId: 'security-team',
      title,
      message,
      data: {
        severity: finding.severity,
        file: finding.file
      }
    });

    // Also send to email/telegram if configured
    if (finding.severity === 'critical') {
      if (this.config.email.enabled) {
        await this.sendNotification({
          taskId: 'security-alert-email',
          type: NotificationType.SECURITY_ALERT,
          channel: NotificationChannel.EMAIL,
          recipientId: 'security-team',
          title,
          message,
          data: finding
        });
      }
    }
  }

  async notifyTaskComplete(taskId: string, success: boolean, result?: unknown): Promise<void> {
    const title = success ? 'Task Completed Successfully' : 'Task Failed';
    const message = success 
      ? `Task ${taskId} has completed successfully.`
      : `Task ${taskId} has failed. Check dashboard for details.`;

    await this.sendNotification({
      taskId: 'task-completion',
      type: success ? NotificationType.SUCCESS : NotificationType.ERROR,
      channel: NotificationChannel.DASHBOARD,
      recipientId: 'admin',
      title,
      message,
      data: { taskId, success, result }
    });
  }

  async broadcast(message: {
    title: string;
    content: string;
    type: NotificationType;
    data?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    sentTo: NotificationChannel[];
  }> {
    const { title, content, type, data } = message;
    const sentTo: NotificationChannel[] = [];

    // Always send to dashboard
    await this.sendToDashboard(type, title, content, data);
    sentTo.push(NotificationChannel.DASHBOARD);

    // Send to other channels if enabled
    if (this.config.email.enabled) {
      try {
        await this.sendEmail('all', title, content, data);
        sentTo.push(NotificationChannel.EMAIL);
      } catch (error) {
        this.logger.error('Failed to send broadcast email', { error });
      }
    }

    if (this.config.telegram.enabled) {
      try {
        await this.sendTelegram(title, content, data);
        sentTo.push(NotificationChannel.TELEGRAM);
      } catch (error) {
        this.logger.error('Failed to send broadcast telegram', { error });
      }
    }

    return { success: sentTo.length > 0, sentTo };
  }

  getDashboardMessages(unreadOnly: boolean = false, limit: number = 50): DashboardMessage[] {
    let messages = this.dashboardMessages;
    
    if (unreadOnly) {
      messages = messages.filter(m => !m.read);
    }

    return messages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async markMessageRead(messageId: string): Promise<void> {
    const message = this.dashboardMessages.find(m => m.id === messageId);
    if (message) {
      message.read = true;
    }
  }

  async getUnreadCount(): Promise<number> {
    return this.dashboardMessages.filter(m => !m.read).length;
  }

  private async initializeEmail(): Promise<void> {
    if (this.config.email.enabled && this.config.email.smtpHost) {
      try {
        this.emailTransporter = nodemailer.createTransport({
          host: this.config.email.smtpHost,
          port: this.config.email.smtpPort,
          secure: this.config.email.smtpPort === 465,
          auth: {
            user: this.config.email.smtpUser,
            pass: this.config.email.smtpPass
          }
        });

        // Verify connection
        await this.emailTransporter?.verify();
        this.logger.info('Email transport initialized');
      } catch (error) {
        this.logger.error('Failed to initialize email transport', { error });
        this.config.email.enabled = false;
      }
    }
  }

  private setupEventHandlers(): void {
    // Subscribe to events that need notifications
    this.eventBus.subscribe('approval:required', {
      eventType: 'approval:required',
      handler: async (event) => {
        const { approvalId, actionId } = event.payload as Record<string, string>;
        
        const approval = await prisma.approval.findUnique({
          where: { id: approvalId },
          include: { action: true }
        });

        if (approval && approval.action) {
          await this.notifyApprovalRequired(approval as Approval, approval.action as AIAction);
        }
      }
    }).catch(err => {
      this.logger.error('Failed to subscribe to approval events', { error: err.message });
    });

    this.eventBus.subscribe('security:critical-findings', {
      eventType: 'security:critical-findings',
      handler: async (event) => {
        const { findings } = event.payload as { findings: Array<{ severity: string; message: string; file?: string }> };
        
        for (const finding of findings.slice(0, 5)) {
          await this.notifySecurityAlert(finding);
        }
      }
    }).catch(err => {
      this.logger.error('Failed to subscribe to security events', { error: err.message });
    });

    this.eventBus.subscribe('task:completed', {
      eventType: 'task:completed',
      handler: async (event) => {
        const { taskId, result } = event.payload as Record<string, unknown>;
        await this.notifyTaskComplete(taskId as string, true, result);
      }
    }).catch(err => {
      this.logger.error('Failed to subscribe to task completion events', { error: err.message });
    });

    this.eventBus.subscribe('task:failed', {
      eventType: 'task:failed',
      handler: async (event) => {
        const { taskId, error } = event.payload as Record<string, unknown>;
        await this.notifyTaskComplete(taskId as string, false, { error });
      }
    }).catch(err => {
      this.logger.error('Failed to subscribe to task failure events', { error: err.message });
    });
  }

  private async sendEmail(
    to: string, 
    subject: string, 
    body: string, 
    data?: Record<string, unknown>
  ): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transport not initialized');
    }

    const htmlBody = this.formatEmailBody(body, data);

    await this.emailTransporter.sendMail({
      from: this.config.email.fromAddress,
      to: to === 'all' ? this.config.email.smtpUser : to,
      subject,
      text: body,
      html: htmlBody
    });

    this.logger.info('Email sent', { to, subject });
  }

  private async sendTelegram(title: string, message: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.config.telegram.enabled) {
      throw new Error('Telegram not configured');
    }

    const text = `*${title}*\n\n${message}`;
    
    // Telegram bot API implementation would go here
    // For now, we log it
    this.logger.info('Telegram message prepared', { chatId: this.config.telegram.defaultChatId, text });
  }

  private async sendToDashboard(
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const dashboardMessage: DashboardMessage = {
      id: this.generateId(),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      data
    };

    this.dashboardMessages.unshift(dashboardMessage);

    // Limit message count
    if (this.dashboardMessages.length > this.config.dashboard.maxMessages) {
      this.dashboardMessages = this.dashboardMessages.slice(0, this.config.dashboard.maxMessages);
    }

    this.logger.info('Dashboard message added', { messageId: dashboardMessage.id, title });
  }

  private formatEmailBody(body: string, data?: Record<string, unknown>): string {
    let html = `<h2>Azenith Autonomous Company AI System</h2>`;
    html += `<p>${body.replace(/\n/g, '<br>')}</p>`;
    
    if (data && Object.keys(data).length > 0) {
      html += '<h3>Details:</h3><ul>';
      for (const [key, value] of Object.entries(data)) {
        html += `<li><strong>${key}:</strong> ${JSON.stringify(value)}</li>`;
      }
      html += '</ul>';
    }

    html += '<hr><p><small>This is an automated message from AACA.</small></p>';
    
    return html;
  }

  private async updateTaskStatus(
    taskId: string, 
    status: TaskStatus, 
    result?: unknown, 
    error?: string
  ): Promise<void> {
    const updateData: Record<string, unknown> = { status };

    if (result) {
      updateData.result = result;
    }

    if (error) {
      updateData.error = error;
      updateData.failedAt = new Date();
    }

    if (status === TaskStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    }

    if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    await prisma.aITask.update({
      where: { id: taskId },
      data: updateData
    });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  updateConfig(config: Partial<CommunicationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Communication config updated', this.config as unknown as Record<string, unknown>);
    
    // Re-initialize email if config changed
    if (config.email) {
      this.initializeEmail();
    }
  }
}

// Singleton instance
let communicationAgentInstance: CommunicationAgentService | null = null;

export function getCommunicationAgentService(
  eventBus: EventBus, 
  config?: Partial<CommunicationConfig>
): CommunicationAgentService {
  if (!communicationAgentInstance) {
    communicationAgentInstance = new CommunicationAgentService(eventBus, config);
  }
  return communicationAgentInstance;
}

export function resetCommunicationAgentService(): void {
  communicationAgentInstance = null;
}
