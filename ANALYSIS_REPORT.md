# تقرير تحليل شامل: العمليات والأتمتة + الاستخبارات والتطوير
## Azenith Living OS - تحليل 100% للأجزاء الإدارية

**تاريخ التقرير:** أبريل 2026  
**المحلل:** AI Architect Assistant  
**نطاق التحليل:** `/admin/ops` و `/admin/intel`

---

## الجزء الأول: ملخص تنفيذي

هذا التقرير يقدم تحليلاً شاملاً لقسمين إداريين رئيسيين في مشروع Azenith Living OS:

1. **مركز العمليات والأتمتة** (`/admin/ops`) - 4 تبويبات
2. **مركز الاستخبارات والتطوير** (`/admin/intel`) - 4 تبويبات

**الهدف:** إعداد خطة لدمج جميع الوظائف تحت قيادة "المهندس المعماري الذكي" (AI Architect) مع الاحتفاظ بالواجهات اليدوية كخيار احتياطي.

---

## الجزء الثاني: هيكل الملفات والمكونات

### أ - ملفات الصفحات الرئيسية

| المسار | الوصف | الحجم |
|--------|-------|-------|
| `app/admin/ops/page.tsx` | صفحة العمليات والأتمتة | 823 سطر |
| `app/admin/intel/page.tsx` | صفحة الاستخبارات والتطوير | 798 سطر |
| `app/admin/layout.tsx` | التخطيط الرئيسي (Server Component) | 22 سطر |
| `app/admin/layout-client.tsx` | التخطيط الفرعي (Client Component) | 132 سطر |

### ب - المكونات الفرعية (Tabs) - تفصيل كامل

#### 1. تبويبات `/admin/ops`:

| التبويب | المكون | الوظيفة | API المستخدم |
|---------|--------|---------|--------------|
| **الأتمتة** | `AutomationTab` | إدارة قواعد الأتمتة | `GET/POST/PUT/DELETE /api/admin/automation` |
| **المحتوى** | `ContentTab` | توليد محتوى AI | `POST /api/content-generator` |
| **الحجوزات** | `BookingsTab` | إدارة طلبات الحجز | `GET/PATCH /api/bookings` |
| **الفواتير** | `BillingTab` | عرض خطط الاشتراك | `POST /api/checkout` |

#### 2. تبويبات `/admin/intel`:

| التبويب | المكون | الوظيفة | API المستخدم |
|---------|--------|---------|--------------|
| **غرفة العمليات** | `WarRoomTab` | مراقبة النظام والأمن | `GET /api/system-health`, `/api/admin/arsenal`, `/api/admin/mastermind/stats` |
| **التحليلات** | `AnalyticsTab` | إحصائيات وتحليلات | `GET /api/analytics?period=` |
| **الذكاء** | `IntelligenceTab` | AI Architect Chat | `POST /api/admin/mastermind` |
| **التطوير** | `DevelopmentTab` | SEO والمظهر | `PATCH /api/seo`, `/api/theme` |

---

## الجزء الثالث: تحليل API Endpoints

### APIs متعلقة بـ `/admin/ops`:

```
/api/admin/automation     - CRUD لقواعد الأتمتة (كامل)
/api/content-generator    - توليد محتوى AI (وهمي حالياً)
/api/bookings            - إدارة الحجوزات (كامل)
/api/checkout            - الدفع (غير مفعل بالكامل)
```

### APIs متعلقة بـ `/admin/intel`:

```
/api/system-health       - حالة النظام (جزئي)
/api/admin/arsenal       - إحصائيات النظام (كامل)
/api/admin/mastermind    - AI Architect (نصي فقط)
/api/analytics           - التحليلات (كامل)
/api/seo                 - إعدادات SEO (غير مفعل بالكامل)
/api/theme               - إعدادات المظهر (غير مفعل بالكامل)
```

### APIs إضافية مدعومة:

```
/api/admin/mastermind/stats     - إحصائيات المهندس المعماري
/api/admin/war-room            - غرفة العمليات
/api/admin/command             - تنفيذ أوامر مباشرة
```

---

## الجزء الرابع: جداول Supabase المرتبطة

### الجداول الأساسية:

| الجدول | الوظيفة | الارتباط |
|--------|---------|----------|
| `automation_rules` | قواعد الأتمتة | تبويب الأتمتة |
| `site_settings` | إعدادات الموقع | تبويب التطوير |
| `requests` | طلبات الحجز | تبويب الحجوزات |
| `users` | العملاء/المستخدمين | الحجوزات + التحليلات |
| `events` | الأحداث والتتبع | التحليلات |
| `companies` | الشركات/المستأجرين | الجميع |
| `payments` | المدفوعات | الفواتير |
| `system_health_log` | سجل صحة النظام | غرفة العمليات |
| `immutable_command_log` | سجل الأوامر | المهندس المعماري |
| `parallel_task_queue` | مهام النظام | غرفة العمليات |
| `api_keys` | مفاتيح API | الأرسنال |
| `translations_cache` | ترجمة المحتوى | المحتوى |

---

## الجزء الخامس: تحليل مفصل لكل تبويب (8 تبويبات)

### 1. تبويب الأتمتة (AutomationTab)

**الملف:** `app/admin/ops/page.tsx:60-404`

**الوظائف المتاحة:**
- ✅ إنشاء قاعدة أتمتة جديدة
- ✅ تعديل قاعدة موجودة
- ✅ تفعيل/تعطيل قاعدة
- ✅ حذف قاعدة
- ✅ عرض جميع القواعد

**API حقيقي:** ✅ **نعم - يعمل بالكامل**
- `GET /api/admin/automation` - جلب القواعد
- `POST /api/admin/automation` - إنشاء قاعدة
- `PUT /api/admin/automation?id={id}` - تحديث
- `DELETE /api/admin/automation?id={id}` - حذف

**جدول Supabase:** `automation_rules`

**قابلية التنفيذ بالأمر الطبيعي:** ✅ **ممتازة**
- "أنشئ قاعدة أتمتة ترسل واتساب عند قبول حجز"
- "فعّل قواعد الأتمتة للحجوزات"

**المشاكل:** لا توجد مشاكل كبيرة.

---

### 2. تبويب المحتوى (ContentTab)

**الملف:** `app/admin/ops/page.tsx:407-546`

**الوظائف المتاحة:**
- ✅ توليد عناوين صفحات
- ✅ توليد وصف صفحات
- ✅ توليد نصوص CTA
- ✅ توليد وصف منتجات
- ✅ نسخ المحتوى المولد

**API حقيقي:** ⚠️ **جزئي - وهمي**
- `POST /api/content-generator` يستخدم `lib/ai-content.ts`
- **المشكلة:** المحتوى مولد بنمط ثابت (mock)، لا يستخدم AI فعلياً
- `await new Promise(resolve => setTimeout(resolve, 500))` - تأخير وهمي فقط

**جدول Supabase:** لا يوجد (لا يحفظ في قاعدة البيانات)

**قابلية التنفيذ بالأمر الطبيعي:** ⚠️ **متوسطة** (يحتاج تحسين)
- "ولد لي وصفاً لصفحة غرفة المعيشة" - يعمل لكن النتيجة بسيطة

**المشاكل:**
- لا يستخدم AI فعلياً (Groq/OpenRouter)
- لا يحفظ المحتوى المولد
- لا يمكن تعديل المحتوى مباشرة

---

### 3. تبويب الحجوزات (BookingsTab)

**الملف:** `app/admin/ops/page.tsx:549-673`

**الوظائف المتاحة:**
- ✅ عرض قائمة الحجوزات
- ✅ تصفية حسب الحالة (معلق/مقبول/مرفوض)
- ✅ قبول حجز
- ✅ رفض حجز
- ✅ عرض تفاصيل الحجز (الاسم، الهاتف، البريد، الملاحظات)

