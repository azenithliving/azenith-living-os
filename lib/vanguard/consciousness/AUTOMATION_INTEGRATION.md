# VANGUARD Automation Integration with Consciousness Core

دمج نظام الأتمتة مع نواة الوعي

## Overview

يوفر `AutomationIntegratedConsciousness` طبقة دمج بين Consciousness Core ونظام الأتمتة الكامل، مما يتيح:

- **AI-Driven Automation**: workflows تعمل بناءً على قرارات الذكاء الاصطناعي
- **Goal-Oriented Execution**: ربط المهام والـ workflows بأهداف Consciousness
- **Memory Integration**: تخزين أحداث الأتمتة كذكريات
- **Event-Driven Intelligence**: رد فعل ذكي على الأحداث
- **Autonomous Operations**: عمليات تلقائية موجهة بالذكاء الاصطناعي

## Quick Start

### Initialize Automation-Integrated Consciousness

```typescript
import { ConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';
import { 
  getAutomationConsciousness 
} from '@/lib/vanguard/consciousness/automation_integration';

// Get consciousness core
const consciousness = await getOrCreateConsciousnessCore({
  identity: vanguardIdentity,
  persistence: supabasePersistence,
});

// Awaken consciousness
await consciousness.awaken({
  sessionId: 'session_123',
  userId: 'user_456',
});

// Get automation-integrated version
const automationConsciousness = await getAutomationConsciousness(consciousness);

// Now you have full automation capabilities!
```

### Initialization Process

عند التهيئة، يقوم النظام بـ:

1. ✅ تحميل الوكلاء (Agents) من قاعدة البيانات
2. ✅ بدء مزامنة الوكلاء (كل 60 ثانية)
3. ✅ بدء معالجة الإشعارات
4. ✅ بدء عمال قائمة المهام (Task Queue Workers)
5. ✅ الاشتراك في أحداث الأتمتة
6. ✅ تسجيل Triggers الافتراضية
7. ✅ تحميل قوالب Workflows

## Core Features

### 1. Workflow Management

#### Start Workflow

```typescript
// من template
const executionId = await automationConsciousness.startWorkflow(
  'lead_nurturing', // template ID
  {
    leadId: 'lead_123',
    leadName: 'أحمد محمد',
    leadEmail: 'ahmed@example.com',
    leadPhone: '+201234567890',
    initialScore: 65,
    source: 'whatsapp',
  },
  {
    sessionId: 'session_123',
    userId: 'user_456',
    triggeredBy: 'manual',
  }
);
```

#### Workflow Control

```typescript
// إيقاف مؤقت
await automationConsciousness.pauseWorkflow(executionId);

// استئناف
await automationConsciousness.resumeWorkflow(executionId);

// إلغاء
await automationConsciousness.cancelWorkflow(executionId);
```

### 2. Task Scheduling

#### Schedule Background Task

```typescript
const taskId = await automationConsciousness.scheduleTask(
  'send_daily_report',
  {
    recipientId: 'user_123',
    reportType: 'sales_summary',
  },
  {
    priority: 'HIGH',
    scheduledFor: tomorrow,
  }
);
```

#### Check Task Status

```typescript
const status = await automationConsciousness.getTaskStatus(taskId);
console.log('Task status:', status);
```

### 3. Event Management

#### Publish Event

```typescript
await automationConsciousness.publishEvent(
  'lead.created',
  {
    leadId: 'lead_456',
    name: 'سارة علي',
    email: 'sara@example.com',
    phone: '+201234567890',
    source: 'website',
  },
  {
    sessionId: 'session_123',
  }
);
```

#### Subscribe to Events

```typescript
const subscriptionId = automationConsciousness.subscribeToEvent(
  'workflow:completed',
  async (event) => {
    console.log('Workflow completed:', event.data);
    // Handle completion
  }
);
```

### 4. Notifications

#### Send Notification

```typescript
const notificationId = await automationConsciousness.sendNotification({
  channel: 'push',
  recipient: 'user_123',
  title: 'مهمة جديدة',
  body: 'لديك مهمة جديدة تنتظرك',
  priority: 'high',
});
```

#### Send from Template

