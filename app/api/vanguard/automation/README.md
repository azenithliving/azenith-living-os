# VANGUARD Automation API Documentation

مرجع شامل لـ REST API الخاص بنظام الأتمتة

## Base URL

```
/api/vanguard/automation
```

## Authentication

جميع endpoints تتطلب المصادقة. استخدم authentication tokens المناسبة في headers.

```http
Authorization: Bearer <your-token>
```

---

## Workflows API

### Start a Workflow

بدء تنفيذ workflow

**Endpoint**: `POST /workflows`

**Request Body**:
```json
{
  "workflowId": "lead_nurturing",
  "variables": {
    "leadId": "lead_123",
    "leadName": "أحمد محمد",
    "leadEmail": "ahmed@example.com",
    "leadPhone": "+201234567890",
    "initialScore": 65,
    "source": "whatsapp"
  },
  "options": {
    "sessionId": "session_456",
    "userId": "user_789",
    "triggeredBy": "manual",
    "metadata": {
      "campaign": "summer_2026"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "executionId": "exec_1234567890_abc123",
  "workflowId": "lead_nurturing",
  "message": "Workflow started successfully"
}
```

---

### Get Workflow Status

الحصول على حالة workflow

**Endpoint**: `GET /workflows/:id`

**Response**:
```json
{
  "success": true,
  "execution": {
    "id": "exec_1234567890_abc123",
    "workflowId": "lead_nurturing",
    "status": "running",
    "startedAt": "2026-09-24T10:00:00Z",
    "completedAt": null,
    "completedSteps": ["step_1", "step_2"],
    "failedSteps": [],
    "error": null
  }
}
```

**Status Values**: `pending` | `running` | `paused` | `completed` | `failed` | `cancelled`

---

### Pause Workflow

إيقاف مؤقت لـ workflow

**Endpoint**: `PUT /workflows/:id`

**Request Body**:
```json
{
  "action": "pause"
}
```

**Response**:
```json
{
  "success": true,
  "executionId": "exec_1234567890_abc123",
  "action": "pause",
  "message": "Workflow paused successfully"
}
```

---

### Resume Workflow

استئناف workflow

**Endpoint**: `PUT /workflows/:id`

**Request Body**:
```json
{
  "action": "resume"
}
```

---

### Cancel Workflow

إلغاء workflow

**Endpoint**: `DELETE /workflows/:id`

**Response**:
```json
{
  "success": true,
  "executionId": "exec_1234567890_abc123",
  "message": "Workflow cancelled successfully"
}
```

---

### List Workflow Templates

الحصول على قائمة workflow templates المتاحة

**Endpoint**: `GET /workflows?action=templates`

**Response**:
```json
{
  "success": true,
  "templates": [
    {
      "id": "lead_nurturing",
      "name": "Lead Nurturing Campaign",
      "nameAr": "حملة رعاية العملاء المحتملين",
      "description": "Automated lead nurturing...",
      "descriptionAr": "رعاية تلقائية للعملاء...",
      "version": "1.0.0",
      "stepCount": 7,
      "variables": ["leadId", "leadName", "leadEmail", "leadPhone", "initialScore", "source"]
    },
    {
      "id": "follow_up_automation",
      "name": "Automated Follow-up",
      "nameAr": "متابعة تلقائية",
      "description": "Multi-channel follow-up...",
      "descriptionAr": "سلسلة متابعة متعددة القنوات...",
      "version": "1.0.0",
      "stepCount": 9,
      "variables": ["leadId", "leadName", "leadPhone", "leadEmail", "agentId"]
    }
  ]
}
```

---

## Tasks API

### Schedule a Task

جدولة مهمة في background

**Endpoint**: `POST /tasks`

**Request Body**:
```json
{
  "taskType": "send_daily_report",
  "data": {
    "recipientId": "user_123",
    "reportType": "sales_summary"
  },
  "options": {
    "priority": "HIGH",
    "scheduledFor": "2026-09-25T09:00:00Z",
    "recurring": {
      "cronExpression": "0 9 * * *",
      "endDate": "2026-12-31T00:00:00Z"
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "taskId": "task_1234567890_def456",
  "taskType": "send_daily_report",
  "message": "Task scheduled successfully"
}
```