**API حقيقي:** ✅ **نعم - يعمل بالكامل**
- `GET /api/bookings` - جلب الحجوزات
- `PATCH /api/bookings` - تحديث الحالة

**جدول Supabase:** `requests` + `users` + `events`

**قابلية التنفيذ بالأمر الطبيعي:** ✅ **ممتازة**
- "اعرض الحجوزات المعلقة"
- "اقبل حجز [اسم العميل]"
- "أرسل إحصائية الحجوزات لهذا الشهر"

**المشاكل:** لا توجد مشاكل كبيرة.

---

### 4. تبويب الفواتير (BillingTab)

**الملف:** `app/admin/ops/page.tsx:676-760`

**الوظائف المتاحة:**
- ✅ عرض خطط الاشتراك (4 خطط)
- ✅ اختيار خطة
- ✅ توجيه لصفحة الدفع

**API حقيقي:** ⚠️ **جزئي**
- `POST /api/checkout` - موجود لكن يحتاج Stripe
- الخطط مخزنة في الكود (hardcoded)

**جدول Supabase:** لا يوجد (الخطط في الكود)

**قابلية التنفيذ بالأمر الطبيعي:** ❌ **ضعيفة**
- "غيّر خطتي إلى الاحترافي" - يحتول إعداد Stripe

**المشاكل:**
- لا يوجد integration حقيقي مع Stripe
- الخطط ثابتة في الكود
- لا يوجد إدارة للفواتير السابقة

---

### 5. تبويب غرفة العمليات (WarRoomTab)

**الملف:** `app/admin/intel/page.tsx:83-333`

**الوظائف المتاحة:**
- ✅ عرض حالة النظام (ممتاز/مستقر/منخفض/هجوم)
- ✅ استخدام الذاكرة والمعالج
- ✅ عدد المفاتيح النشطة
- ✅ حجم الكاش
- ✅ الأوامر في 24 ساعة
- ✅ محاولات الدخول الفاشلة
- ✅ حماية 2FA
- ✅ التنبيهات النشطة

**API حقيقي:** ✅ **نعم - يعمل بالكامل**
- `GET /api/system-health` - حالة النظام
- `GET /api/admin/arsenal` - إحصائيات الأرسنال
- `GET /api/admin/mastermind/stats` - إحصائيات المهندس

**جداول Supabase:** `system_health_log`, `immutable_command_log`, `parallel_task_queue`

**قابلية التنفيذ بالأمر الطبيعي:** ✅ **ممتازة**
- "كيف حال النظام؟"
- "أعرض التنبيهات الحرجة"
- "اشغل فحص أمني"

**المشاكل:** لا توجد مشاكل كبيرة.

---

### 6. تبويب التحليلات (AnalyticsTab)

**الملف:** `app/admin/intel/page.tsx:336-442`

**الوظائف المتاحة:**
- ✅ عرض عدد العملاء والزوار
- ✅ عرض عدد الطلبات ونسبة التحويل
- ✅ عرض الحجوزات والمقبولة
- ✅ متوسط نتيجة العميل
- ✅ نقرات واتساب
- ✅ أنواع الغرف الأكثر طلباً
- ✅ الأساليب الأكثر شيوعاً
- ✅ تصفية حسب الفترة (7/30/90 يوم)

**API حقيقي:** ✅ **نعم - يعمل بالكامل**
- `GET /api/analytics?period={7days|30days|90days}`

**جداول Supabase:** `users`, `requests`, `events`

**قابلية التنفيذ بالأمر الطبيعي:** ✅ **ممتازة**
- "أعطني إحصائيات آخر 30 يوم"
- "ما أكثر غرفة مطلوبة هذا الشهر؟"
- "قارن بين أداء هذا الشهر والشهر الماضي"

**المشاكل:** لا توجد مشاكل كبيرة.

---

### 7. تبويب الذكاء - AI Architect (IntelligenceTab)

**الملف:** `app/admin/intel/page.tsx:445-559`

