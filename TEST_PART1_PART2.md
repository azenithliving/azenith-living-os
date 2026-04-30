# اختبارات Part 1 و Part 2
## دليل التحقق من تنفيذ الخطة

---

## ✅ Part 1 Tests (Foundation)

### 1. Database Migrations (اختبار الـ Migrations)

```bash
# اختبار 1: تشغيل الـ Migrations
npm run supabase:push

# النتيجة المتوقعة:
# ✓ 20260423_reconciliation.sql - تم التنفيذ
# ✓ 20260423_manufacturing.sql - تم التنفيذ
# ✓ 20260423_agents.sql - تم التنفيذ
```

**الجداول المطلوبة (34 جدول):**
- [ ] `users` (مع `auth_user_id`)
- [ ] `requests` (مع `manufacturing_stage`)
- [ ] `sales_orders`
- [ ] `sales_order_items`
- [ ] `payment_schedules`
- [ ] `production_stages`
- [ ] `production_jobs`
- [ ] `production_job_events`
- [ ] `production_schedule_entries`
- [ ] `design_versions`
- [ ] `bom_headers`
- [ ] `bom_items`
- [ ] `inventory_items`
- [ ] `inventory_movements`
- [ ] `inventory_reservations`
- [ ] `quality_checks`
- [ ] `delivery_records`
- [ ] `agent_profiles` (مع PRIME و Vanguard)
- [ ] `agent_devices`
- [ ] `agent_device_heartbeats`
- [ ] `agent_tasks`
- [ ] `agent_task_dependencies`
- [ ] `agent_task_runs`
- [ ] `agent_conversations`
- [ ] `agent_messages`
- [ ] `agent_handoffs`
- [ ] `agent_events`
- [ ] `agent_learnings`
- [ ] `agent_memory`
- [ ] `owner_policies`
- [ ] `emergency_stop_state`
- [ ] `alert_rules`
- [ ] `daily_digests`

### 2. Unified DAL (اختبار طبقة الداتا)

```typescript
// اختبار 2: استيراد الـ DAL
import { supabaseServer, agentTasksDAL } from '@/lib/dal/unified-supabase';

// النتيجة المتوقعة: ✓ لا يوجد أخطاء
```

- [ ] `supabaseServer` متاح
- [ ] `supabaseAnon` متاح
- [ ] `usersDAL.getById()` تعمل
- [ ] `agentTasksDAL.getPending()` تعمل
- [ ] `agentDevicesDAL.getOnline()` تعمل

### 3. Build Safeguards (اختبار البناء)

```bash
# اختبار 3: TypeScript Check
npm run typecheck

# النتيجة المتوقعة: ✓ لا يوجد أخطاء
```

```bash
# اختبار 4: ESLint Check
npm run lint

# النتيجة المتوقعة: ✓ لا يوجد أخطاء
```

```bash
# اختبار 5: Build
npm run build

# النتيجة المتوقعة: ✓ Build ناجح
```

### 4. Docker (اختبار Docker)

```bash
# اختبار 6: تشغيل Docker
docker-compose -f docker-compose.browser-workspace.yml up -d

# النتيجة المتوقعة:
# ✓ powerhouse-alpha شغال
# ✓ powerhouse-beta شغال
# ✓ browser-workspace شغال
```

```bash
# اختبار 7: Health Check
curl http://localhost:3002/health
curl http://localhost:3003/health

# النتيجة المتوقعة:
# {"status": "ok", "node": "powerhouse-alpha"}
# {"status": "ok", "node": "powerhouse-beta"}
```

### 5. API Routes (اختبار المسارات)

```bash
# اختبار 8: Heartbeat API
curl -X POST http://localhost:3000/api/admin/agents/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"device_key": "powerhouse-alpha", "status": "online"}'

# النتيجة المتوقعة: {"success": true}
```

```bash
# اختبار 9: Devices API
curl http://localhost:3000/api/admin/agents/devices

# النتيجة المتوقعة: قائمة الأجهزة
```

```bash
# اختبار 10: Tasks API
curl http://localhost:3000/api/admin/agents/tasks

# النتيجة المتوقعة: قائمة المهام
```

---

## ✅ Part 2 Tests (Services & UI)

### 6. Services (اختبار الخدمات)

```typescript
// اختبار 11: Agent Scheduler
import { agentScheduler } from '@/services/agent-scheduler';
const result = await agentScheduler.getPendingTasks('prime', 10);
// النتيجة المتوقعة: ✓ مصفوفة من المهام

// اختبار 12: Auto Schedule
const schedule = await agentScheduler.autoSchedule('task-id-here');
// النتيجة المتوقعة: ✓ { success: true, deviceKey: 'powerhouse-alpha' }
```

