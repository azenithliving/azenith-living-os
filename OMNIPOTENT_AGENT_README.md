# الوكيل الشامل (Omnipotent Agent)

## نظرة عامة
تم بناء نظام الوكيل الشامل لـ Azenith Living OS - نظام ذكي قادر على استكشاف النظام بأكمله ديناميكياً، واتخاذ قرارات استباقية، وتنفيذ أي إجراء معقول دون تقييد بأدوات محددة.

## المكونات الرئيسية

### 1. محرك الاستكشاف الديناميكي (Discovery Engine)
**الملف:** `lib/discovery-engine.ts`

**القدرات:**
- استكشاف جميع جداول قاعدة البيانات من `information_schema`
- مسح مجلد `app/api` لاستخراج نقاط النهاية
- تحليل هيكل الملفات في `app/`
- قراءة الإعدادات وقواعد الأتمتة
- توليد وصف طبيعي بالعربية لكل موارد النظام

**الدوال الرئيسية:**
```typescript
discoverDatabaseSchema()     // استكشاف الجداول
discoverApiEndpoints()         // استكشاف APIs
discoverPages()                // استكشاف الصفحات
discoverAutomationRules()      // استكشاف قواعد الأتمتة
generateSystemSnapshot()       // لقطة شاملة للنظام
getSystemOverview()            // نظرة عامة سريعة
```

### 2. محرك التخطيط والتنفيذ العام (General Agent)
**الملف:** `lib/general-agent.ts`

**القدرات:**
- استخدام LLM (Claude/GPT) لوضع خطط تنفيذية
- تنفيذ SQL آمن (SELECT فقط)
- استدعاء APIs الداخلية
- تحديث الإعدادات
- إرسال إشعارات

**الدوال الرئيسية:**
```typescript
generateExecutionPlan(request)  // توليد خطة بالذكاء الاصطناعي
executePlan(plan)               // تنفيذ الخطة
processQuery(query)             // معالجة سؤال المستخدم
storeSuggestion(...)            // تخزين اقتراح
executeStoredSuggestion(id)     // تنفيذ اقتراح مخزن
```

### 3. الوكيل الاستباقي (Proactive Agent)
**الملف:** `lib/proactive-agent.ts`

**القدرات:**
- عمل في الخلفية كل 6 ساعات (cron job)
- فحص الأداء تلقائياً
- قراءة السجلات واكتشاف البيانات غير العادية
- توليد اقتراحات مفتوحة غير محددة

**التحققات:**
```typescript
checkAutomationRules()      // قواعد لم تنفذ منذ 7 أيام
checkUnusedFeatures()       // جداول فارغة، APIs غير مستخدمة
checkPerformanceIssues()    // جداول كبيرة، مشاكل الأداء
checkDataAnomalies()        // مستخدمين غير نشطين
checkImageOptimization()    // صور كبيرة جداً
checkUserBehaviorPatterns() // فرص بناءً على سلوك المستخدمين
```

### 4. قاعدة البيانات
**الملف:** `supabase/migrations/028_general_suggestions.sql`

**الجداول:**
- `general_suggestions` - تخزين الاقتراحات الذكية
- `monitoring_logs` - سجلات المراقبة التلقائية
- `api_logs` - سجلات استخدام APIs

**الحقول المرنة:**
- `proposed_plan` (JSONB) - خطة التنفيذ الكاملة
- `execution_result` (JSONB) - نتائج التنفيذ
- `status` - pending, approved, rejected, executed

### 5. واجهة المستخدم
**الملف:** `components/admin/SmartSuggestions.tsx`

**الموقع:** `/admin/intel` → تبويب "المقترحات الذكية"

**المميزات:**
- عرض جميع الاقتراحات مع التصفية
- زر "تفاصيل" لعرض الخطة التنفيذية
- زر "نفذ" للموافقة على الاقتراح
- زر "رفض" لرفض الاقتراح
- واجهة دردشة للوكيل الذكي

### 6. نقاط النهاية (API Endpoints)
**الملف:** `app/api/omnipotent/route.ts`

**الإجراءات:**
- `query` - معالجة سؤال
- `execute` - تنفيذ اقتراح
- `reject` - رفض اقتراح
- `monitor` - تشغيل فحص يدوي
- `snapshot` - لقطة للنظام
- `suggestions` - قائمة الاقتراحات