```typescript
const notificationId = await automationConsciousness.sendTemplateNotification({
  templateId: 'lead_assigned',
  recipient: 'agent_456',
  templateData: {
    leadName: 'أحمد محمد',
    score: 85,
  },
  priority: 'high',
});
```

### 5. Smart Routing

#### Route Lead

```typescript
const result = await automationConsciousness.routeLead({
  leadId: 'lead_789',
  priority: 'high',
  requiredSkills: ['sales', 'arabic'],
  preferredLanguage: 'ar',
});

if (result.success) {
  console.log('Lead routed to agent:', result.agentId);
} else {
  console.log('Routing failed:', result.reason);
}
```

#### Get Routing Stats

```typescript
const stats = automationConsciousness.getRoutingStats();
console.log(`
  Total Agents: ${stats.totalAgents}
  Available: ${stats.availableAgents}
  Avg Utilization: ${stats.avgUtilization}%
`);
```

## Automatic Behaviors

### Event → Workflow Integration

النظام يستجيب تلقائياً للأحداث:

#### Lead Created → Auto Nurture

```typescript
// عند إنشاء عميل جديد من WhatsApp أو Website
eventBus.publish('lead.created', {
  leadId: 'lead_123',
  name: 'محمد',
  source: 'whatsapp',
  // ...
});

// يبدأ workflow "lead_nurturing" تلقائياً
```

### Workflow → Consciousness Memory

كل workflow execution يتم تخزينه كذاكرة:

```typescript
// عند بدء workflow
Memory {
  id: 'workflow_exec_123',
  type: 'event',
  content: 'Started workflow: Lead Nurturing Campaign',
  metadata: { workflowId, executionId, variables },
  importance: 0.7,
}

// عند اكتمال workflow
Memory {
  id: 'workflow_complete_exec_123',
  type: 'event',
  content: 'Workflow completed: Lead Nurturing Campaign',
  importance: 0.7,
}
```

### Task → Goal Mapping

المهام ذات الأولوية العالية تصبح أهدافاً:

```typescript
// عند جدولة مهمة HIGH/CRITICAL
await scheduleTask('important_task', data, { priority: 'HIGH' });

// يتم إنشاء Goal تلقائياً
Goal {
  id: 'task_goal_task_123',
  description: 'Complete task: important_task',
  priority: 'HIGH',
  status: 'ACTIVE',
  metadata: { taskId, taskType, taskData },
}
```

## Default Triggers

يتم تسجيل 3 triggers افتراضية:

### 1. High Score Lead Auto-Route

```typescript
{
  id: 'lead_scoring_threshold',
  type: 'threshold',
  threshold: { metric: 'lead_score', operator: '>=', value: 80 },
  actions: [
    { type: 'workflow', workflowId: 'lead_qualification' }
  ]
}
```

عندما يصل lead لنقاط ≥80، يبدأ workflow التأهيل تلقائياً.

### 2. Task Overdue Escalation

```typescript
{
  id: 'task_overdue_escalation',
  type: 'schedule',
  schedule: { cronExpression: '0 */6 * * *' }, // كل 6 ساعات
  actions: [
    { type: 'workflow', workflowId: 'task_escalation' }
  ]
}
```

فحص المهام المتأخرة وتصعيدها كل 6 ساعات.

### 3. New Customer Onboarding

```typescript
{
  id: 'new_customer_onboarding',
  type: 'event',
  event: { eventType: 'customer.signup' },
  actions: [
    { type: 'workflow', workflowId: 'customer_onboarding' }
  ]
}
```

عند تسجيل عميل جديد، يبدأ workflow الإعداد تلقائياً.

## Integration Patterns

### Pattern 1: Goal-Driven Workflow

```typescript
// 1. إضافة هدف للـ consciousness
await consciousness.addGoal({
  id: 'qualify_hot_leads',
  description: 'Qualify all hot leads this week',
  descriptionAr: 'تأهيل جميع العملاء المهمين هذا الأسبوع',
  priority: 'HIGH',
  status: 'ACTIVE',
  deadline: endOfWeek,
});

// 2. بدء workflows لتحقيق الهدف
const hotLeads = await getHotLeads();
for (const lead of hotLeads) {
  await automationConsciousness.startWorkflow(
    'lead_qualification',
    { leadId: lead.id, leadScore: lead.score },
    { 
      metadata: { goalId: 'qualify_hot_leads' }
    }
  );
}

// 3. النظام يتتبع التقدم تلقائياً
// عند اكتمال كل workflow، يتم تحديث Goal
```

