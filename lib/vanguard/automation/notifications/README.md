# VANGUARD Notification Engine

محرك الإشعارات - نظام شامل لإرسال إشعارات متعددة القنوات مع دعم القوالب والجدولة

## Overview

Notification Engine يوفر:

- **Multi-Channel Support**: Push, Email, SMS, WhatsApp, In-App
- **Template System**: قوالب قابلة لإعادة الاستخدام مع متغيرات
- **Batch Processing**: إرسال جماعي للإشعارات
- **Scheduling**: جدولة الإشعارات لأوقات محددة
- **Priority System**: أولويات متعددة (low, normal, high, urgent)
- **Retry Logic**: إعادة محاولة الإرسال عند الفشل
- **Delivery Tracking**: تتبع حالة الإشعار (sent, delivered, read)
- **Analytics**: إحصائيات شاملة عن الإشعارات

## Quick Start

### 1. Initialize and Start Processing

```typescript
import { notificationEngine } from '@/lib/vanguard/automation/notifications';

// Start processing scheduled notifications
notificationEngine.startProcessing();
```

### 2. Send Simple Notification

```typescript
const notificationId = await notificationEngine.send({
  channel: 'push',
  recipient: 'user_123',
  title: 'رسالة جديدة',
  body: 'لديك رسالة جديدة من أحمد',
  priority: 'high',
  data: {
    messageId: 'msg_456',
    conversationId: 'conv_789',
  },
});

console.log('Notification created:', notificationId);
```

## Notification Channels

### Push Notifications (إشعارات فورية)

```typescript
await notificationEngine.send({
  channel: 'push',
  recipient: 'user_123',
  title: 'تنبيه مهم',
  body: 'لديك مهمة عاجلة تنتظرك',
  priority: 'urgent',
  data: {
    taskId: 'task_456',
    dueDate: '2026-09-25',
  },
});
```

### Email Notifications (بريد إلكتروني)

```typescript
await notificationEngine.send({
  channel: 'email',
  recipient: 'user@example.com',
  title: 'تقرير شهري',
  body: 'تقريرك الشهري جاهز للمراجعة...',
  priority: 'normal',
});
```

### SMS Notifications

```typescript
await notificationEngine.send({
  channel: 'sms',
  recipient: '+201234567890',
  title: 'كود التحقق',
  body: 'كود التحقق الخاص بك: 123456',
  priority: 'high',
});
```

### WhatsApp Notifications

```typescript
await notificationEngine.send({
  channel: 'whatsapp',
  recipient: '+201234567890',
  title: 'تأكيد الموعد',
  body: 'موعدك القادم يوم الأحد الساعة 10 صباحاً',
  priority: 'normal',
});
```

### In-App Notifications (داخل التطبيق)

```typescript
await notificationEngine.send({
  channel: 'in_app',
  recipient: 'user_123',
  title: 'تحديث جديد',
  body: 'تم تحديث حالة طلبك إلى "قيد المعالجة"',
  priority: 'low',
});
```

## Template System

### Register Custom Template

```typescript
import { NotificationTemplate } from '@/lib/vanguard/automation/notifications';

const template: NotificationTemplate = {
  id: 'welcome_user',
  name: 'Welcome User',
  nameAr: 'ترحيب بمستخدم جديد',
  channel: 'email',
  titleTemplate: 'مرحباً بك يا {{userName}}!',
  bodyTemplate: 'نحن سعداء بانضمامك. رصيدك الأولي: {{credits}} نقاط',
  requiredVariables: ['userName', 'credits'],
  optionalVariables: ['referralCode'],
  translations: {
    en: {
      title: 'Welcome {{userName}}!',
      body: 'We are happy to have you. Your initial credits: {{credits}} points',
    },
  },
};

notificationEngine.registerTemplate(template);
```

### Send from Template

```typescript
const notificationId = await notificationEngine.sendFromTemplate({
  templateId: 'welcome_user',
  recipient: 'user_123',
  templateData: {
    userName: 'أحمد',
    credits: 100,
    referralCode: 'ABC123',
  },
  priority: 'normal',
  locale: 'ar', // or 'en'
});
```

### Built-in Templates

يأتي النظام مع قوالب جاهزة:

- `lead_assigned` - تعيين عميل جديد
- `lead_qualified` - عميل مؤهل
- `task_assigned` - مهمة جديدة
- `task_due_soon` - تذكير بمهمة قريبة
- `new_message` - رسالة جديدة
- `system_alert` - تنبيه النظام

```typescript
// Example: Lead assigned notification
await notificationEngine.sendFromTemplate({
  templateId: 'lead_assigned',
  recipient: 'agent_456',
  templateData: {
    leadName: 'محمد علي',
    score: 85,
  },
  priority: 'high',
});
```

## Scheduled Notifications

### Schedule for Specific Time