**الوظائف المتاحة حالياً:**
- ✅ واجهة دردشة نصية
- ✅ حفظ تاريخ المحادثة
- ✅ إرسال رسائل
- ✅ عرض الردود

**API حقيقي:** ✅ **نعم - يعمل**
- `POST /api/admin/mastermind` مع action="command"

**الذكاء الفعلي:** ✅ **نعم - يستخدم AI حقيقي**
- يستخدم `askOpenRouter` (Claude 3.5 Sonnet)
- fallback إلى `askGroq`
- يحتفظ بسياق المحادثة (آخر 10 رسائل)

**القدرات الحالية:**
- محادثة نصية حرة
- تحليل البيانات وتقديم توصيات
- إجابة الاستفسارات التقنية
- **لا يوجد:** قدرة على تنفيذ أوامر أو استدعاء functions

**قابلية التنفيذ بالأمر الطبيعي:** ❌ **ضعيفة حالياً**
- "أنشئ لي قاعدة أتمتة" - يجيب نصياً فقط، لا ينفذ
- "غيّر SEO الموقع" - لا يمكنه التنفيذ

**المشاكل:**
- لا يملك أدوات (tools) للتنفيذ
- لا يستخدم function calling
- محادثة نصية بحتة

---

### 8. تبويب التطوير (DevelopmentTab)

**الملف:** `app/admin/intel/page.tsx:562-711`

**الوظائف المتاحة:**
- ✅ تعديل عنوان الموقع
- ✅ تعديل وصف الموقع
- ✅ تعديل الكلمات المفتاحية
- ✅ تعديل ألوان الموقع (primary/secondary)
- ✅ اختيار الخطوط
- ✅ معاينة مباشرة
- ✅ حفظ الإعدادات

**API حقيقي:** ⚠️ **جزئي**
- `PATCH /api/seo` - موجود لكن يحتاج تنفيذ كامل
- `PATCH /api/theme` - موجود لكن يحتاج تنفيذ كامل

**جدول Supabase:** `site_settings`

**قابلية التنفيذ بالأمر الطبيعي:** ✅ **جيدة**
- "غيّر لون الموقع إلى الأزرق"
- "حدّث عنوان الموقع"
- "غيّر الخط إلى Serif"

**المشاكل:**
- APIs غير مفعلة بالكامل
- الحفظ في الكود فقط (state)

---

## الجزء السادس: تحليل "المهندس المعماري الذكي" (AI Architect)

### الموقع الحالي:
- **الملف:** `app/admin/intel/page.tsx:445-559` (IntelligenceTab)
- **API:** `app/api/admin/mastermind/route.ts`
- **المنطق:** `lib/azenith-sovereign.ts`

### القدرات الحالية:

| القدرة | الحالة | التفاصيل |
|--------|--------|----------|
| محادثة نصية | ✅ يعمل | Claude 3.5 Sonnet عبر OpenRouter |
| حفظ السياق | ✅ يعمل | آخر 10 رسائل |
| تحليل البيانات | ✅ نصي | يقرأ ويحلل لكن لا ينفذ |
| تنفيذ أوامر | ❌ لا يعمل | لا يوجد function calling |
| استدعاء APIs | ❌ لا يعمل | لا يمكنه استدعاء APIs |
| أدوات (Tools) | ❌ غير موجود | لا يوجد lib/architect-tools.ts |

### ما يمكنه فعله الآن:
- الرد على الأسئلة التقنية
- تقديم توصيات نصية
- تحليل البيانات وشرحها
- مناقشة استراتيجيات

### ما لا يمكنه فعله:
- إنشاء قواعد أتمتة
- تغيير إعدادات الموقع
- قبول/رفض حجوزات
- توليد محتوى فعلي
- تشغيل فحوصات
- إجراء أي تغيير في النظام

---

## الجزء السابع: خطة الدمج والتوظيف

### المرحلة 1: الدمج الفيزيائي (الأسبوع 1)

#### الخطوة 1.1: نقل تبويبات `/admin/ops` إلى `/admin/intel`

