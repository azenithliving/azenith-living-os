# VANGUARD Workflow Actions Library

مكتبة شاملة من الإجراءات (Actions) التي يمكن استخدامها في Workflows الآلية.

## Available Actions

### 📱 Messaging Actions

#### `send_whatsapp`
إرسال رسالة WhatsApp

```typescript
{
  type: 'send_whatsapp',
  params: {
    to: '{{phoneNumber}}',      // رقم الهاتف
    message: 'مرحبا {{name}}',  // الرسالة (مع template support)
    template: 'welcome_msg',     // أو استخدام template
    templateParams: { ... }      // معاملات template
  }
}
```

#### `send_email`
إرسال بريد إلكتروني

```typescript
{
  type: 'send_email',
  params: {
    to: '{{email}}',
    subject: 'Welcome!',
    body: 'Email content...',    // أو
    template: 'welcome_email',   // استخدام template
    cc: 'cc@example.com',        // اختياري
    bcc: 'bcc@example.com'       // اختياري
  }
}
```

#### `send_notification`
إرسال إشعار push عبر WebSocket

```typescript
{
  type: 'send_notification',
  params: {
    userId: '{{userId}}',
    title: 'New Message',
    message: 'You have a new message',
    priority: 'high',            // high/medium/low
    data: { ... }                // بيانات إضافية
  }
}
```

### 👥 Lead Management Actions

#### `create_lead`
إنشاء عميل محتمل جديد

```typescript
{
  type: 'create_lead',
  params: {
    name: '{{customerName}}',
    email: '{{email}}',
    phone: '{{phone}}',
    source: 'whatsapp',
    status: 'new',
    metadata: { ... }
  }
}
```

#### `update_lead`
تحديث بيانات العميل

```typescript
{
  type: 'update_lead',
  params: {
    leadId: '{{leadId}}',
    updates: {
      status: 'qualified',
      score: 85,
      notes: 'Customer interested in product X'
    }
  }
}
```

#### `assign_lead`
تعيين العميل لوكيل

```typescript
{
  type: 'assign_lead',
  params: {
    leadId: '{{leadId}}',
    agentId: '{{agentId}}',
    reason: 'High priority lead'
  }
}
```

#### `update_lead_score`
تحديث نقاط العميل

```typescript
{
  type: 'update_lead_score',
  params: {
    leadId: '{{leadId}}',
    score: 90,
    reason: 'Engaged with multiple touchpoints'
  }
}
```

#### `convert_lead`
تحويل العميل إلى فرصة

```typescript
{
  type: 'convert_lead',
  params: {
    leadId: '{{leadId}}',
    opportunityData: {
      name: 'Deal Name',
      value: 50000,
      stage: 'qualification',
      probability: 60,
      expectedCloseDate: '2026-12-31'
    }
  }
}
```

### ✅ Task Management Actions

#### `create_task`
إنشاء مهمة جديدة

```typescript
{
  type: 'create_task',
  params: {
    title: 'Follow up with {{name}}',
    description: 'Call customer regarding inquiry',
    assignedTo: '{{agentId}}',
    dueDate: '{{tomorrow}}',
    priority: 'high',            // high/medium/low
    relatedLeadId: '{{leadId}}'
  }
}
```

#### `update_task`
تحديث المهمة

```typescript
{
  type: 'update_task',
  params: {
    taskId: '{{taskId}}',
    updates: {
      status: 'in_progress',
      priority: 'urgent'
    }
  }
}
```

#### `complete_task`
إتمام المهمة

```typescript
{
  type: 'complete_task',
  params: {
    taskId: '{{taskId}}',
    notes: 'Customer contacted successfully'
  }
}
```

#### `assign_task`
تعيين المهمة

```typescript
{
  type: 'assign_task',
  params: {
    taskId: '{{taskId}}',
    assignedTo: '{{agentId}}'
  }
}
```

### 🔄 Data Operations Actions

#### `http_request`
طلب HTTP خارجي

```typescript
{
  type: 'http_request',
  params: {
    url: 'https://api.example.com/endpoint',
    method: 'POST',              // GET/POST/PUT/DELETE
    headers: {
      'Authorization': 'Bearer {{token}}',
      'Content-Type': 'application/json'
    },
    body: { ... },
    timeout: 30000               // milliseconds
  }
}
```

#### `query_database`
استعلام قاعدة البيانات

```typescript
{
  type: 'query_database',
  params: {
    table: 'vanguard_leads',
    operation: 'select',         // select/insert/update/delete
    filters: {
      status: 'new',
      score: { gte: 70 }
    },
    select: 'id, name, email',
    data: { ... }                // for insert/update
  }
}
```

#### `transform_data`
تحويل البيانات

```typescript
{
  type: 'transform_data',
  params: {
    input: 'leads',              // variable name
    transformations: [
      {
        type: 'filter',
        params: {
          condition: {
            field: 'score',
            operator: 'gt',
            value: 80
          }
        }
      },
      {
        type: 'map',
        params: {
          mapping: {
            name: '$name',
            email: '$email',
            isHighScore: true
          }
        }
      }
    ]
  }
}
```

#### `wait`
انتظار مدة محددة

```typescript
{
  type: 'wait',
  params: {
    duration: 5,
    unit: 'minutes'              // seconds/minutes/hours/milliseconds
  }
}
```

## Template Variables

يمكن استخدام template variables في أي معامل نصي:

```typescript
{
  message: 'مرحبا {{customerName}}, نقاطك: {{score}}'
}
```

المتغيرات المتاحة تأتي من:
- `context.variables` - متغيرات workflow
- نتائج الخطوات السابقة (`stepId_result`)
- input data للـ workflow

## Error Handling

كل action يدعم:

- **Retry Logic**: تكرار عند الفشل
- **Rollback**: التراجع عند الخطأ
- **Validation**: التحقق من المعاملات قبل التنفيذ

## Adding New Actions

لإضافة action جديد:

1. إنشاء class يمتد من `BaseAction`
2. تنفيذ `execute()` و `validate()`
3. تسجيله في `ActionRegistry`

```typescript
import { BaseAction, ActionRegistry } from './base_action';

export class MyCustomAction extends BaseAction {
  async execute(context, config) {
    // Implementation
    return { success: true, data: {...} };
  }
  
  validate(config) {
    return this.validateRequired(config, ['requiredField']);
  }
}

ActionRegistry.register('my_action', new MyCustomAction());
```

## Integration with Workflow Engine

يتم تنفيذ Actions تلقائياً عبر WorkflowEngine:

```typescript
const workflow = {
  steps: [
    {
      id: 'step1',
      type: 'action',
      action: {
        type: 'send_whatsapp',
        params: {
          to: '{{phone}}',
          message: 'Hello!'
        }
      }
    }
  ]
};
```
