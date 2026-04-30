# خطة تحويل الوكيل التنفيذي إلى 100% حقيقي

## ملخص التحليل

بناءً على دراسة شاملة للمشروع، تم تحديد **3 طبقات رئيسية** من المشاكل:

### الطبقة 1: مشاكل بنيوية (تتطلب إعادة هيكلة)
1. انقسام تنفيذ الأدوات بين `architect-tools.ts` و `real-tool-executor.ts`
2. نظام الموافقات غير متصل بالأدوات الحقيقية
3. `agent-core.ts` ناقص في handlers كثيرة

### الطبقة 2: مشاكل بيانات (تتطلب تعديل قاعدة البيانات)
1. Metrics جزئية فقط (estimates بدلاً من real measurements)
2. content_update غير منفذ
3. restore backup غير موجود
4. نظام الأهداف غير مكتمل

### الطبقة 3: مشاكل واجهة (تتطلب تحديث UI)
1. UI لا يستلم البيانات الحقيقية من API
2. أزرار ProactiveDashboard بدون handlers
3. روابط المعاينة غير موجودة
4. Rollback غير موصول في الواجهة

---

## المرحلة 1: إعادة هيكلة Core Architecture
**المدة المتوقعة: 3-4 أيام**

### 1.1 توحيد مصدر الأدوات (Tool Registry Architecture)

**المشكلة:**
```
architect-tools.ts    → createSection, updateSiteSetting
real-tool-executor.ts → section_create, setting_update
```

**الحل:**
إنشاء `lib/agent-tools/tool-registry.ts` موحد:

```typescript
// هيكلة موحدة لجميع الأدوات
export interface ToolDefinition {
  name: string;                    // المعرف الموحد
  displayName: string;             // للعرض في UI
  description: string;
  category: 'content' | 'seo' | 'backup' | 'analytics' | 'system';
  riskLevel: 'low' | 'medium' | 'high' | 'destructive';
  requiresApproval: boolean;
  parameters: JSONSchema;
  handler: ToolHandler;            // الدالة المنفذة
  rollbackHandler?: RollbackHandler; // للتراجع
}

// سجل الأدوات الوحيد في المشروع
export const TOOL_REGISTRY: Record<string, ToolDefinition> = {
  section_create: {
    name: 'section_create',
    displayName: 'إنشاء قسم',
    category: 'content',
    riskLevel: 'medium',
    requiresApproval: true,
    handler: executeSectionCreate,
    rollbackHandler: executeSectionDelete,
  },
  // ... جميع الأدوات هنا
};
```

### 1.2 إصلاح agent-core.ts

**المشكلة:** `executeIntent` ناقص - يحتوي فقط على greeting

**الحل:**
إضافة handlers كاملة لجميع intents:

```typescript
private async executeIntent(
  intent: InterpretedIntent,
  userMessage: string,
  userId: string,
  context: CommandContext,
  relationContext?: RelationContext
): Promise<CommandResult> {
  switch (intent.name) {
    case "greeting": { /* existing */ }
    
    case "seo_audit": {
      return this.handleSEOAudit(intent.params, relationContext);
    }
    
    case "section_create": {
      return this.handleSectionCreate(intent.params, relationContext);
    }
    
    case "content_update": {
      return this.handleContentUpdate(intent.params, relationContext);
    }
    
    case "backup": {
      return this.handleBackup(intent.params, relationContext);
    }
    
    case "revenue_analysis": {
      return this.handleRevenueAnalysis(intent.params, relationContext);
    }
    
    // ... 20+ intent آخر
    
    default: {
      return this.respondConversationally(userMessage, context, intent);
    }
  }
}
```

### 1.3 ربط نظام الموافقات بالأدوات الحقيقية

**المشكلة:** 
- `security-manager.ts` ينفذ عبر `architect-tools.executeTool`
- الأدوات الحقيقية في `real-tool-executor.ts`

**الحل:**
توحيد عبر Tool Registry:

```typescript
// security-manager.ts
import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";

export async function executeApprovedAction(
  approvalId: string,
  relationContext?: RelationContext
): Promise<ExecutionResult> {
  const tool = TOOL_REGISTRY[action.toolName];
  
  // 1. تسجيل بدء التنفيذ
  const execution = await createExecutionRecord(action, relationContext);
  
  // 2. تنفيذ الأداة الفعلية
  const result = await tool.handler(action.params, {
    ...relationContext,
    executionId: execution.id,
  });
  
  // 3. تحديث سجل التنفيذ
  await updateExecutionRecord(execution.id, result);
  
  // 4. إذا فشلت ويمكن التراجع
  if (!result.success && tool.rollbackHandler) {
    await tool.rollbackHandler(action.params, relationContext);
  }
  
  return result;
}
```

---

## المرحلة 2: تحديث قاعدة البيانات
**المدة المتوقعة: 2-3 أيام**

### 2.1 Migration 032: Content Update Support

```sql
-- إضافة دعم content_update
ALTER TABLE content_revisions 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) NOT NULL DEFAULT 'site_section',
ADD COLUMN IF NOT EXISTS content_id UUID,
ADD COLUMN IF NOT EXISTS field_path TEXT[], -- للحقول المتداخلة
ADD COLUMN IF NOT EXISTS diff_json JSONB; -- diff محسن

-- جدول جديد للمحتوى القابل للتحديث
CREATE TABLE IF NOT EXISTS content_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- 'site_section', 'room', 'product', 'blog_post'
    entity_id UUID NOT NULL,
    content_key VARCHAR(100) NOT NULL, -- 'title', 'description', 'content.body'
    content_value JSONB NOT NULL,
    content_schema JSONB, -- JSON Schema للتحقق
    current_revision_id UUID REFERENCES content_revisions(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- فهرسة للبحث السريع
CREATE INDEX idx_content_entities_type ON content_entities(entity_type);
CREATE INDEX idx_content_entities_revision ON content_entities(current_revision_id);
```

### 2.2 Migration 033: Real-time Metrics Tables

```sql
-- جدول للـ real-time visitor analytics
CREATE TABLE IF NOT EXISTS visitor_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL,
    session_start TIMESTAMP NOT NULL DEFAULT NOW(),
    session_end TIMESTAMP,
    page_views INTEGER DEFAULT 0,
    bounce BOOLEAN DEFAULT false,
    device_type VARCHAR(20), -- mobile, desktop, tablet
    referrer VARCHAR(255),
    landing_page VARCHAR(255),
    exit_page VARCHAR(255),
    country VARCHAR(100),
    session_duration_seconds INTEGER
);

-- Aggregate table للـ metrics الحقيقية
CREATE TABLE IF NOT EXISTS metrics_hourly (
    hour TIMESTAMP NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'visitors', 'page_views', 'conversions'
    value INTEGER NOT NULL,
    dimension JSONB, -- {source: 'organic', device: 'mobile'}
    PRIMARY KEY (hour, metric_type)
);

-- Functions for automatic aggregation
CREATE OR REPLACE FUNCTION calculate_real_metrics(
    p_start_time TIMESTAMP,
    p_end_time TIMESTAMP
) RETURNS TABLE (
    metric_name VARCHAR,
    metric_value NUMERIC,
    details JSONB
) AS $$
BEGIN
    -- Real bounce rate calculation
    RETURN QUERY
    SELECT 
        'bounce_rate'::VARCHAR,
        (COUNT(*) FILTER (WHERE bounce = true)::NUMERIC / NULLIF(COUNT(*), 0) * 100),
        jsonb_build_object('total_sessions', COUNT(*))
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time;
    
    -- Real session duration
    RETURN QUERY
    SELECT 
        'avg_session_duration'::VARCHAR,
        AVG(session_duration_seconds)::NUMERIC,
        jsonb_build_object('min', MIN(session_duration_seconds), 'max', MAX(session_duration_seconds))
    FROM visitor_sessions
    WHERE session_start BETWEEN p_start_time AND p_end_time;
    
    -- Real returning visitors
    RETURN QUERY
    SELECT 
        'returning_visitors_rate'::VARCHAR,
        (COUNT(DISTINCT visitor_id) FILTER (WHERE session_count > 1)::NUMERIC / 
         NULLIF(COUNT(DISTINCT visitor_id), 0) * 100),
        jsonb_build_object('total_unique', COUNT(DISTINCT visitor_id))
    FROM (
        SELECT visitor_id, COUNT(*) as session_count
        FROM visitor_sessions
        WHERE session_start BETWEEN p_start_time AND p_end_time
        GROUP BY visitor_id
    ) sessions;
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Migration 034: Goals & Scheduling System

```sql
-- جدول الأهداف المتقدم
CREATE TABLE IF NOT EXISTS agent_goals_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    goal_type VARCHAR(50) NOT NULL, -- 'metric_target', 'task_completion', 'system_health'
    target_metrics JSONB NOT NULL, -- {metric: 'conversion_rate', target: 0.05, current: 0.03}
    deadline TIMESTAMP,
    priority INTEGER DEFAULT 5, -- 1-10
    status VARCHAR(20) DEFAULT 'active', -- active, paused, completed, failed
    auto_check_enabled BOOLEAN DEFAULT false,
    check_frequency VARCHAR(20), -- hourly, daily, weekly
    last_checked_at TIMESTAMP,
    next_check_at TIMESTAMP,
    related_entity_type VARCHAR(50), -- 'section', 'product', 'campaign'
    related_entity_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- جدول الـ Scheduled Tasks
