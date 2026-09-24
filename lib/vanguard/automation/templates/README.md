# VANGUARD Workflow Templates

قوالب Workflows جاهزة للاستخدام للسيناريوهات الشائعة في Sales Operations

## Overview

يوفر هذا المجلد مجموعة من قوالب Workflows الجاهزة التي يمكن استخدامها مباشرة أو تخصيصها حسب الحاجة:

1. **Lead Nurturing** - رعاية العملاء المحتملين
2. **Follow-up Automation** - متابعة تلقائية
3. **Lead Qualification** - تأهيل العملاء
4. **Customer Onboarding** - إعداد العملاء الجدد
5. **Task Escalation** - تصعيد المهام

## Available Templates

### 1. Lead Nurturing Workflow

**ID**: `lead_nurturing`

رعاية تلقائية للعملاء المحتملين مع التقييم والتوجيه والمتابعة.

**Flow**:
1. تقييم العميل المحتمل (Lead Scoring)
2. فحص النقاط:
   - **نقاط عالية (≥70)**: توجيه فوري لوكيل مبيعات + إشعار
   - **نقاط منخفضة (<70)**: دخول سلسلة رعاية
3. سلسلة الرعاية:
   - انتظار ساعتين
   - إرسال بريد رعاية
   - إنشاء مهمة متابعة

**Variables**:
```typescript
{
  leadId: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  initialScore: number;
  source: string;
}
```

**Usage**:
```typescript
import { createFromTemplate } from '@/lib/vanguard/automation/templates';
import { workflowEngine } from '@/lib/vanguard/automation/workflow_engine';

const workflow = createFromTemplate('lead_nurturing', {
  leadId: 'lead_123',
  leadName: 'أحمد محمد',
  leadEmail: 'ahmed@example.com',
  leadPhone: '+201234567890',
  initialScore: 65,
  source: 'whatsapp',
});

const executionId = await workflowEngine.startWorkflow(workflow.id, {}, {
  userId: 'user_123',
  triggeredBy: 'manual',
});
```

---

### 2. Follow-up Automation Workflow

**ID**: `follow_up_automation`

متابعة تلقائية متعددة القنوات مع تصعيد عند عدم الرد.

**Flow**:
1. محاولة 1: رسالة WhatsApp
2. انتظار 24 ساعة
3. فحص الرد:
   - **رد موجود**: تمييز كمتفاعل
   - **لا يوجد رد**: محاولة 2 عبر البريد
4. محاولة 2: بريد إلكتروني
5. انتظار 48 ساعة
6. فحص الرد:
   - **رد موجود**: تمييز كمتفاعل
   - **لا يوجد رد**: تصعيد للمدير

**Variables**:
```typescript
{
  leadId: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  agentId: string;
  attemptCount: number;
}
```

**Usage**:
```typescript
const workflow = createFromTemplate('follow_up_automation', {
  leadId: 'lead_456',
  leadName: 'سارة علي',
  leadPhone: '+201234567890',
  leadEmail: 'sara@example.com',
  agentId: 'agent_789',
  attemptCount: 0,
});

await workflowEngine.startWorkflow(workflow.id, {}, {
  triggeredBy: 'scheduled_task',
});
```

---

### 3. Lead Qualification Workflow

**ID**: `lead_qualification`

تأهيل تلقائي للعملاء بناءً على التفاعل واكتمال البيانات.

**Flow**:
1. حساب نقاط التفاعل (عدد الرسائل الواردة)
2. فحص اكتمال البيانات
3. حساب نقاط التأهيل الإجمالية
4. تحديث نقاط العميل
5. فحص التأهيل:
   - **مؤهل (≥80)**: 
     - تمييز كمؤهل
     - توجيه لفريق المبيعات
     - إشعار الوكيل
   - **غير مؤهل (<80)**:
     - إنشاء مهمة لمواصلة الرعاية

**Variables**:
```typescript
{
  leadId: string;
  leadScore: number;
  engagementLevel: number;
  dataCompleteness: number;
}
```

