/**
 * VANGUARD Phase 5: Smart Automation - Notification Engine
 * 
 * محرك الإشعارات - إرسال إشعارات متعددة القنوات مع دعم القوالب والجدولة
 * Multi-channel notification engine with templates, batching, and scheduling
 */

import { EventBus } from '../event_bus';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

export type NotificationChannel = 
  | 'push'      // Push notification (WebSocket/FCM)
  | 'email'     // Email
  | 'sms'       // SMS
  | 'whatsapp'  // WhatsApp
  | 'in_app';   // In-app notification

export type NotificationPriority = 
  | 'low'       // منخفضة
  | 'normal'    // عادية
  | 'high'      // عالية
  | 'urgent';   // عاجلة

export type NotificationStatus =
  | 'pending'   // في الانتظار
  | 'scheduled' // مجدولة
  | 'sent'      // تم الإرسال
  | 'delivered' // تم التسليم
  | 'read'      // تم القراءة
  | 'failed'    // فشل
  | 'cancelled'; // ملغاة

export interface Notification {
  id: string;
  channel: NotificationChannel;
  recipient: string; // User ID, email, phone number
  priority: NotificationPriority;
  status: NotificationStatus;
  
  // Content
  title: string;
  body: string;
  data?: Record<string, any>;
  
  // Template
  templateId?: string;
  templateData?: Record<string, any>;
  
  // Scheduling
  scheduledFor?: Date;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  
  // Retry
  retryCount: number;
  maxRetries: number;
  
  // Metadata
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  nameAr: string;
  channel: NotificationChannel;
  
  // Template content
  titleTemplate: string;
  bodyTemplate: string;
  
  // Variables
  requiredVariables: string[];
  optionalVariables?: string[];
  
  // Localization
  locale?: string;
  translations?: Record<string, {
    title: string;
    body: string;
  }>;
  
  metadata?: Record<string, any>;
}

export interface NotificationBatch {
  id: string;
  name: string;
  channel: NotificationChannel;
  notifications: Notification[];
  
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  totalCount: number;
  sentCount: number;
  failedCount: number;
  
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface NotificationStats {
  total: number;
  byStatus: Record<NotificationStatus, number>;
  byChannel: Record<NotificationChannel, number>;
  byPriority: Record<NotificationPriority, number>;
  deliveryRate: number;
  readRate: number;
}

// ============================================================================
// Notification Engine
// ============================================================================

export class NotificationEngine {
  private static instance: NotificationEngine;
  private eventBus: EventBus;
  
  private notifications: Map<string, Notification> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private batches: Map<string, NotificationBatch> = new Map();
  
  private processingInterval: NodeJS.Timeout | null = null;
  private batchSize = 100;
  private processingIntervalMs = 5000;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    console.log('[NotificationEngine] Initialized');
    this.loadTemplates();
  }

  static getInstance(): NotificationEngine {
    if (!NotificationEngine.instance) {
      NotificationEngine.instance = new NotificationEngine();
    }
    return NotificationEngine.instance;
  }

  // ============================================================================
  // Template Management
  // ============================================================================