CREATE TABLE IF NOT EXISTS agent_scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(100) NOT NULL, -- 'proactive_check', 'backup', 'seo_audit'
    schedule_expression VARCHAR(100) NOT NULL, -- cron expression or 'every 6 hours'
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    run_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    parameters JSONB,
    notification_channels JSONB -- {telegram: true, email: 'admin@...'}
);

-- Function for next run calculation
CREATE OR REPLACE FUNCTION calculate_next_run(
    p_schedule VARCHAR,
    p_last_run TIMESTAMP
) RETURNS TIMESTAMP AS $$
BEGIN
    -- Parse cron-like expressions
    IF p_schedule LIKE 'every %' THEN
        RETURN p_last_run + INTERVAL '1 hour' * 
            CAST(REPLACE(REPLACE(p_schedule, 'every ', ''), ' hours', '') AS INTEGER);
    END IF;
    
    -- Default fallback
    RETURN p_last_run + INTERVAL '6 hours';
END;
$$ LANGUAGE plpgsql;
```

### 2.4 Migration 035: Backup Restore Support

```sql
-- إضافة دعم استعادة النسخ الاحتياطية
ALTER TABLE backup_snapshots
ADD COLUMN IF NOT EXISTS restore_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS restore_validation_result JSONB,
ADD COLUMN IF NOT EXISTS tables_restoreable JSONB;

-- جدول سجل عمليات الاستعادة
CREATE TABLE IF NOT EXISTS backup_restore_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id UUID REFERENCES backup_snapshots(id),
    restored_by UUID REFERENCES users(id),
    restore_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    restore_completed_at TIMESTAMP,
    restore_status VARCHAR(20) DEFAULT 'in_progress', -- in_progress, completed, failed, partial
    tables_affected JSONB,
    records_restored INTEGER,
    records_skipped INTEGER,
    conflict_resolution VARCHAR(20), -- overwrite, skip, merge
    validation_result JSONB,
    error_log TEXT
);

-- Function للتحقق من صلاحية الاستعادة
CREATE OR REPLACE FUNCTION validate_backup_restore(
    p_backup_id UUID
) RETURNS TABLE (
    is_valid BOOLEAN,
    can_restore_full BOOLEAN,
    can_restore_partial BOOLEAN,
    missing_tables TEXT[],
    validation_message TEXT
) AS $$
DECLARE
    v_backup RECORD;
    v_current_tables TEXT[];
BEGIN
    SELECT * INTO v_backup FROM backup_snapshots WHERE id = p_backup_id;
    
    IF v_backup IS NULL THEN
        RETURN QUERY SELECT false, false, false, ARRAY['backup_not_found']::TEXT[], 
            'Backup not found'::TEXT;
        RETURN;
    END IF;
    
    -- Check checksum integrity
    IF NOT v_backup.integrity_verified THEN
        RETURN QUERY SELECT false, false, false, ARRAY['integrity_failed']::TEXT[],
            'Backup integrity check failed'::TEXT;
        RETURN;
    END IF;
    
    -- Check expiration
    IF v_backup.expires_at < NOW() THEN
        RETURN QUERY SELECT false, false, false, ARRAY['expired']::TEXT[],
            'Backup has expired'::TEXT;
        RETURN;
    END IF;
    
    -- All checks passed
    RETURN QUERY SELECT true, true, true, ARRAY[]::TEXT[],
        'Backup is valid and ready for restore'::TEXT;