**Usage**:
```typescript
const workflow = createFromTemplate('lead_qualification', {
  leadId: 'lead_789',
  leadScore: 0,
  engagementLevel: 0,
  dataCompleteness: 0,
});

await workflowEngine.startWorkflow(workflow.id, {}, {
  triggeredBy: 'trigger_engine',
  metadata: { triggerType: 'engagement_threshold' },
});
```

---

### 4. Customer Onboarding Workflow

**ID**: `customer_onboarding`

إعداد تلقائي للعميل الجديد مع سلسلة ترحيب ومتابعة.

**Flow**:
1. إرسال بريد ترحيبي
2. إرسال رسالة WhatsApp ترحيبية
3. تعيين مدير حساب
4. إنشاء مهمة إعداد للمدير
5. إشعار مدير الحساب
6. جدولة نصائح اليوم الأول
7. جدولة متابعة اليوم الثالث
8. جدولة استبيان الأسبوع الأول

**Variables**:
```typescript
{
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  planType: string; // 'basic' | 'pro' | 'enterprise'
}
```

**Usage**:
```typescript
const workflow = createFromTemplate('customer_onboarding', {
  customerId: 'customer_123',
  customerName: 'محمد حسن',
  customerEmail: 'mohamed@example.com',
  customerPhone: '+201234567890',
  planType: 'pro',
});

await workflowEngine.startWorkflow(workflow.id, {}, {
  triggeredBy: 'customer_signup',
  metadata: { signupDate: new Date() },
});
```

---

### 5. Task Escalation Workflow

**ID**: `task_escalation`

تصعيد تلقائي للمهام المتأخرة.

**Flow**:
1. فحص إذا كانت المهمة متأخرة
2. إذا متأخرة:
   - إرسال تذكير للمكلف
   - انتظار 4 ساعات
   - فحص إذا تم إنجاز المهمة:
     - **لم تنجز**: تصعيد للمدير
       - إعادة تعيين المهمة للمدير
       - إشعار المدير
       - إشعار المكلف الأصلي

**Variables**:
```typescript
{
  taskId: string;
  taskTitle: string;
  assignedTo: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}
```

**Usage**:
```typescript
const workflow = createFromTemplate('task_escalation', {
  taskId: 'task_456',
  taskTitle: 'Follow up with VIP client',
  assignedTo: 'agent_123',
  dueDate: new Date('2026-09-20').toISOString(),
  priority: 'high',
});

await workflowEngine.startWorkflow(workflow.id, {}, {
  triggeredBy: 'scheduled_check',
});
```

## Working with Templates

### List All Templates

```typescript
import { getAllWorkflowTemplates } from '@/lib/vanguard/automation/templates';

const templates = getAllWorkflowTemplates();

templates.forEach(template => {
  console.log(`${template.nameAr} (${template.id})`);
  console.log(`  Description: ${template.descriptionAr}`);
  console.log(`  Steps: ${template.steps.length}`);
});
```

### Get Specific Template

```typescript
import { getWorkflowTemplate } from '@/lib/vanguard/automation/templates';

const template = getWorkflowTemplate('lead_nurturing');

if (template) {
  console.log('Template found:', template.nameAr);
  console.log('Variables:', Object.keys(template.variables));
}
```

### Create Instance from Template

```typescript
import { createFromTemplate } from '@/lib/vanguard/automation/templates';

// Create workflow instance with custom variables
const workflowInstance = createFromTemplate('follow_up_automation', {
  leadId: 'lead_123',
  leadName: 'أحمد',
  leadPhone: '+201234567890',
  leadEmail: 'ahmed@example.com',
  agentId: 'agent_456',
  attemptCount: 0,
});

// Instance has unique ID and custom variables
console.log('Instance ID:', workflowInstance.id);
console.log('Variables:', workflowInstance.variables);
```

### Register and Execute Template