```typescript
const scheduledFor = new Date('2026-09-25T10:00:00');

await notificationEngine.send({
  channel: 'push',
  recipient: 'user_123',
  title: 'تذكير بالموعد',
  body: 'موعدك اليوم الساعة 11 صباحاً',
  priority: 'high',
  scheduledFor,
});
```

### Schedule Relative Time

```typescript
// Send notification in 1 hour
const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);

await notificationEngine.send({
  channel: 'in_app',
  recipient: 'user_123',
  title: 'تذكير',
  body: 'لديك مهمة تنتظرك',
  scheduledFor: oneHourLater,
});
```

## Batch Notifications

### Send to Multiple Recipients

```typescript
const batchId = await notificationEngine.createBatch({
  name: 'Weekly Newsletter',
  channel: 'email',
  recipients: ['user_1', 'user_2', 'user_3', 'user_4'],
  title: 'النشرة الأسبوعية',
  body: 'ملخص أخبار هذا الأسبوع...',
  priority: 'normal',
});

console.log('Batch created:', batchId);
```

### Send Template Batch

```typescript
const batchId = await notificationEngine.createBatch({
  name: 'Monthly Report',
  channel: 'email',
  recipients: allAgents.map(a => a.id),
  title: '', // Will be filled by template
  body: '',  // Will be filled by template
  templateId: 'monthly_report',
  templateData: {
    month: 'سبتمبر',
    year: 2026,
  },
  priority: 'low',
});
```

## Priority Levels

```typescript
// Low - للإشعارات غير العاجلة
priority: 'low'

// Normal - للإشعارات العادية (default)
priority: 'normal'

// High - للإشعارات المهمة
priority: 'high'

// Urgent - للإشعارات العاجلة جداً
priority: 'urgent'
```

## Delivery Tracking

### Mark as Delivered

```typescript
await notificationEngine.markAsDelivered('notif_123');
```

### Mark as Read

```typescript
await notificationEngine.markAsRead('notif_123');
```

### Get Notification Stats

```typescript
const stats = notificationEngine.getStats();

console.log(`
  Total: ${stats.total}
  Sent: ${stats.byStatus.sent}
  Delivered: ${stats.byStatus.delivered}
  Read: ${stats.byStatus.read}
  Failed: ${stats.byStatus.failed}
  Delivery Rate: ${stats.deliveryRate.toFixed(2)}%
  Read Rate: ${stats.readRate.toFixed(2)}%
`);

console.log('By Channel:', stats.byChannel);
console.log('By Priority:', stats.byPriority);
```

## Workflow Actions

استخدام Notifications في Workflows:

### Send Notification Action

```typescript
{
  id: 'send_notification_step',
  type: 'action',
  action: {
    type: 'send_notification',
    params: {
      channel: 'push',
      recipient: '{{userId}}',
      title: 'مرحباً {{userName}}',
      body: 'لديك {{taskCount}} مهمة جديدة',
      priority: 'high',
      data: {
        source: 'workflow'
      }
    }
  }
}
```

### Send Template Notification Action

```typescript
{
  id: 'send_template_step',
  type: 'action',
  action: {
    type: 'send_template_notification',
    params: {
      templateId: 'lead_assigned',
      recipient: '{{agentId}}',
      templateData: {
        leadName: '{{leadName}}',
        score: '{{leadScore}}'
      },
      priority: 'high',
      locale: 'ar'
    }
  }
}
```

### Send Batch Notification Action

```typescript
{
  id: 'send_batch_step',
  type: 'action',
  action: {
    type: 'send_batch_notification',
    params: {
      name: 'Team Update',
      channel: 'in_app',
      recipients: ['{{agent1}}', '{{agent2}}', '{{agent3}}'],
      title: 'تحديث الفريق',
      body: 'تم تحديث أهداف الشهر',
      priority: 'normal'
    }
  }
}
```

### Get Notification Stats Action

```typescript
{
  id: 'get_stats_step',
  type: 'action',
  action: {
    type: 'get_notification_stats',
    params: {}
  }
}
```

## Events

Notification Engine publishes events to EventBus:

- `notification.created` - Notification created
- `notification.sent` - Notification sent
- `notification.batch_created` - Batch created
- `notification.batch_completed` - Batch completed

### Subscribe to Notification Events

```typescript
import { eventBus } from '@/lib/vanguard/automation/event_bus';

eventBus.subscribe('notification.sent', (event) => {
  console.log('Notification sent:', event.data);
  // { notificationId, channel, recipient, priority }
});

eventBus.subscribe('notification.batch_completed', (event) => {
  console.log('Batch completed:', event.data);
  // { batchId, totalCount, sentCount, failedCount }
});
```

## Database Schema

### Notifications Table