**الملف المستهدف:** `app/admin/intel/page.tsx`

**التعديلات المطلوبة:**

```typescript
// إضافة التبويبات الجديدة إلى tabs array
const tabs = [
  // التبويبات الحالية
  { id: "warroom", label: "غرفة العمليات", icon: Target, component: WarRoomTab },
  { id: "analytics", label: "التحليلات", icon: BarChart3, component: AnalyticsTab },
  { id: "intelligence", label: "الذكاء", icon: Brain, component: IntelligenceTab },
  { id: "development", label: "التطوير", icon: Code, component: DevelopmentTab },
  // التبويبات المنقولة من /admin/ops
  { id: "automation", label: "الأتمتة", icon: Zap, component: AutomationTab },
  { id: "content", label: "المحتوى", icon: FileText, component: ContentTab },
  { id: "bookings", label: "الحجوزات", icon: Calendar, component: BookingsTab },
  { id: "billing", label: "الفواتير", icon: CreditCard, component: BillingTab },
];
```

**خطوات التنفيذ:**
1. نسخ `AutomationTab` من `ops/page.tsx` إلى `intel/page.tsx`
2. نسخ `ContentTab` من `ops/page.tsx` إلى `intel/page.tsx`
3. نسخ `BookingsTab` من `ops/page.tsx` إلى `intel/page.tsx`
4. نسخ `BillingTab` من `ops/page.tsx` إلى `intel/page.tsx`
5. استيراد الأيقونات المطلوبة: `Zap, FileText, Calendar, CreditCard`
6. إضافة أنواع البيانات: `AutomationRule, Booking, ContentContext, Page, MediaAsset`

#### الخطوة 1.2: إزالة `/admin/ops` من القائمة الجانبية

**الملف:** `app/admin/layout-client.tsx`

```typescript
// قبل
const navItems = [
  { href: "/admin", label: "الرئيسية", icon: "Home" },
  { href: "/admin/sales", label: "المبيعات والإدارة", icon: "Shield" },
  { href: "/admin/intel", label: "الاستخبارات والتطوير", icon: "Brain" },
  { href: "/admin/ops", label: "العمليات والأتمتة", icon: "Bot" },
];

// بعد
const navItems = [
  { href: "/admin", label: "الرئيسية", icon: "Home" },
  { href: "/admin/sales", label: "المبيعات والإدارة", icon: "Shield" },
  { href: "/admin/intel", label: "مركز القيادة الذكي", icon: "Brain" },
];
```

#### الخطوة 1.3: إعادة توجيه `/admin/ops` إلى `/admin/intel`

**إنشاء ملف:** `app/admin/ops/page.tsx` (استبدال)

```typescript
import { redirect } from "next/navigation";

export default function OpsRedirect() {
  redirect("/admin/intel?tab=automation");
}
```

**الاحتفاظ بنسخة احتياطية:**
- نسخ الملف الأصلي إلى `app/admin/ops/page-backup.tsx`

---

### المرحلة 2: تمكين المهندس المعماري (الأسابيع 2-3)

#### الخطوة 2.1: إنشاء نظام الأدوات (Tools System)

**إنشاء ملف:** `lib/architect-tools.ts`

**الأدوات المطلوبة (8 أدوات):**

| الأداة | الوظيفة | API |
|--------|---------|-----|
| `createAutomationRule` | إنشاء قاعدة أتمتة | POST /api/admin/automation |
| `updateAutomationRule` | تعديل قاعدة | PUT /api/admin/automation |
| `toggleAutomationRule` | تفعيل/تعطيل | PUT /api/admin/automation |
| `deleteAutomationRule` | حذف قاعدة | DELETE /api/admin/automation |
| `getBookings` | جلب الحجوزات | GET /api/bookings |
| `updateBookingStatus` | تحديث حالة حجز | PATCH /api/bookings |
| `generateContent` | توليد محتوى | POST /api/content-generator |
| `getAnalytics` | جلب التحليلات | GET /api/analytics |
| `updateSiteSettings` | تحديث إعدادات الموقع | PATCH /api/seo + /api/theme |
| `runHealthCheck` | فحص صحة النظام | GET /api/system-health |
| `getSystemStats` | إحصائيات النظام | GET /api/admin/arsenal |