**الملف:** `app/api/cron/autonomous-monitoring/route.ts`
- يعمل كل 6 ساعات
- يتطلب `CRON_SECRET` للمصادقة

## الأمان

### حماية SQL
```typescript
// مسموح
SELECT * FROM users WHERE id = 1;

// غير مسموح
DROP, TRUNCATE, DELETE بدون شرط, UPDATE, INSERT, ALTER
```

### حماية API
- يقتصر على endpoints الداخلية فقط (`/api/*`)
- يتطلب `X-Internal-Key` للمصادقة

### الموافقة على العمليات الخطرة
- أي خطوة ذات `riskLevel: "high"` تتطلب موافقة منفصلة
- `requiresApproval: true` يمنع التنفيذ التلقائي

## الأوامر الاختبارية

### 1. اكتشاف الجداول
```bash
curl -X POST http://localhost:3000/api/omnipotent \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: your-key" \
  -d '{"action":"query","query":"عايز تعرفلي إيه الجداول الموجودة في قاعدة البيانات؟"}'
```

### 2. عدد المستخدمين
```bash
curl -X POST http://localhost:3000/api/omnipotent \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: your-key" \
  -d '{"action":"query","query":"كم عدد المستخدمين المسجلين؟"}'
```

### 3. خطة ضغط الصور
```bash
curl -X POST http://localhost:3000/api/omnipotent \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: your-key" \
  -d '{"action":"query","query":"لاحظت أن صور غرف النوم كبيرة، اعمل لي خطة لضغطها"}'
```

### 4. اقتراحات تحسين الأتمتة
```bash
curl -X POST http://localhost:3000/api/omnipotent \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: your-key" \
  -d '{"action":"query","query":"اقترح تحسينات للأتمتة بناءً على آخر 7 أيام"}'
```

## الإعداد

### 1. متغيرات البيئة
```env
OPENROUTER_API_KEY=sk-or-v1-...          # أو OPENAI_API_KEY
INTERNAL_API_KEY=your-internal-key       # لمصادقة API
CRON_SECRET=your-cron-secret             # لحماية cron job
ENABLE_SELF_EXECUTION=true               # لتفعيل التنفيذ الذاتي (اختياري)
```

### 2. تطبيق Migration
```bash
npx supabase migration up
# أو
psql -d your_database -f supabase/migrations/028_general_suggestions.sql
```

### 3. إعداد Cron Job (Vercel)
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/autonomous-monitoring",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## الاستخدام

### من الواجهة
1. اذهب إلى `/admin/intel`
2. اختر تبويب "المقترحات الذكية"
3. استخدم مربع الدردشة للسؤال الوكيل
4. راجع الاقتراحات ووافق على التنفيذ

### برمجياً
```typescript
import { processQuery, generateExecutionPlan } from "@/lib/general-agent";
import { runAutonomousMonitoring } from "@/lib/proactive-agent";

// سؤال الوكيل
const result = await processQuery("حلل أداء الموقع");
console.log(result.response);

// توليد خطة
const plan = await generateExecutionPlan("حسّن صفحات الأثاث");
console.log(plan.steps);

// تشغيل مراقبة يدوية
await runAutonomousMonitoring();
```

## المميزات

✅ **بدون أدوات محددة** - يكتشف الإجراءات بنفسه
✅ **360 درجة** - يدير الموقع بالكامل
✅ **استباقي** - يكتشف المشاكل قبل حدوثها
✅ **آمن** - يحترم حدود الصلاحيات
✅ **قابل للتعلم** - يحسن أداءه من التجربة
✅ **عربي بالكامل** - واجهة وخطة واقتراحات بالعربية

## تطوير مستقبلي

- [ ] تعلم من تاريخ التنفيذ
- [ ] توقع المشاكل قبل حدوثها
- [ ] تكامل مع أدوات خارجية
- [ ] تقارير أسبوعية تلقائية
- [ ] وضع "خبير" للتوصيات المتقدمة

---

**تم البناء بواسطة:** Cascade AI
**التاريخ:** أبريل 2026
**الإصدار:** 1.0.0