```typescript
// اختبار 13: Local Storage
import { localStorage } from '@/services/local-storage';
await localStorage.storeSecurely('test-key', { foo: 'bar' }, 'user-id');
const data = await localStorage.retrieveSecurely('test-key', 'user-id');
// النتيجة المتوقعة: ✓ { foo: 'bar' }
```

```typescript
// اختبار 14: Offline Queue
import { offlineQueue } from '@/services/offline-queue';
const id = await offlineQueue.enqueue('test-action', {}, 'company-id');
// النتيجة المتوقعة: ✓ string (task id)
```

```typescript
// اختبار 15: Browser Voice
import { browserVoice } from '@/services/browser-voice';
const config = browserVoice.getTTSConfig();
// النتيجة المتوقعة: ✓ { language: 'ar-SA', ... }
```

```typescript
// اختبار 16: WhatsApp Templates
import { freeWhatsApp } from '@/services/free-whatsapp';
const result = await freeWhatsApp.sendTemplate(
  '201234567890',
  'order_confirmation',
  { customer_name: 'Test', order_number: '123', total_amount: '5000 EGP' }
);
// النتيجة المتوقعة: ✓ true
```

### 7. UI Components (اختبار الواجهة)

```bash
# اختبار 17: فتح صفحة الـ Agents
http://localhost:3000/admin/agents

# المكونات المطلوبة:
- [ ] DeviceCard - يعرض الأجهزة
- [ ] TaskQueue - يعرض المهام
- [ ] CommandConsole - يستقبل الأوامر
- [ ] ApprovalGate - يعرض طلبات الموافقة
```

### 8. Chat (اختبار المحادثات)

```bash
# اختبار 18: Messages API
curl -X POST http://localhost:3000/api/admin/agents/messages \
  -H "Content-Type: application/json" \
  -d '{
    "agent_key": "prime",
    "content": "مرحباً PRIME",
    "sender_type": "user"
  }'

# النتيجة المتوقعة: {"success": true, "data": { ... }}
```

```bash
# اختبار 19: جلب الرسائل
curl http://localhost:3000/api/admin/agents/messages?agent_key=prime

# النتيجة المتوقعة: قائمة الرسائل
```

---

## 🚀 Quick Test Script

افتح terminal ونفذ:

```bash
# 1. خش المشروع
cd "d:\Program Files\azenith living\my-app"

# 2. شغل Docker
docker-compose -f docker-compose.browser-workspace.yml up -d

# 3. استنى 10 ثواني
sleep 10

# 4. اختبر الـ health
curl http://localhost:3002/health
curl http://localhost:3003/health

# 5. شغل السيرفر
npm run dev

# 6. افتح المتصفح
start http://localhost:3000/admin/agents
```

---

## ✅ Success Criteria

**Part 1 يعتبر ناجح لو:**
- [ ] كل الـ 34 جدول موجود
- [ ] Build يعدي بدون أخطاء
- [ ] Docker شغال
- [ ] API Routes تستجيب

**Part 2 يعتبر ناجح لو:**
- [ ] كل الـ Services تشتغل
- [ ] UI Components تظهر
- [ ] Chat يبعت ويستقبل
- [ ] الصفحة `/admin/agents` تفتح

---

## ❌ Common Issues

### Issue 1: Build Errors
```
Error: Cannot find module '@/lib/dal/unified-supabase'
```
**الحل:** تأكد إن الملف موجود في `lib/dal/unified-supabase.ts`

### Issue 2: Docker Not Running
```
Error: No such container
```
**الحل:** شغل Docker Desktop الأول

### Issue 3: Database Connection
```
Error: connect ECONNREFUSED
```
**الحل:** تأكد إن Supabase URL صحيح في `.env.local`

---

## 📊 Test Results Template

| Test | Status | Notes |
|------|--------|-------|
| Database Migrations | ⏳ | |
| Unified DAL | ⏳ | |
| TypeScript Check | ⏳ | |
| ESLint Check | ⏳ | |
| Build | ⏳ | |
| Docker | ⏳ | |
| API Routes | ⏳ | |
| Services | ⏳ | |
| UI Components | ⏳ | |
| Chat | ⏳ | |

**تاريخ الاختبار:** ___/___/______

**المجموع:** ___/10 ناجح