END;
$$ LANGUAGE plpgsql;
```

---

## المرحلة 3: تطوير API Routes
**المدة المتوقعة: 2-3 أيام**

### 3.1 إنشاء Tool Execution API Unified

**الملف:** `app/api/admin/agent/tools/execute/route.ts`

```typescript
/**
 * Unified Tool Execution API
 * 
 * Endpoint واحد لتنفيذ جميع أدوات الوكيل مع:
 * - Execution tracking
 * - Approval workflow
 * - Rollback support
 * - Real-time notifications
 */

import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";
import { createExecutionRecord } from "@/lib/agent-tools/execution-tracker";

export async function POST(req: Request) {
  const { toolName, params, requireApproval = false, skipApproval = false } = await req.json();
  
  // 1. Validate tool exists
  const tool = TOOL_REGISTRY[toolName];
  if (!tool) {
    return Response.json({ success: false, error: `Unknown tool: ${toolName}` }, { status: 400 });
  }
  
  // 2. Check approval requirement
  if (tool.requiresApproval && !skipApproval) {
    const approval = await createApprovalRequest(toolName, params, relationContext);
    return Response.json({
      success: true,
      requiresApproval: true,
      approvalId: approval.id,
      message: "Approval required",
    });
  }
  
  // 3. Create execution record
  const execution = await createExecutionRecord({
    toolName,
    params,
    status: 'running',
    relationContext,
  });
  
  // 4. Execute tool
  try {
    const result = await tool.handler(params, {
      ...relationContext,
      executionId: execution.id,
    });
    
    // 5. Update execution record
    await updateExecutionRecord(execution.id, {
      status: result.success ? 'completed' : 'failed',
      result: result.data,
      error: result.error,
    });
    
    // 6. Store for UI retrieval
    await cacheExecutionResult(execution.id, result);
    
    return Response.json({
      success: result.success,
      executionId: execution.id,
      data: result.data,
      error: result.error,
    });
    
  } catch (error) {
    await updateExecutionRecord(execution.id, {
      status: 'failed',
      error: error.message,
    });
    
    return Response.json({
      success: false,
      executionId: execution.id,
      error: error.message,
    }, { status: 500 });
  }
}
```

### 3.2 Preview Route للأقسام

**الملف:** `app/preview/section/[id]/page.tsx`

```typescript
/**
 * Section Preview Route
 * 
 * عرض قسم حقيقي قبل نشره
 */

import { createClient } from "@/utils/supabase/server";

export default async function SectionPreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  
  // Fetch section from database
  const { data: section } = await supabase
    .from("site_sections")
    .select("*")
    .eq("id", params.id)
    .single();
  
  if (!section) {
    return <div>Section not found</div>;
  }
  
  // Render section with preview wrapper
  return (
    <div className="preview-container">
      <div className="preview-banner">
        معاينة القسم: {section.section_name}
        <button>نشر</button>
        <button>تعديل</button>
      </div>
      <SectionRenderer 
        type={section.section_type}
        config={section.section_config}
        content={section.section_content}
      />
    </div>
  );
}
```

### 3.3 Metrics API Real-time

**الملف:** `app/api/admin/metrics/realtime/route.ts`

```typescript
/**
 * Real-time Metrics API
 * 
 * يعيد metrics حقيقية من قاعدة البيانات بدون estimates
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const startTime = searchParams.get("start") || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const endTime = searchParams.get("end") || new Date().toISOString();
  
  const supabase = await createClient();
  
  // Get real metrics using database function
  const { data: metrics, error } = await supabase
    .rpc("calculate_real_metrics", {
      p_start_time: startTime,
      p_end_time: endTime,
    });
  
  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
  
  // Transform to expected format
  const result = {
    visitors: {
      total: metrics.find(m => m.metric_name === 'total_visitors')?.metric_value || 0,
      unique: metrics.find(m => m.metric_name === 'unique_visitors')?.metric_value || 0,
      new: metrics.find(m => m.metric_name === 'new_visitors')?.metric_value || 0,
      returning: metrics.find(m => m.metric_name === 'returning_visitors')?.metric_value || 0,
    },
    performance: {
      bounceRate: metrics.find(m => m.metric_name === 'bounce_rate')?.metric_value || 0,
      avgSessionDuration: metrics.find(m => m.metric_name === 'avg_session_duration')?.metric_value || 0,
    },
    // ... other metrics
  };
  
  return Response.json({ success: true, data: result });
}
```

### 3.4 Goals CRUD API

**الملف:** `app/api/admin/agent/goals/route.ts`

```typescript
/**
 * Goals Management API
 * 
 * CRUD operations for agent goals with auto-check scheduling
 */