### Pattern 2: Event-Driven Automation

```typescript
// الاشتراك في أحداث business
automationConsciousness.subscribeToEvent('lead.high_engagement', async (event) => {
  // التفاعل بذكاء
  const lead = event.data.lead;
  
  // 1. تحديث نقاط العميل
  await updateLeadScore(lead.id, lead.score + 10);
  
  // 2. إذا وصل لعتبة، ابدأ التأهيل
  if (lead.score >= 80) {
    await automationConsciousness.startWorkflow('lead_qualification', {
      leadId: lead.id,
      leadScore: lead.score,
    });
  }
  
  // 3. إشعار الفريق
  await automationConsciousness.sendNotification({
    channel: 'push',
    recipient: lead.assignedAgentId,
    title: 'عميل متفاعل',
    body: `العميل ${lead.name} يظهر تفاعلاً عالياً`,
    priority: 'high',
  });
});
```

### Pattern 3: Scheduled Intelligence

```typescript
// جدولة مهمة دورية ذكية
await automationConsciousness.scheduleTask(
  'daily_lead_analysis',
  {
    analysisType: 'lead_health_check',
  },
  {
    priority: 'MEDIUM',
    recurring: {
      cronExpression: '0 9 * * *', // كل يوم 9 صباحاً
    },
  }
);

// المهمة تعمل يومياً وتتخذ قرارات ذكية:
// - تحليل جودة العملاء
// - تحديد العملاء الذين يحتاجون متابعة
// - بدء workflows تلقائية حسب الحاجة
```

## Advanced Usage

### Custom Trigger with AI Decision

```typescript
await automationConsciousness.addTrigger({
  id: 'ai_lead_prioritization',
  name: 'AI-Driven Lead Prioritization',
  nameAr: 'تحديد أولوية العملاء بالذكاء الاصطناعي',
  type: 'event',
  enabled: true,
  priority: 100,
  
  event: {
    eventType: 'lead.analyzed',
  },
  
  conditions: [
    {
      field: 'data.aiScore',
      operator: '>',
      value: 0.75,
    },
  ],
  
  actions: [
    {
      type: 'workflow',
      workflowId: 'lead_nurturing',
      variables: {
        leadId: '{{event.data.leadId}}',
        initialScore: '{{event.data.aiScore * 100}}',
        priority: 'high',
      },
    },
    {
      type: 'notification',
      channel: 'push',
      recipient: '{{event.data.bestAgentId}}',
      title: 'عميل محتمل مهم',
      body: 'الذكاء الاصطناعي حدد عميل محتمل ذو أولوية عالية',
    },
  ],
});
```

### Workflow with Consciousness Context

```typescript
// بدء workflow مع سياق من consciousness
const consciousness = automationConsciousness.getConsciousness();
const context = consciousness.getContext();
const activeGoals = consciousness.getActiveGoals();

await automationConsciousness.startWorkflow(
  'custom_workflow',
  {
    leadId: 'lead_123',
    currentGoals: activeGoals.map(g => g.description),
    systemContext: context,
  }
);
```

## Monitoring & Debugging

### Get System Status

```typescript
const isInitialized = automationConsciousness.isInitialized();
const workflowEngine = automationConsciousness.getWorkflowEngine();
const triggerEngine = automationConsciousness.getTriggerEngine();
const taskQueue = automationConsciousness.getTaskQueue();
const eventBus = automationConsciousness.getEventBus();

console.log('System Status:', {
  initialized: isInitialized,
  workflowsRegistered: workflowEngine.getWorkflowCount(),
  triggersActive: triggerEngine.getActiveTriggerCount(),
  tasksPending: await taskQueue.getPendingTaskCount(),
  eventsSubscribed: eventBus.getSubscriptionCount(),
});
```

### Subscribe to All Automation Events

```typescript
const automationEvents = [
  'workflow:started',
  'workflow:completed',
  'workflow:failed',
  'workflow:step_completed',
  'trigger:activated',
  'task.queued',
  'task.completed',
  'routing.assigned',
  'notification.sent',
];

for (const eventType of automationEvents) {
  automationConsciousness.subscribeToEvent(eventType, (event) => {
    console.log(`[${eventType}]`, event.data);
  });
}
```