```typescript
import { createFromTemplate } from '@/lib/vanguard/automation/templates';
import { WorkflowEngine } from '@/lib/vanguard/automation/workflow_engine';

const engine = WorkflowEngine.getInstance();

// 1. Create workflow from template
const workflow = createFromTemplate('customer_onboarding', {
  customerId: 'cust_789',
  customerName: 'فاطمة',
  customerEmail: 'fatima@example.com',
  customerPhone: '+201234567890',
  planType: 'enterprise',
});

// 2. Register workflow
const workflowId = await engine.registerWorkflow(workflow);

// 3. Start execution
const executionId = await engine.startWorkflow(workflowId, {
  additionalData: 'value',
}, {
  userId: 'user_123',
  triggeredBy: 'api_call',
  metadata: {
    source: 'signup_form',
  },
});

console.log('Workflow executing:', executionId);
```

## Customizing Templates

### Override Steps

```typescript
import { getWorkflowTemplate } from '@/lib/vanguard/automation/templates';

const template = getWorkflowTemplate('lead_nurturing');

if (template) {
  // Create custom version
  const customWorkflow = {
    ...template,
    id: 'lead_nurturing_custom_v1',
    name: 'Custom Lead Nurturing',
    nameAr: 'رعاية عملاء مخصصة',
    
    // Override variables
    variables: {
      ...template.variables,
      customField: 'value',
    },
    
    // Modify steps
    steps: [
      ...template.steps.slice(0, 3), // Keep first 3 steps
      {
        id: 'custom_step',
        name: 'Custom Action',
        nameAr: 'إجراء مخصص',
        type: 'action',
        action: {
          type: 'http_request',
          params: {
            url: 'https://api.example.com/custom',
            method: 'POST',
            body: { leadId: '{{leadId}}' },
          },
        },
      },
      ...template.steps.slice(3), // Keep remaining steps
    ],
  };
  
  // Register custom workflow
  await workflowEngine.registerWorkflow(customWorkflow);
}
```

### Create Completely New Template

```typescript
import { WorkflowDefinition } from '@/lib/vanguard/automation/workflow_engine';

const myCustomWorkflow: WorkflowDefinition = {
  id: 'my_custom_workflow_v1',
  name: 'My Custom Workflow',
  nameAr: 'سير عمل مخصص',
  description: 'Custom workflow for specific use case',
  descriptionAr: 'سير عمل مخصص لحالة استخدام معينة',
  version: '1.0.0',
  enabled: true,
  
  variables: {
    // Define your variables
    entityId: '',
    entityName: '',
  },
  
  steps: [
    {
      id: 'step_1',
      name: 'First Step',
      nameAr: 'الخطوة الأولى',
      type: 'action',
      action: {
        type: 'create_lead',
        params: {
          name: '{{entityName}}',
          source: 'custom_workflow',
        },
      },
    },
    // Add more steps...
  ],
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Register
await workflowEngine.registerWorkflow(myCustomWorkflow);
```

## Integration with Triggers

ربط القوالب مع Triggers للتشغيل التلقائي:

```typescript
import { TriggerEngine } from '@/lib/vanguard/automation/trigger_engine';
import { createFromTemplate } from '@/lib/vanguard/automation/templates';

const triggerEngine = TriggerEngine.getInstance();

// Create trigger that starts workflow from template
await triggerEngine.addTrigger({
  id: 'new_lead_trigger',
  name: 'New Lead Auto-Nurture',
  nameAr: 'رعاية تلقائية للعملاء الجدد',
  type: 'event',
  enabled: true,
  priority: 50,
  
  event: {
    eventType: 'lead.created',
  },
  
  conditions: [
    {
      field: 'data.source',
      operator: 'in',
      value: ['whatsapp', 'website'],
    },
  ],
  
  actions: [
    {
      type: 'workflow',
      workflowId: 'lead_nurturing',
      variables: {
        leadId: '{{event.data.leadId}}',
        leadName: '{{event.data.name}}',
        leadEmail: '{{event.data.email}}',
        leadPhone: '{{event.data.phone}}',
        initialScore: 50,
        source: '{{event.data.source}}',
      },
    },
  ],
});
```

## Best Practices

### 1. Use Templates as Starting Points