// POST /api/admin/agent/goals - Create goal
// GET /api/admin/agent/goals - List goals  
// PATCH /api/admin/agent/goals/[id] - Update goal
// DELETE /api/admin/agent/goals/[id] - Delete goal
// POST /api/admin/agent/goals/[id]/check - Manual check
```

---

## المرحلة 4: تحديث UI Components
**المدة المتوقعة: 2-3 أيام**

### 4.1 UltimateAgentChat.tsx - تمرير البيانات الكاملة

**التعديل المطلوب:**

```typescript
// السطر 196-207 - تغيير كامل
metadata: {
  actionTaken: data.actionTaken,
  requiresApproval: data.requiresApproval,
  approvalId: data.approvalId,
  suggestions: data.suggestions,
  // ✅ تمرير البيانات الحقيقية كاملة
  data: data.data, // لا تصفية!
  executionId: data.executionId,
  timestamp: new Date().toISOString(),
},
```

### 4.2 ProactiveDashboard.tsx - ربط الأزرار

**التعديل المطلوب:**

```typescript
// السطر 431 - نفذ الآن
<Button 
  size="sm"
  onClick={() => executeOpportunity(opp.id)}
  disabled={executingId === opp.id}
>
  {executingId === opp.id ? <Loader2 className="animate-spin" /> : <Play />}
  نفذ الآن
</Button>

// السطر 436 - ذكرني لاحقاً
<Button 
  variant="outline" 
  size="sm"
  onClick={() => scheduleOpportunity(opp.id, 'reminder')}
>
  <Bell className="h-4 w-4 mr-2" />
  ذكرني لاحقاً
</Button>

// السطر 480 - تنفيذ الإصلاح
<Button 
  size="sm"
  onClick={() => executeFix(anomaly.id)}
>
  <CheckCircle className="h-4 w-4 mr-2" />
  تنفيذ الإصلاح
</Button>

// السطر 485 - تجاهل
<Button 
  variant="outline" 
  size="sm"
  onClick={() => dismissAnomaly(anomaly.id)}
>
  تجاهل
</Button>
```

### 4.3 ExecutionResults.tsx - ربط Rollback

**التعديل المطلوب:**

```typescript
// في UltimateAgentChat.tsx
<ExecutionResultCard
  actionTaken={message.metadata.actionTaken}
  data={message.metadata.data}
  executionId={message.metadata.executionId}
  onRollback={async (executionId) => {
    const result = await fetch('/api/admin/agent/rollback', {
      method: 'POST',
      body: JSON.stringify({ executionId }),
    });
    if (result.success) {
      toast.success('تم التراجع بنجاح');
      refreshMessages();
    }
  }}
/>
```

---

## المرحلة 5: إنشاء Execution Tracker
**المدة المتوقعة: 1-2 يوم**

### 5.1 lib/agent-tools/execution-tracker.ts

```typescript
/**
 * Execution Tracker
 * 
 * تتبع تنفيذ جميع الأدوات مع:
 * - Creating execution records
 * - Updating status
 * - Linking to revisions and backups
 * - Rollback support
 */