  /**
   * Register notification template
   */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    console.log(`[NotificationEngine] Registered template: ${template.id} (${template.nameAr})`);
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): NotificationTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Load default templates
   */
  private loadTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      // Lead notifications
      {
        id: 'lead_assigned',
        name: 'Lead Assigned',
        nameAr: 'تم تعيين عميل جديد',
        channel: 'in_app',
        titleTemplate: 'عميل جديد',
        bodyTemplate: 'تم تعيين العميل {{leadName}} لك. النقاط: {{score}}',
        requiredVariables: ['leadName', 'score'],
      },
      {
        id: 'lead_qualified',
        name: 'Lead Qualified',
        nameAr: 'عميل مؤهل',
        channel: 'in_app',
        titleTemplate: 'عميل مؤهل',
        bodyTemplate: 'العميل {{leadName}} أصبح مؤهلاً. اتخذ الإجراء!',
        requiredVariables: ['leadName'],
      },
      
      // Task notifications
      {
        id: 'task_assigned',
        name: 'Task Assigned',
        nameAr: 'مهمة جديدة',
        channel: 'in_app',
        titleTemplate: 'مهمة جديدة',
        bodyTemplate: '{{taskTitle}} - الموعد النهائي: {{dueDate}}',
        requiredVariables: ['taskTitle', 'dueDate'],
      },
      {
        id: 'task_due_soon',
        name: 'Task Due Soon',
        nameAr: 'مهمة قريبة من الموعد',
        channel: 'push',
        titleTemplate: 'تذكير بمهمة',
        bodyTemplate: 'المهمة {{taskTitle}} موعدها خلال {{hours}} ساعة',
        requiredVariables: ['taskTitle', 'hours'],
      },
      
      // Message notifications
      {
        id: 'new_message',
        name: 'New Message',
        nameAr: 'رسالة جديدة',
        channel: 'push',
        titleTemplate: 'رسالة جديدة من {{senderName}}',
        bodyTemplate: '{{messagePreview}}',
        requiredVariables: ['senderName', 'messagePreview'],
      },
      
      // System notifications
      {
        id: 'system_alert',
        name: 'System Alert',
        nameAr: 'تنبيه النظام',
        channel: 'in_app',
        titleTemplate: 'تنبيه',
        bodyTemplate: '{{message}}',
        requiredVariables: ['message'],
      },
    ];

    for (const template of defaultTemplates) {
      this.registerTemplate(template);
    }
  }

  // ============================================================================
  // Notification Creation
  // ============================================================================

  /**
   * Create and send notification
   */
  async send(params: {
    channel: NotificationChannel;
    recipient: string;
    title: string;
    body: string;
    priority?: NotificationPriority;
    data?: Record<string, any>;
    scheduledFor?: Date;
    metadata?: Record<string, any>;
  }): Promise<string> {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const notification: Notification = {
      id: notificationId,
      channel: params.channel,
      recipient: params.recipient,
      priority: params.priority || 'normal',
      status: params.scheduledFor ? 'scheduled' : 'pending',
      title: params.title,
      body: params.body,
      data: params.data,
      scheduledFor: params.scheduledFor,
      retryCount: 0,
      maxRetries: 3,
      metadata: params.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.notifications.set(notificationId, notification);

    // Persist to database
    await this.persistNotification(notification);

    // If not scheduled, send immediately
    if (!params.scheduledFor) {
      await this.processNotification(notificationId);
    }

    console.log(`[NotificationEngine] Created notification: ${notificationId}`);

    return notificationId;
  }

  /**
   * Send notification from template
   */
  async sendFromTemplate(params: {
    templateId: string;
    recipient: string;
    templateData: Record<string, any>;
    priority?: NotificationPriority;
    scheduledFor?: Date;
    locale?: string;
  }): Promise<string> {
    const template = this.templates.get(params.templateId);
    if (!template) {
      throw new Error(`Template not found: ${params.templateId}`);
    }

    // Validate required variables
    for (const variable of template.requiredVariables) {
      if (!(variable in params.templateData)) {
        throw new Error(`Missing required template variable: ${variable}`);
      }
    }

    // Render template
    const { title, body } = this.renderTemplate(template, params.templateData, params.locale);

    return await this.send({
      channel: template.channel,
      recipient: params.recipient,
      title,
      body,
      priority: params.priority,
      scheduledFor: params.scheduledFor,
      metadata: {
        templateId: params.templateId,
        templateData: params.templateData,
      },
    });
  }

  /**
   * Render template with data
   */
  private renderTemplate(
    template: NotificationTemplate,
    data: Record<string, any>,
    locale?: string
  ): { title: string; body: string } {
    // Get template content (with locale support)
    let titleTemplate = template.titleTemplate;
    let bodyTemplate = template.bodyTemplate;

    if (locale && template.translations?.[locale]) {
      titleTemplate = template.translations[locale].title;
      bodyTemplate = template.translations[locale].body;
    }

    // Replace variables
    const title = this.replaceVariables(titleTemplate, data);
    const body = this.replaceVariables(bodyTemplate, data);

    return { title, body };
  }

  /**
   * Replace template variables
   */
  private replaceVariables(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Create notification batch
   */
  async createBatch(params: {
    name: string;
    channel: NotificationChannel;
    recipients: string[];
    title: string;
    body: string;
    priority?: NotificationPriority;
    templateId?: string;
    templateData?: Record<string, any>;
  }): Promise<string> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const notifications: Notification[] = [];

    for (const recipient of params.recipients) {
      const notificationId = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      
      const notification: Notification = {
        id: notificationId,
        channel: params.channel,
        recipient,
        priority: params.priority || 'normal',
        status: 'pending',
        title: params.title,
        body: params.body,
        templateId: params.templateId,
        templateData: params.templateData,
        retryCount: 0,
        maxRetries: 3,
        metadata: { batchId },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      notifications.push(notification);
      this.notifications.set(notificationId, notification);
    }

    const batch: NotificationBatch = {
      id: batchId,
      name: params.name,
      channel: params.channel,
      notifications,
      status: 'pending',
      totalCount: notifications.length,
      sentCount: 0,
      failedCount: 0,
      createdAt: new Date(),
    };

    this.batches.set(batchId, batch);

    console.log(`[NotificationEngine] Created batch: ${batchId} (${notifications.length} notifications)`);

    // Process batch
    this.processBatch(batchId).catch(console.error);

    return batchId;
  }

  /**
   * Process notification batch
   */
  private async processBatch(batchId: string): Promise<void> {
    const batch = this.batches.get(batchId);
    if (!batch) return;

    batch.status = 'processing';
    batch.startedAt = new Date();

    console.log(`[NotificationEngine] Processing batch: ${batchId}`);

    // Process in chunks
    for (let i = 0; i < batch.notifications.length; i += this.batchSize) {
      const chunk = batch.notifications.slice(i, i + this.batchSize);
      
      await Promise.all(
        chunk.map(async (notification) => {
          try {
            await this.processNotification(notification.id);
            batch.sentCount++;
          } catch (error) {
            batch.failedCount++;
            console.error(`[NotificationEngine] Failed to send notification ${notification.id}:`, error);
          }
        })
      );

      // Small delay between chunks
      if (i + this.batchSize < batch.notifications.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    batch.status = 'completed';
    batch.completedAt = new Date();

    console.log(`[NotificationEngine] Batch completed: ${batchId} (${batch.sentCount} sent, ${batch.failedCount} failed)`);

    await this.eventBus.publish(
      'system:error' as any, // Using system event as fallback
      {
        message: 'notification.batch_completed',
        batchId,
        totalCount: batch.totalCount,
        sentCount: batch.sentCount,
        failedCount: batch.failedCount,
      }
    );
  }

  // ============================================================================
  // Processing
  // ============================================================================

  /**
   * Start processing scheduled notifications
   */
  startProcessing(): void {
    if (this.processingInterval) {
      console.warn('[NotificationEngine] Processing already started');
      return;
    }

    console.log('[NotificationEngine] Starting notification processing');

    this.processingInterval = setInterval(async () => {
      await this.processScheduledNotifications();
    }, this.processingIntervalMs);

    // Initial processing
    this.processScheduledNotifications().catch(console.error);
  }

  /**
   * Stop processing
   */
  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      console.log('[NotificationEngine] Stopped notification processing');
    }
  }

  /**
   * Process scheduled notifications
   */
  private async processScheduledNotifications(): Promise<void> {
    const now = new Date();
    const toProcess: string[] = [];

    for (const [id, notification] of this.notifications.entries()) {
      if (
        notification.status === 'scheduled' &&
        notification.scheduledFor &&
        notification.scheduledFor <= now
      ) {
        toProcess.push(id);
      }
    }

    if (toProcess.length > 0) {
      console.log(`[NotificationEngine] Processing ${toProcess.length} scheduled notifications`);
      
      for (const id of toProcess) {
        await this.processNotification(id);
      }
    }
  }

  /**
   * Process single notification
   */
  private async processNotification(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return;

    try {
      // Update status
      notification.status = 'sent';
      notification.sentAt = new Date();
      notification.updatedAt = new Date();

      // Send based on channel
      await this.sendViaChannel(notification);

      // Publish event
      await this.eventBus.publish(
        'system:error' as any, // Using system event as fallback
        {
          message: 'notification.sent',
          notificationId: notification.id,
          channel: notification.channel,
          recipient: notification.recipient,
          priority: notification.priority,
        }
      );

      // Persist
      await this.persistNotification(notification);

      console.log(`[NotificationEngine] Sent notification: ${notificationId} via ${notification.channel}`);
    } catch (error) {
      notification.retryCount++;
      
      if (notification.retryCount >= notification.maxRetries) {
        notification.status = 'failed';
        console.error(`[NotificationEngine] Notification failed after ${notification.retryCount} retries:`, error);
      } else {
        notification.status = 'pending';
        console.warn(`[NotificationEngine] Notification failed, will retry (${notification.retryCount}/${notification.maxRetries})`);
      }

      notification.updatedAt = new Date();
      await this.persistNotification(notification);
    }
  }

  /**
   * Send notification via specific channel
   */
  private async sendViaChannel(notification: Notification): Promise<void> {
    const supabase = createClient();

    switch (notification.channel) {
      case 'push':
      case 'in_app':
        // Publish event for WebSocket delivery
        await this.eventBus.publish(
          'system:error' as any, // Using system event as fallback
          {
            message: 'notification.push',
            userId: notification.recipient,
            title: notification.title,
            body: notification.body,
            priority: notification.priority,
            data: notification.data || {},
          }
        );
        break;

      case 'email':
        // Store in messages table for email channel
        await supabase.from('vanguard_messages').insert({
          channel: 'email',
          direction: 'outbound',
          content: notification.body,
          metadata: {
            to: notification.recipient,
            subject: notification.title,
            notificationId: notification.id,
          },
        });
        break;

      case 'sms':
      case 'whatsapp':
        // Store in messages table
        await supabase.from('vanguard_messages').insert({
          channel: notification.channel,
          direction: 'outbound',
          content: notification.body,
          metadata: {
            to: notification.recipient,
            notificationId: notification.id,
          },
        });
        break;
    }
  }

  // ============================================================================
  // Persistence
  // ============================================================================

  /**
   * Persist notification to database
   */
  private async persistNotification(notification: Notification): Promise<void> {
    const supabase = createClient();
    
    await supabase.from('vanguard_notifications').upsert({
      id: notification.id,
      channel: notification.channel,
      recipient: notification.recipient,
      priority: notification.priority,
      status: notification.status,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      template_id: notification.templateId,
      template_data: notification.templateData,
      scheduled_for: notification.scheduledFor?.toISOString(),
      sent_at: notification.sentAt?.toISOString(),
      delivered_at: notification.deliveredAt?.toISOString(),
      read_at: notification.readAt?.toISOString(),
      retry_count: notification.retryCount,
      max_retries: notification.maxRetries,
      metadata: notification.metadata,
      created_at: notification.createdAt.toISOString(),
      updated_at: notification.updatedAt.toISOString(),
    });
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    const notifications = Array.from(this.notifications.values());

    const byStatus: Record<NotificationStatus, number> = {
      pending: 0,
      scheduled: 0,
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      cancelled: 0,
    };

    const byChannel: Record<NotificationChannel, number> = {
      push: 0,
      email: 0,
      sms: 0,
      whatsapp: 0,
      in_app: 0,
    };

    const byPriority: Record<NotificationPriority, number> = {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0,
    };

    for (const notification of notifications) {
      byStatus[notification.status]++;
      byChannel[notification.channel]++;
      byPriority[notification.priority]++;
    }

    const sentCount = byStatus.sent + byStatus.delivered + byStatus.read;
    const deliveredCount = byStatus.delivered + byStatus.read;
    const readCount = byStatus.read;

    return {
      total: notifications.length,
      byStatus,
      byChannel,
      byPriority,
      deliveryRate: sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0,
      readRate: deliveredCount > 0 ? (readCount / deliveredCount) * 100 : 0,
    };
  }

  /**
   * Mark notification as delivered
   */
  async markAsDelivered(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return;

    notification.status = 'delivered';
    notification.deliveredAt = new Date();
    notification.updatedAt = new Date();

    await this.persistNotification(notification);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return;

    notification.status = 'read';
    notification.readAt = new Date();
    notification.updatedAt = new Date();

    await this.persistNotification(notification);
  }
}

// Export singleton instance
export const notificationEngine = NotificationEngine.getInstance();