```sql
CREATE TABLE vanguard_notifications (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  template_id TEXT,
  template_data JSONB,
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON vanguard_notifications(recipient);
CREATE INDEX idx_notifications_status ON vanguard_notifications(status);
CREATE INDEX idx_notifications_scheduled ON vanguard_notifications(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_notifications_channel ON vanguard_notifications(channel);
```

## Best Practices

### 1. Use Templates for Recurring Notifications

```typescript
// Good: Reusable template
await notificationEngine.sendFromTemplate({
  templateId: 'daily_report',
  recipient: agentId,
  templateData: { stats },
});

// Avoid: Hardcoded strings
await notificationEngine.send({
  channel: 'email',
  recipient: agentId,
  title: 'Daily Report',
  body: 'Your stats for today...',
});
```

### 2. Set Appropriate Priorities

```typescript
// Urgent: Time-sensitive, requires immediate action
priority: 'urgent' // Security alerts, critical errors

// High: Important but not critical
priority: 'high'   // Task deadlines, VIP leads

// Normal: Standard notifications
priority: 'normal' // Status updates, assignments

// Low: Informational, can wait
priority: 'low'    // Weekly reports, tips
```

### 3. Use Batch for Multiple Recipients

```typescript
// Good: Single batch operation
await notificationEngine.createBatch({
  name: 'Daily Update',
  channel: 'email',
  recipients: allUsers,
  title: 'Update',
  body: 'Your daily update...',
});

// Avoid: Multiple individual sends in loop
for (const user of allUsers) {
  await notificationEngine.send({ ... });
}
```

### 4. Schedule Non-Urgent Notifications

```typescript
// Schedule for working hours
const scheduledFor = new Date();
scheduledFor.setHours(9, 0, 0); // 9 AM

await notificationEngine.send({
  channel: 'email',
  recipient: userId,
  title: 'Daily Report',
  body: 'Your report...',
  scheduledFor,
});
```

### 5. Track Delivery and Engagement

```typescript
// Monitor stats regularly
const stats = notificationEngine.getStats();

if (stats.deliveryRate < 80) {
  console.warn('Low delivery rate:', stats.deliveryRate);
}

if (stats.readRate < 30) {
  console.warn('Low engagement:', stats.readRate);
}
```

## Complete Example

```typescript
import { 
  notificationEngine,
  NotificationTemplate 
} from '@/lib/vanguard/automation/notifications';

// 1. Start processing
notificationEngine.startProcessing();

// 2. Register custom template
const template: NotificationTemplate = {
  id: 'order_confirmed',
  name: 'Order Confirmed',
  nameAr: 'تأكيد الطلب',
  channel: 'push',
  titleTemplate: 'تم تأكيد طلبك #{{orderNumber}}',
  bodyTemplate: 'طلبك بقيمة {{amount}} جنيه تم تأكيده. وقت التسليم المتوقع: {{deliveryTime}}',
  requiredVariables: ['orderNumber', 'amount', 'deliveryTime'],
};

notificationEngine.registerTemplate(template);

// 3. Send immediate notification
await notificationEngine.sendFromTemplate({
  templateId: 'order_confirmed',
  recipient: 'user_123',
  templateData: {
    orderNumber: '12345',
    amount: '500',
    deliveryTime: '3-5 أيام',
  },
  priority: 'high',
});

// 4. Schedule reminder
const reminderDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days

await notificationEngine.send({
  channel: 'push',
  recipient: 'user_123',
  title: 'تذكير بالطلب',
  body: 'طلبك #12345 سيصل غداً',
  priority: 'normal',
  scheduledFor: reminderDate,
});

// 5. Monitor stats
setInterval(() => {
  const stats = notificationEngine.getStats();
  console.log('Notification Stats:', {
    total: stats.total,
    deliveryRate: `${stats.deliveryRate.toFixed(2)}%`,
    readRate: `${stats.readRate.toFixed(2)}%`,
  });
}, 60000); // Every minute
```

## Troubleshooting

### Notifications Not Sending

```typescript
// Check if processing started
notificationEngine.startProcessing();

// Check notification status
const stats = notificationEngine.getStats();
console.log('Pending:', stats.byStatus.pending);
console.log('Failed:', stats.byStatus.failed);
```

### High Failure Rate

```typescript
const stats = notificationEngine.getStats();
const failureRate = (stats.byStatus.failed / stats.total) * 100;

if (failureRate > 10) {
  console.error('High failure rate:', failureRate);
  // Check:
  // 1. Network connectivity
  // 2. Channel configuration
  // 3. Recipient validity
  // 4. Rate limits
}
```

### Template Variable Missing

```typescript
try {
  await notificationEngine.sendFromTemplate({
    templateId: 'welcome_user',
    recipient: 'user_123',
    templateData: {
      // Missing 'userName'
      credits: 100,
    },
  });
} catch (error) {
  console.error('Template error:', error);
  // Error: Missing required template variable: userName
}
```