#### الخطوة 2.2: إنشاء API للأوامر الذكية

**إنشاء ملف:** `app/api/admin/architect/command/route.ts`

**التدفق:**
1. استقبال الأمر النصي من المستخدم
2. إرساله إلى OpenRouter/Groq مع function calling
3. تحديد الأداة المناسبة
4. تنفيذ الأداة
5. إرجاع النتيجة للمستخدم

**الهيكل المقترح:**

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: unknown) => Promise<ToolResult>;
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  manualUrl?: string; // رابط التبويب اليدوي في حال الفشل
}
```

#### الخطوة 2.3: تحديث IntelligenceTab لدعم الأدوات

**التعديلات:**
1. إضافة حالة "جاري التنفيذ"
2. عرض نتيجة التنفيذ
3. زر "التوجيه للواجهة اليدوية" في حال الفشل
4. عرض الأوامر المقترحة

#### الخطوة 2.4: تحسين معالجة الأخطاء

**التدفق عند الفشل:**
1. محاولة التنفيذ بالأداة
2. إذا فشلت → إرجاع رسالة واضحة
3. تقديم رابط للتبويب اليدوي
4. تسجيل الخطأ في `system_health_log`

---

### المرحلة 3: اختبار التكامل (الأسبوع 4)

#### أمثلة أوامر للاختبار:

| الأمر | الأداة المتوقعة | التبويب اليدوي |
|-------|-----------------|----------------|
| "أنشئ قاعدة أتمتة ترسل واتساب عند قبول حجز" | `createAutomationRule` | `/admin/intel?tab=automation` |
| "اعرض الحجوزات المعلقة" | `getBookings` | `/admin/intel?tab=bookings` |
| "اقبل حجز محمد" | `updateBookingStatus` | `/admin/intel?tab=bookings` |
| "ولد لي وصفاً لصفحة غرفة النوم" | `generateContent` | `/admin/intel?tab=content` |
| "أعطني إحصائيات آخر 7 أيام" | `getAnalytics` | `/admin/intel?tab=analytics` |
| "فحص صحة النظام" | `runHealthCheck` | `/admin/intel?tab=warroom` |
| "غيّر لون الموقع إلى الأزرق" | `updateSiteSettings` | `/admin/intel?tab=development` |
| "فعّل جميع قواعد الأتمتة" | `toggleAutomationRule` | `/admin/intel?tab=automation` |

---

## الجزء الثامن: توصيات إضافية

### أ - تبويبات يمكن دمجها أو إلغاؤها

| التبويب | التوصية | السبب |
|---------|---------|-------|
| **الفواتير** | ⚠️ دمج مع المبيعات | المبيعات أفضل مكان لإدارة الاشتراكات |
| **المحتوى** | ✅ الاحتفاظ | سيصبح قوياً عند ربطه بـ AI حقيقي |
| **التطوير** | ✅ الاحتفاظ | مهم لـ SEO والمظهر |

### ب - المخاطر المتوقعة

| المخطر | الاحتمال | الحل |
|--------|----------|------|
| تعارض المكونات | متوسط | اختبار incremental، نسخ احتياطي |
| فقدان البيانات | منخفض | عدم تعديل الجداول، فقط إعادة توجيه |
| مشاكل RLS | منخفض | APIs تستخدم admin client |
| فشل AI في التنفيذ | متوسط | توفير fallback للواجهة اليدوية |
| تعقيد الكود | متوسط | تقسيم إلى ملفات منفصلة |

### ج - أولوية التنفيذ

**مرحلة 1 (أسبوع 1):** الدمج الفيزيائي
- [ ] نقل التبويبات
- [ ] تحديث القائمة الجانبية
- [ ] إعادة التوجيه
- [ ] اختبار الوظائف اليدوية

**مرحلة 2 (أسبوع 2):** نظام الأدوات
- [ ] إنشاء `lib/architect-tools.ts`
- [ ] اختبار كل أداة منفردة
- [ ] توثيق الأدوات

**مرحلة 3 (أسبوع 3):** AI Command API
- [ ] إنشاء `app/api/admin/architect/command/route.ts`
- [ ] ربط بـ OpenRouter/Groq
- [ ] اختبار function calling
- [ ] معالجة الأخطاء

**مرحلة 4 (أسبوع 4):** تحديث UI
- [ ] إضافة حالات التنفيذ
- [ ] روابط للواجهة اليدوية
- [ ] اختبار المستخدم النهائي
- [ ] تحسين الأداء

---

## الجزء التاسع: تقدير الوقت

| المرحلة | الوقت المقدر | الجهد |
|---------|-------------|-------|
| الدمج الفيزيائي | 2-3 أيام | متوسط |
| نظام الأدوات | 3-4 أيام | عالٍ |
| AI Command API | 4-5 أيام | عالٍ |
| تحديث UI + اختبار | 2-3 أيام | متوسط |
| **المجموع** | **11-15 يوم** | **عالٍ** |

**ملاحظات:**
- التقدير لـ 1 مطور متوسط الخبرة
- يفترض توفر OpenRouter API Key
- يفترض عدم وجود عوائق تقنية غير متوقعة

---

## الجزء العاشر: الملحقات

### أ - هيكل مقترح لـ `lib/architect-tools.ts`

```typescript
// lib/architect-tools.ts
import { z } from "zod";