export async function createExecutionRecord(params: {
  toolName: string;
  params: unknown;
  status: 'pending' | 'running';
  relationContext?: RelationContext;
}): Promise<AgentExecution> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("agent_executions")
    .insert({
      execution_type: params.toolName,
      execution_data: params.params,
      execution_status: params.status,
      company_id: params.relationContext?.companyId,
      actor_user_id: params.relationContext?.actorUserId,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateExecutionRecord(
  executionId: string,
  update: {
    status: 'completed' | 'failed' | 'rolled_back';
    result?: unknown;
    error?: string;
    affectedRows?: number;
    affectedTables?: string[];
  }
): Promise<void> {
  const supabase = await createClient();
  
  await supabase
    .from("agent_executions")
    .update({
      execution_status: update.status,
      execution_result: update.result,
      error_message: update.error,
      affected_rows: update.affectedRows || 0,
      affected_tables: update.affectedTables,
      completed_at: new Date().toISOString(),
    })
    .eq("id", executionId);
}
```

---

## المرحلة 6: Contract Testing
**المدة المتوقعة: 1 يوم**

### 6.1 tests/contracts/agent-api.contract.test.ts

```typescript
/**
 * Contract Tests
 * 
 * ضمان عدم حدوث mismatch بين API والواجهة
 */

describe("Agent API Contracts", () => {
  test("SEO analysis response matches UI expectations", async () => {
    const response = await fetch('/api/admin/agent/tools/execute', {
      method: 'POST',
      body: JSON.stringify({
        toolName: 'seo_analyze',
        params: { url: 'https://example.com' }
      })
    });
    
    const data = await response.json();
    
    // Contract assertions
    expect(data).toHaveProperty('success', expect.any(Boolean));
    expect(data).toHaveProperty('data.score', expect.any(Number));
    expect(data).toHaveProperty('data.issues', expect.any(Array));
    expect(data).toHaveProperty('data.recommendations', expect.any(Array));
    expect(data).toHaveProperty('executionId', expect.any(String));
  });
  
  test("Section create response matches UI expectations", async () => {
    // Similar contract tests for all tools
  });
});
```

---

## الجدول الزمني المقترح

| الأسبوع | الأيام | المرحلة | Deliverables |
|---------|--------|---------|--------------|
| 1 | 1-4 | Core Architecture | Tool Registry, Fixed agent-core.ts, Unified approval system |
| 1 | 5-7 | Database Migrations | 032-035 migrations, Real metrics tables |
| 2 | 1-3 | API Development | Unified execute API, Preview routes, Goals API |
| 2 | 4-6 | UI Updates | Fixed UltimateAgentChat, Connected ProactiveDashboard, Rollback UI |
| 2 | 7 | Testing & QA | Contract tests, Integration tests, Bug fixes |

---

## نقاط التفتيش (Checkpoints)

بعد كل مرحلة، يجب التحقق من:

- [ ] **بعد المرحلة 1:** جميع الأدوات تستخدم Tool Registry الموحد
- [ ] **بعد المرحلة 2:** جميع الميجريشنات تطبق بنجاح
- [ ] **بعد المرحلة 3:** جميع APIs ترد بـ payload كامل بدون تصفية
- [ ] **بعد المرحلة 4:** جميع أزرار UI تعمل فعلياً
- [ ] **بعد المرحلة 5:** Contract tests تمر بنجاح

---

## المخاطر والحلول

| المخطر | الحل |
|--------|------|
| تعارض مع AACA | AACA في مجلد منفصل، لا يتعارض |
| فشل في migrations | اختبار على dev first، backup قبل التطبيق |
| Performance issues | إضافة indexes، caching للـ metrics |
| UI breaking changes | Component tests، gradual rollout |

---

## الخلاصة

هذه الخطة تحول الوكيل التنفيذي من **70% حقيقي** إلى **100% حقيقي** عبر:

1. **توحيد الأدوات** - مصدر واحد للحقيقة
2. **تكامل قاعدة البيانات** - جداول حقيقية للـ metrics والـ goals
3. **APIs كاملة** - بيانات حقيقية بدون تصفية
4. **UI متصل** - كل زر يعمل فعلياً
5. **اختبارات Contract** - ضمان عدم تكرار المشاكل

**هل تريد أن أبدأ تنفيذ المرحلة الأولى؟**
