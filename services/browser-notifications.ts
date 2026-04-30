// Service: Browser Notifications
// إشعارات المتصفح - مجاني عبر Web Notifications API

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  requireInteraction?: boolean;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  data?: Record<string, any>;
}

export class BrowserNotificationService {
  // إنشاء إشعار
  createPayload(
    title: string,
    body: string,
    options?: Partial<NotificationPayload>
  ): NotificationPayload {
    return {
      title,
      body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      requireInteraction: false,
      ...options
    };
  }
  
  // قوالب جاهزة
  taskAssigned(agentName: string, taskTitle: string): NotificationPayload {
    return this.createPayload(
      `مهمة جديدة لـ ${agentName}`,
      taskTitle,
      { tag: 'task-assigned', requireInteraction: true }
    );
  }
  
  agentStuck(agentName: string, reason: string): NotificationPayload {
    return this.createPayload(
      `${agentName} محتاج مساعدة`,
      reason,
      { 
        tag: 'agent-stuck',
        requireInteraction: true,
        actions: [
          { action: 'assist', title: 'ساعد' },
          { action: 'ignore', title: 'تجاهل' }
        ]
      }
    );
  }
  
  orderMilestone(orderNumber: string, milestone: string): NotificationPayload {
    return this.createPayload(
      `تحديث طلب #${orderNumber}`,
      milestone,
      { tag: `order-${orderNumber}` }
    );
  }
  
  dailyDigest(summary: string): NotificationPayload {
    return this.createPayload(
      'التقرير اليومي - Azenith Living',
      summary,
      { tag: 'daily-digest' }
    );
  }
  
  approvalRequired(title: string, amount?: number): NotificationPayload {
    const body = amount 
      ? `${title} - المبلغ: ${amount.toLocaleString()} EGP`
      : title;
    
    return this.createPayload(
      'محتاج موافقتك',
      body,
      { 
        tag: 'approval-required',
        requireInteraction: true,
        actions: [
          { action: 'approve', title: 'وافق' },
          { action: 'reject', title: 'رفض' }
        ]
      }
    );
  }
}

export const browserNotifications = new BrowserNotificationService();