## Best Practices

### 1. Initialize on Startup

```typescript
// في initialization code
const consciousness = await getOrCreateConsciousnessCore(config);
await consciousness.awaken(context);

const automationConsciousness = await getAutomationConsciousness(consciousness);

// Store globally for access
global.vanguardAutomation = automationConsciousness;
```

### 2. Graceful Shutdown

```typescript
// في shutdown handler
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  
  if (automationConsciousness) {
    await automationConsciousness.shutdown();
  }
  
  if (consciousness) {
    await consciousness.sleep();
  }
  
  process.exit(0);
});
```

### 3. Error Handling

```typescript
try {
  await automationConsciousness.startWorkflow('lead_nurturing', variables);
} catch (error) {
  console.error('Workflow start failed:', error);
  
  // Store failure in consciousness
  await consciousness.storeMemory({
    id: `workflow_error_${Date.now()}`,
    type: 'event',
    content: `Workflow failed to start: ${error.message}`,
    importance: 0.8,
    timestamp: new Date().toISOString(),
  });
  
  // Notify team
  await automationConsciousness.sendNotification({
    channel: 'push',
    recipient: 'admin_user',
    title: 'Workflow Error',
    body: `Failed to start workflow: ${error.message}`,
    priority: 'urgent',
  });
}
```

### 4. Use Templates for Common Workflows

```typescript
// Good: استخدام template
await automationConsciousness.startWorkflow('lead_nurturing', variables);

// Avoid: بناء workflow من الصفر في كل مرة
const workflow = {
  id: 'custom_...',
  steps: [ /* 50 lines of config */ ],
};
```

### 5. Monitor Performance

```typescript
// تتبع أداء workflows
automationConsciousness.subscribeToEvent('workflow:completed', (event) => {
  const duration = event.data.durationMs;
  const workflowName = event.data.workflowName;
  
  if (duration > 60000) { // أكثر من دقيقة
    console.warn(`Slow workflow detected: ${workflowName} (${duration}ms)`);
  }
});
```

## Troubleshooting

### Automation Not Starting

```typescript
// Check initialization
if (!automationConsciousness.isInitialized()) {
  console.error('Automation not initialized!');
  await automationConsciousness.initialize();
}
```

### Workflows Not Triggering

```typescript
// Check triggers
const triggers = automationConsciousness.getTriggerEngine();
const activeTriggers = triggers.getAllTriggers();

console.log('Active triggers:', activeTriggers.filter(t => t.enabled));
```

### Events Not Publishing

```typescript
// Check event bus
const eventBus = automationConsciousness.getEventBus();
const stats = eventBus.getStats();

console.log('Event bus stats:', stats);
```

## Complete Example

```typescript
import { getOrCreateConsciousnessCore } from '@/lib/vanguard/consciousness/consciousness_core';
import { getAutomationConsciousness } from '@/lib/vanguard/consciousness/automation_integration';
import { createSupabasePersistence } from '@/lib/vanguard/memory/supabase_persistence';

async function initializeVanguard() {
  // 1. Create consciousness
  const persistence = createSupabasePersistence(supabase);
  const consciousness = await getOrCreateConsciousnessCore({
    identity: vanguardIdentity,
    persistence,
  });
  
  // 2. Awaken
  await consciousness.awaken({
    sessionId: generateSessionId(),
    userId: currentUserId,
  });
  
  // 3. Get automation integration
  const automation = await getAutomationConsciousness(consciousness);
  
  // 4. Subscribe to events
  automation.subscribeToEvent('lead.created', async (event) => {
    console.log('New lead:', event.data);
  });
  
  // 5. Start a workflow
  const executionId = await automation.startWorkflow('lead_nurturing', {
    leadId: 'lead_123',
    leadName: 'أحمد محمد',
    leadEmail: 'ahmed@example.com',
    leadPhone: '+201234567890',
    initialScore: 70,
    source: 'website',
  });
  
  console.log('Workflow started:', executionId);
  
  return { consciousness, automation };
}

// Initialize on app start
const { consciousness, automation } = await initializeVanguard();

// Use throughout application
export { consciousness, automation };
```