**Priority Values**: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`

---

### Get Task Status

الحصول على حالة مهمة

**Endpoint**: `GET /tasks?id=task_1234567890_def456`

**Response**:
```json
{
  "success": true,
  "task": {
    "id": "task_1234567890_def456",
    "task_type": "send_daily_report",
    "status": "completed",
    "priority": "HIGH",
    "scheduled_for": "2026-09-25T09:00:00Z",
    "executed_at": "2026-09-25T09:00:15Z",
    "completed_at": "2026-09-25T09:00:45Z",
    "retry_count": 0,
    "error": null
  }
}
```

**Status Values**: `pending` | `running` | `completed` | `failed` | `cancelled`

---

### Get Task Statistics

الحصول على إحصائيات المهام

**Endpoint**: `GET /tasks?action=stats`

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalTasks": 1250,
    "pendingTasks": 45,
    "runningTasks": 5,
    "completedTasks": 1180,
    "failedTasks": 20,
    "averageExecutionTime": 1250,
    "tasksByType": {
      "send_daily_report": 300,
      "process_leads": 450,
      "sync_data": 500
    }
  }
}
```

---

## Notifications API

### Send Notification

إرسال إشعار

**Endpoint**: `POST /notifications`

**Request Body**:
```json
{
  "channel": "push",
  "recipient": "user_123",
  "title": "مهمة جديدة",
  "body": "لديك مهمة جديدة تنتظرك",
  "priority": "high",
  "scheduledFor": "2026-09-24T14:00:00Z"
}
```

**Channels**: `push` | `email` | `sms` | `whatsapp` | `in_app`

**Priority**: `low` | `normal` | `high` | `urgent`

**Response**:
```json
{
  "success": true,
  "notificationId": "notif_1234567890_ghi789",
  "message": "Notification sent successfully"
}
```

---

### Send from Template

إرسال إشعار من template

**Endpoint**: `POST /notifications`

**Request Body**:
```json
{
  "templateId": "lead_assigned",
  "recipient": "agent_456",
  "templateData": {
    "leadName": "أحمد محمد",
    "score": 85
  },
  "priority": "high"
}
```

**Response**:
```json
{
  "success": true,
  "notificationId": "notif_1234567890_jkl012",
  "message": "Template notification sent successfully"
}
```

---

### Send Batch Notifications

إرسال إشعارات جماعية

**Endpoint**: `POST /notifications`

**Request Body**:
```json
{
  "batch": true,
  "recipients": ["user_1", "user_2", "user_3"],
  "channel": "email",
  "title": "تحديث النظام",
  "body": "سيتم إجراء صيانة على النظام يوم الأحد",
  "priority": "normal"
}
```

**Response**:
```json
{
  "success": true,
  "notificationIds": [
    "notif_1234567890_aaa",
    "notif_1234567890_bbb",
    "notif_1234567890_ccc"
  ],
  "count": 3,
  "message": "Batch notifications sent successfully"
}
```

---

### Get Notification Statistics

الحصول على إحصائيات الإشعارات

**Endpoint**: `GET /notifications?action=stats`

**Response**:
```json
{
  "success": true,
  "stats": {
    "total": 5420,
    "byStatus": {
      "pending": 15,
      "scheduled": 30,
      "sent": 4800,
      "delivered": 4650,
      "read": 3920,
      "failed": 95,
      "cancelled": 10
    },
    "byChannel": {
      "push": 2100,
      "email": 1800,
      "sms": 500,
      "whatsapp": 800,
      "in_app": 220
    },
    "byPriority": {
      "low": 820,
      "normal": 3200,
      "high": 1100,
      "urgent": 300
    },
    "deliveryRate": 96.88,
    "readRate": 84.30
  }
}
```

---

## Routing API

### Route a Lead

توجيه عميل محتمل لأفضل وكيل

**Endpoint**: `POST /routing`

**Request Body**:
```json
{
  "type": "lead",
  "entityId": "lead_123",
  "priority": "high",
  "requiredSkills": ["sales", "arabic"],
  "preferredLanguage": "ar"
}
```

