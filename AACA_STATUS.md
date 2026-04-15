# AACA Phoenix - حالة نظام الوكلاء (Agent Status)

> **Azenith Autonomous Company AI System (AACA)**
> آخر تحديث: 2026-04-14

## نظرة عامة

AACA هو نظام متعدد الوكلاء (Multi-Agent AI) يعمل بشكل مستقل لإدارة تطوير المشروع ومراقبة الأداء والتواصل.

## حالة الوكلاء (Agents Status)

| الوكيل | الملف | الحالة | الوصف |
|--------|-------|--------|-------|
| **Orchestrator** | `orchestrator-service.ts` | ✅ نشط | المنسق الرئيسي - يدير توزيع المهام بين الوكلاء |
| **Dev Agent** | `dev-agent-service.ts` | ✅ نشط | تطوير البرمجيات - إنشاء الكود وإصلاح الأخطاء |
| **Ops Agent** | `ops-agent-service.ts` | ✅ نشط | العمليات - مراقبة الأداء والبنية التحتية |
| **Security Agent** | `security-agent-service.ts` | ✅ نشط | الأمان - فحص الثغرات وتطبيق معايير الأمان |
| **QA Agent** | `qa-agent-service.ts` | ✅ نشط | ضمان الجودة - اختبار الكود والتحقق من الجودة |
| **Communication Agent** | `communication-agent-service.ts` | ⚠️ قيد التطوير | إدارة WhatsApp والإشعارات والتواصل مع العملاء |
| **Evolution Agent** | `evolution-agent-service.ts` | ⚠️ قيد التطوير | التطور الذاتي - اقتراح تحسينات وميزات جديدة |

## تفاصيل الحالة

### ✅ نشط (Active)
الوكلاء التالية تعمل بشكل كامل ومتصلة بنظام AACA الرئيسي:
- Orchestrator
- Dev Agent
- Ops Agent
- Security Agent
- QA Agent

### ⚠️ قيد التطوير (In Development)
الوكلاء التالية تم إنشاؤها ولكنها تحتاج إعدادات إضافية:

#### Communication Agent
- **الوظيفة:** إدارة WhatsApp وإرسال الإشعارات للعملاء
- **الميزات المخططة:**
  - إرسال رسائل WhatsApp تلقائية
  - إشعارات البريد الإلكتروني
  - لوحة تحكم للرسائل
- **الاعتمادات المطلوبة:**
  - `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
  - `TELEGRAM_BOT_TOKEN` (اختياري)

#### Evolution Agent
- **الوظيفة:** اقتراح تحسينات ذاتية للنظام
- **الميزات المخططة:**
  - تحليل الكود واقتراح تحسينات
  - اكتشاف فرص الميزات الجديدة
  - محاكاة التغييرات قبل التنفيذ
- **الإعدادات:**
  - `autoPropose: false` (يتطلب موافقة يدوية)
  - `maxProposalsPerDay: 5`

## الاستخدام في المشروع

### كيفية استيراد AACA

```typescript
// استيراد النظام الكامل
import { createAACASystem, startAACASystem } from '@/aaca';

// بدء النظام
const system = await startAACASystem({
  port: 3001,
  redisUrl: process.env.REDIS_URL,
  databaseUrl: process.env.DATABASE_URL
});
```

### الوكلاء المستخدمة في `aaca/index.ts`

جميع الوكلاء السبعة مُهيأة في الملف الرئيسي:

```typescript
// السطور 179-201 في aaca/index.ts
this.orchestrator = getOrchestratorService(...);
this.devAgent = getDevAgentService(...);
this.opsAgent = getOpsAgentService(...);
this.securityAgent = getSecurityAgentService(...);
this.qaAgent = getQAAgentService(...);
this.communicationAgent = getCommunicationAgentService(...);
this.evolutionAgent = getEvolutionAgentService(...);
```

وكلها مُسجلة في Queue Workers (السطور 204-251):
- `dev-agent`: 2 workers
- `ops-agent`: 2 workers
- `security-agent`: 1 worker
- `qa-agent`: 2 workers
- `communication-agent`: 3 workers
- `evolution-agent`: 1 worker

## ملاحظات هامة

1. **لا توجد وكلاء متوقفة تمامًا** - جميع الوكلاء موجودة في النظام ولكن بعضها يحتاج إعدادات إضافية.

2. **Communication Agent** يحتاج:
   - تكوين SMTP صالح
   - أو تكوين Telegram Bot

3. **Evolution Agent** يعمل في وضع `requireApproval: true` - أي اقتراحات تتطلب موافقة يدوية.

4. **لا يُنصح بحذف أي وكيل** حاليًا - كلها جزء من رؤية AACA المتكاملة.

## الخطوات المقترحة

### قصيرة المدى
- [ ] إعداد متغيرات البيئة لـ Communication Agent
- [ ] اختبار إرسال بريد إلكتروني تجريبي
- [ ] تفعيل Evolution Agent على مهام بسيطة

### متوسطة المدى
- [ ] إنشاء واجهة مستخدم لإدارة الوكلاء
- [ ] إضافة مؤشرات أداء (Metrics) لكل وكيل
- [ ] ربط Communication Agent بنظام الإشعارات الحالي

---

**التوثيق بواسطة:** Azenith Development Team  
**الإصدار:** 1.0.0