```typescript
// Good: Start with template and customize
const workflow = createFromTemplate('lead_nurturing', myVariables);
workflow.steps.push(myCustomStep);

// Avoid: Building everything from scratch
const workflow = { /* 100 lines of config */ };
```

### 2. Validate Variables Before Execution

```typescript
const requiredVars = ['leadId', 'leadName', 'leadEmail'];
const variables = { leadId: 'lead_123', leadName: 'أحمد' };

const missing = requiredVars.filter(v => !variables[v]);
if (missing.length > 0) {
  throw new Error(`Missing variables: ${missing.join(', ')}`);
}

const workflow = createFromTemplate('lead_nurturing', variables);
```

### 3. Monitor Workflow Executions

```typescript
import { eventBus } from '@/lib/vanguard/automation/event_bus';

// Subscribe to workflow events
eventBus.subscribe('workflow:completed', (event) => {
  console.log('Workflow completed:', event.data);
  // Log to analytics, update dashboards, etc.
});

eventBus.subscribe('workflow:failed', (event) => {
  console.error('Workflow failed:', event.data);
  // Alert team, retry, etc.
});
```

### 4. Version Your Custom Templates

```typescript
const myWorkflow: WorkflowDefinition = {
  id: 'my_workflow_v2', // Increment version
  version: '2.0.0',      // Semantic versioning
  // ... rest of config
};
```

### 5. Test Templates Thoroughly

```typescript
// Test with sample data
const testData = {
  leadId: 'test_lead_123',
  leadName: 'Test User',
  leadEmail: 'test@example.com',
  leadPhone: '+201234567890',
  initialScore: 75,
  source: 'test',
};

const workflow = createFromTemplate('lead_nurturing', testData);
const executionId = await workflowEngine.startWorkflow(workflow.id, {}, {
  metadata: { isTest: true },
});

// Monitor execution
const execution = await workflowEngine.getExecution(executionId);
console.log('Test execution status:', execution.status);
```

## Template Development Guide

عند إنشاء قوالب جديدة، اتبع هذه المبادئ:

1. **Clear Naming**: أسماء واضحة بالعربية والإنجليزية
2. **Documented Variables**: توثيق جميع المتغيرات المطلوبة
3. **Error Handling**: استخدام `onError` و `continueOnError`
4. **Logical Flow**: خطوات منطقية ومتسلسلة
5. **Reusability**: قابلة لإعادة الاستخدام في سيناريوهات مختلفة
6. **Performance**: تجنب الانتظار الطويل أو الحلقات المفرطة

## Example: Complete Integration

```typescript
import { 
  workflowEngine,
  triggerEngine,
  createFromTemplate,
  eventBus 
} from '@/lib/vanguard/automation';

// 1. Subscribe to events
eventBus.subscribe('workflow:completed', (event) => {
  console.log(`✅ Workflow completed: ${event.data.workflowName}`);
});

// 2. Create trigger for new leads
await triggerEngine.addTrigger({
  id: 'auto_nurture_trigger',
  name: 'Auto Nurture New Leads',
  nameAr: 'رعاية تلقائية للعملاء الجدد',
  type: 'event',
  enabled: true,
  priority: 100,
  
  event: {
    eventType: 'lead.created',
  },
  
  actions: [
    {
      type: 'workflow',
      workflowId: 'lead_nurturing',
      variables: {
        leadId: '{{event.data.leadId}}',
        leadName: '{{event.data.name}}',
        leadEmail: '{{event.data.email}}',
        leadPhone: '{{event.data.phone}}',
        initialScore: 60,
        source: '{{event.data.source}}',
      },
    },
  ],
});

// 3. Manual execution for specific lead
const workflow = createFromTemplate('lead_nurturing', {
  leadId: 'lead_456',
  leadName: 'فاطمة أحمد',
  leadEmail: 'fatima@example.com',
  leadPhone: '+201234567890',
  initialScore: 85,
  source: 'referral',
});

const workflowId = await workflowEngine.registerWorkflow(workflow);
const executionId = await workflowEngine.startWorkflow(workflowId, {});

console.log('Manual workflow started:', executionId);
```