**Response**:
```json
{
  "success": true,
  "agentId": "agent_456",
  "reason": "Assigned using weighted strategy",
  "message": "Lead routed successfully"
}
```

---

### Route a Conversation

توجيه محادثة لوكيل

**Endpoint**: `POST /routing`

**Request Body**:
```json
{
  "type": "conversation",
  "entityId": "conv_789",
  "priority": "medium",
  "requiredSkills": ["support"],
  "preferredLanguage": "ar"
}
```

---

### Get Routing Statistics

الحصول على إحصائيات التوجيه

**Endpoint**: `GET /routing?action=stats`

**Response**:
```json
{
  "success": true,
  "stats": {
    "totalAgents": 25,
    "availableAgents": 18,
    "avgUtilization": 62.5,
    "totalCapacity": 125,
    "usedCapacity": 78
  }
}
```

---

### Get Available Agents

الحصول على الوكلاء المتاحين

**Endpoint**: `GET /routing?action=agents&skills=sales,arabic&languages=ar&minCapacity=2`

**Query Parameters**:
- `skills`: مهارات مطلوبة (comma-separated)
- `languages`: لغات (comma-separated)
- `minCapacity`: الحد الأدنى من السعة المتاحة

**Response**:
```json
{
  "success": true,
  "agents": [
    {
      "id": "agent_456",
      "name": "أحمد محمد",
      "availability": "available",
      "skills": ["sales", "arabic", "vip_support"],
      "languages": ["ar", "en"],
      "capacity": {
        "current": 2,
        "maximum": 5,
        "utilizationRate": 40
      },
      "performance": {
        "averageResponseTime": 90,
        "resolutionRate": 85,
        "satisfactionScore": 92,
        "totalConversations": 156,
        "activeConversations": 2
      }
    }
  ],
  "count": 1
}
```

---

## Triggers API

### Create a Trigger

إنشاء trigger جديد

**Endpoint**: `POST /triggers`

**Request Body**:
```json
{
  "id": "high_value_lead_alert",
  "name": "High Value Lead Alert",
  "nameAr": "تنبيه عميل ذو قيمة عالية",
  "type": "threshold",
  "enabled": true,
  "priority": 90,
  "threshold": {
    "metric": "lead_value",
    "operator": ">=",
    "value": 50000
  },
  "actions": [
    {
      "type": "workflow",
      "workflowId": "vip_lead_handling",
      "variables": {
        "leadId": "{{leadId}}",
        "value": "{{value}}"
      }
    },
    {
      "type": "notification",
      "channel": "push",
      "recipient": "sales_manager",
      "title": "عميل VIP جديد",
      "body": "عميل بقيمة {{value}} جنيه"
    }
  ]
}
```

**Trigger Types**: `event` | `schedule` | `threshold` | `composite`

**Response**:
```json
{
  "success": true,
  "triggerId": "high_value_lead_alert",
  "message": "Trigger created successfully"
}
```

---

### List All Triggers

الحصول على قائمة جميع الـ triggers

**Endpoint**: `GET /triggers`

**Response**:
```json
{
  "success": true,
  "triggers": [
    {
      "id": "lead_scoring_threshold",
      "name": "High Score Lead Auto-Route",
      "nameAr": "توجيه تلقائي للعملاء ذوي النقاط العالية",
      "type": "threshold",
      "enabled": true,
      "priority": 80,
      "activationCount": 145
    },
    {
      "id": "task_overdue_escalation",
      "name": "Overdue Task Escalation",
      "nameAr": "تصعيد المهام المتأخرة",
      "type": "schedule",
      "enabled": true,
      "priority": 90,
      "activationCount": 23
    }
  ],
  "count": 2
}
```

---

### Get Trigger Details

الحصول على تفاصيل trigger

**Endpoint**: `GET /triggers/:id`