// === أنواع البيانات ===
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  manualUrl?: string;
  message: string;
}

// === تعريف الأدوات ===
export const tools = {
  createAutomationRule: {
    name: "createAutomationRule",
    description: "إنشاء قاعدة أتمتة جديدة",
    parameters: z.object({
      name: z.string().describe("اسم القاعدة"),
      trigger: z.enum(["page_visit", "form_submit", "booking_status_changed", "lead_updated", "time_delay", "user_registered"]),
      conditions: z.object({}).describe("شروط JSON"),
      actions: z.array(z.object({
        type: z.string(),
        message: z.string().optional(),
        intent: z.string().optional()
      })),
      enabled: z.boolean().default(true)
    }),
    execute: async (params) => {
      const response = await fetch("/api/admin/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });
      // ... return ToolResult
    },
    manualUrl: "/admin/intel?tab=automation"
  },

  getBookings: {
    name: "getBookings",
    description: "جلب قائمة الحجوزات",
    parameters: z.object({
      status: z.enum(["all", "pending", "accepted", "rejected"]).optional()
    }),
    execute: async (params) => {
      const response = await fetch("/api/bookings");
      // ... filter by status if provided
      // ... return ToolResult
    },
    manualUrl: "/admin/intel?tab=bookings"
  },

  updateBookingStatus: {
    name: "updateBookingStatus",
    description: "تحديث حالة حجز (قبول/رفض)",
    parameters: z.object({
      bookingId: z.string().describe("معرف الحجز"),
      status: z.enum(["accepted", "rejected"]),
      notify: z.boolean().default(true).describe("إرسال إشعار للعميل")
    }),
    execute: async (params) => {
      const response = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: params.bookingId, status: params.status })
      });
      // ... return ToolResult
    },
    manualUrl: "/admin/intel?tab=bookings"
  },

  // ... المزيد من الأدوات
};

export type ToolName = keyof typeof tools;
```

### ب - هيكل مقترح لـ API Command

```typescript
// app/api/admin/architect/command/route.ts
import { NextRequest, NextResponse } from "next/server";
import { tools } from "@/lib/architect-tools";
import { askOpenRouter } from "@/lib/ai-orchestrator";