**Response**:
```json
{
  "success": true,
  "trigger": {
    "id": "lead_scoring_threshold",
    "name": "High Score Lead Auto-Route",
    "nameAr": "توجيه تلقائي للعملاء ذوي النقاط العالية",
    "type": "threshold",
    "enabled": true,
    "priority": 80,
    "threshold": {
      "metric": "lead_score",
      "operator": ">=",
      "value": 80
    },
    "actions": [
      {
        "type": "workflow",
        "workflowId": "lead_qualification"
      }
    ],
    "activationCount": 145,
    "lastActivated": "2026-09-24T10:30:00Z"
  }
}
```

---

### Enable/Disable Trigger

تفعيل/تعطيل trigger

**Endpoint**: `PUT /triggers/:id`

**Request Body (Enable)**:
```json
{
  "action": "enable"
}
```

**Request Body (Disable)**:
```json
{
  "action": "disable"
}
```

**Response**:
```json
{
  "success": true,
  "triggerId": "lead_scoring_threshold",
  "message": "Trigger enabled successfully"
}
```

---

### Delete Trigger

حذف trigger

**Endpoint**: `DELETE /triggers/:id`

**Response**:
```json
{
  "success": true,
  "triggerId": "lead_scoring_threshold",
  "message": "Trigger deleted successfully"
}
```

---

## Error Responses

جميع endpoints ترجع نفس صيغة الأخطاء:

```json
{
  "error": "Error message",
  "details": "Detailed error description"
}
```

**Common Status Codes**:
- `400` - Bad Request (معاملات خاطئة)
- `404` - Not Found (المورد غير موجود)
- `500` - Internal Server Error (خطأ في الخادم)
- `503` - Service Unavailable (الخدمة غير متاحة)

---

## Usage Examples

### Example 1: Complete Lead Nurturing Flow

```typescript
// 1. Start workflow
const startResponse = await fetch('/api/vanguard/automation/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    workflowId: 'lead_nurturing',
    variables: {
      leadId: 'lead_123',
      leadName: 'أحمد محمد',
      leadEmail: 'ahmed@example.com',
      leadPhone: '+201234567890',
      initialScore: 75,
      source: 'website',
    },
  }),
});

const { executionId } = await startResponse.json();

// 2. Check status
const statusResponse = await fetch(`/api/vanguard/automation/workflows/${executionId}`);
const { execution } = await statusResponse.json();

console.log('Workflow status:', execution.status);
```

### Example 2: Schedule Daily Reports

```typescript
const response = await fetch('/api/vanguard/automation/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    taskType: 'send_daily_report',
    data: {
      recipientId: 'manager_123',
      reportType: 'sales_summary',
    },
    options: {
      priority: 'HIGH',
      recurring: {
        cronExpression: '0 9 * * *', // Every day at 9 AM
      },
    },
  }),
});

const { taskId } = await response.json();
console.log('Task scheduled:', taskId);
```

### Example 3: Smart Lead Routing

```typescript
const response = await fetch('/api/vanguard/automation/routing', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'lead',
    entityId: 'lead_456',
    priority: 'high',
    requiredSkills: ['sales', 'arabic'],
    preferredLanguage: 'ar',
  }),
});

const { success, agentId } = await response.json();
if (success) {
  console.log('Lead routed to agent:', agentId);
}
```

### Example 4: Send Batch Notifications

```typescript
const response = await fetch('/api/vanguard/automation/notifications', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    batch: true,
    recipients: ['agent_1', 'agent_2', 'agent_3'],
    channel: 'push',
    title: 'اجتماع الفريق',
    body: 'اجتماع الفريق سيبدأ خلال 15 دقيقة',
    priority: 'high',
  }),
});

const { notificationIds, count } = await response.json();
console.log(`Sent ${count} notifications`);
```

---

## Rate Limiting

- 100 requests per minute per user
- 1000 requests per hour per organization
- Batch operations count as single request

## Webhooks

يمكن تكوين webhooks لاستقبال أحداث الأتمتة:

- `workflow.started`
- `workflow.completed`
- `workflow.failed`
- `task.completed`
- `notification.sent`
- `routing.assigned`

---

## Support

للدعم والمساعدة:
- Documentation: `/docs/automation`
- Email: support@vanguard.ai
- Slack: #vanguard-automation