const SYSTEM_PROMPT_WITH_TOOLS = `أنت المهندس المعماري الذكي لـ Azenith Living.

لديك أدوات للتحكم في النظام. عندما يطلب المستخدم شيئاً يمكن تنفيذه بالأدوات، استدعِ الأداة المناسبة.

الأدوات المتاحة:
- createAutomationRule: إنشاء قاعدة أتمتة
- getBookings: جلب الحجوزات
- updateBookingStatus: قبول/رفض حجز
- generateContent: توليد محتوى
- getAnalytics: جلب التحليلات
- updateSiteSettings: تعديل إعدادات الموقع
- runHealthCheck: فحص النظام

إذا لم تكن متأكداً من فهم الطلب، اسأل للتوضيح.`;

export async function POST(request: NextRequest) {
  try {
    const { command, sessionId } = await request.json();

    // 1. إرسال الأمر للـ AI مع function calling
    const aiResponse = await askOpenRouter(
      `${SYSTEM_PROMPT_WITH_TOOLS}\n\nطلب المستخدم: ${command}`,
      undefined,
      {
        model: "anthropic/claude-3.5-sonnet",
        tools: Object.values(tools).map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        })),
        tool_choice: "auto"
      }
    );

    // 2. التحقق مما إذا كان AI يريد استدعاء أداة
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      const toolCall = aiResponse.toolCalls[0];
      const tool = tools[toolCall.name as keyof typeof tools];
      
      if (tool) {
        // تنفيذ الأداة
        const result = await tool.execute(toolCall.arguments);
        
        return NextResponse.json({
          success: result.success,
          message: result.message,
          data: result.data,
          manualUrl: result.success ? undefined : tool.manualUrl,
          action: {
            tool: tool.name,
            params: toolCall.arguments
          }
        });
      }
    }

    // 3. إذا لم يستدعِ AI أداة، رد نصي فقط
    return NextResponse.json({
      success: true,
      message: aiResponse.content,
      type: "chat"
    });

  } catch (error) {
    console.error("[Architect Command] Error:", error);
    return NextResponse.json({
      success: false,
      error: "فشل في معالجة الأمر",
      manualUrl: "/admin/intel"
    }, { status: 500 });
  }
}
```

### ج - مثال استدعاء Function Calling

```typescript
// مثال: أمر المستخدم "أنشئ قاعدة أتمتة ترسل واتساب عند قبول حجز"

const userCommand = "أنشئ قاعدة أتمتة ترسل واتساب عند قبول حجز";

// AI يفهم ويستدعي:
const toolCall = {
  name: "createAutomationRule",
  arguments: {
    name: "إشعار واتساب عند قبول الحجز",
    trigger: "booking_status_changed",
    conditions: { status: "accepted" },
    actions: [
      { type: "whatsapp", message: "تم قبول حجزك!" }
    ],
    enabled: true
  }
};

// التنفيذ:
const result = await tools.createAutomationRule.execute(toolCall.arguments);

// النتيجة:
{
  success: true,
  message: "تم إنشاء قاعدة الأتمتة 'إشعار واتساب عند قبول الحجز' بنجاح",
  data: { id: "uuid", name: "...", enabled: true },
  manualUrl: "/admin/intel?tab=automation"
}
```

---

## الخلاصة

تم إعداد هذا التقرير ليكون **دليلاً شاملاً** لـ:

1. **فهم الوضع الحالي** - 8 تبويبات، 4 في كل قسم، APIs متنوعة
2. **تحديد الفجوات** - AI Architect يحتاج أدوات للتنفيذ
3. **خطة واضحة** - 4 مراحل، 11-15 يوم عمل
4. **تقديرات واقعية** - مع الأخذ في الاعتبار المخاطر

**الخطوة التالية الموصى بها:**
ابدأ **المرحلة 1 (الدمج الفيزيائي)** لأنها:
- سهلة نسبياً
- لا تؤثر على البيانات
- تُبسّط الهيكل
- تُجهّز الأرضية للمراحل اللاحقة

---

**نهاية التقرير**
