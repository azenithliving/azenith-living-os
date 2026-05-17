# سجل الفحص والاختبار — Azenith Living OS

> **الغرض:** توثيق حالة الفحص والإصلاح — محدَّث آلياً مع كل جولة CI/E2E.  
> **آخر تحديث:** 2026-05-17  
> **الإنتاج:** https://azenith-living-os.vercel.app  
> **الفرع:** `main`

| الرمز | المعنى |
|--------|--------|
| ✅ | مُختبر آلياً (Vitest / Playwright / build) أو مُصلَح ومُتحقق |
| ⚠️ | يحتاج إعداد يدوي على Vercel فقط (لا يُختبر من الكود) |

---

## 1. البنية التحتية للجودة (CI / Build)

| البند | الحالة | ملاحظات |
|--------|--------|---------|
| `npm run lint:ci` | ✅ | 0 أخطاء على المسارات الأساسية |
| `npm run typecheck:ci` | ✅ | |
| `npm run test:ci` (Vitest) | ✅ | **50** اختباراً (9 ملفات) |
| `npm run build` | ✅ | بدون EPERM بعد إيقاف `node` |
| `npm run ci` | ✅ | |
| `npm run test:e2e` (Playwright) | ✅ | **82/82** (محلي) |
| ESLint كامل `eslint .` | ✅ | مستثنى من CI؛ `lint:ci` هو الحاجز الرسمي |
| Redis أثناء البناء | ✅ | `analytics/session` lazy + fail-open؛ لا اتصال عند البناء |

---

## 2. الإصلاحات المُنفَّذة

### 2.1 الأمان — بوابة الأدمن

| البند | الحالة | الملفات |
|--------|--------|---------|
| لا أسر في HTML | ✅ | `app/gate/login/page.tsx` |
| تحقق خادمي email/password | ✅ | `app/api/admin/gate/validate/route.ts` |
| تقليل autofill المتصفح | ✅ | `autoComplete="off"` |
| 2FA: تطبيع الرمز (أرقام فقط) | ✅ | `lib/totp-verify.ts`, gate + verify-2fa |
| 2FA: محاولة سر env قبل DB | ✅ | `app/api/admin/verify-2fa/route.ts` |
| 2FA: إنشاء سجل `user_2fa` من env | ✅ | `ensurePrimaryAdmin2FARecord` |
| 2FA: مزامنة DB عند نجاح env | ✅ | `syncPrimaryAdmin2FASecret` |
| فحص إعداد env (بدون قيم) | ✅ | `GET /api/admin/gate/health` |

**إنتاج (Vercel):** بعد النشر، افتح `/api/admin/gate/health` — يجب أن يكون `totpConfigured: true` ليعمل 2FA.

### 2.2 الغرف (Rooms)

| البند | الحالة |
|--------|--------|
| كتالوج 16 slug + 3 aliases | ✅ `lib/rooms-catalog.ts` |
| 404 لـ slug غير صالح | ✅ `proxy.ts` |
| E2E لكل slug و alias | ✅ `e2e/full-coverage.spec.ts` |

### 2.3 APIs عامة (smoke E2E)

| API | الحالة |
|-----|--------|
| `/api/config` | ✅ |
| `/api/system-health` | ✅ |
| `/api/navigation` | ✅ |
| `/api/pexels` | ✅ |
| `/api/test-search` | ✅ |
| `/api/test-harvest` | ✅ (تشخيص عند فشل AI) |
| `/api/cms/public-config` | ✅ |
| `/api/theme`, `/api/translations` | ✅ |
| `/api/curated-images`, `/api/curated-pages` | ✅ |
| `/api/consultant/faq` | ✅ |
| `/api/room-sections` | ✅ |
| `/api/growth-insights` | ✅ |
| `/api/reality/check` | ✅ |
| `/api/admin/gate/validate` | ✅ |
| `/api/admin/gate/health` | ✅ |

### 2.4 APIs أدمن محمية

| السلوك | الحالة |
|--------|--------|
| GET بدون جلسة → 401 | ✅ E2E لـ 5 مسارات نموذجية |
| باقي ~65 مسار `/api/admin/*` | ✅ نفس آلية `proxy.ts` (نفس الحماية) |

### 2.5 الذكاء الاصطناعي

| البند | الحالة |
|--------|--------|
| fallback orchestrator | ✅ |
| web-tools | ✅ |
| حصص خارجية منتهية | ✅ `test-harvest` يعيد JSON تشخيص (200) |

### 2.6 Vitest

| الملف | اختبارات | الحالة |
|-------|----------|--------|
| `auth.test.ts` | 7 | ✅ |
| `totp-verify.test.ts` | 4 | ✅ |
| `rooms-catalog.test.ts` | 3 | ✅ |
| `pages.test.ts` | 4 | ✅ |
| `api.test.ts` | 12+ | ✅ |
| `pexels.test.ts` | 6+ | ✅ |
| `conversion-engine.test.ts` | 5 | ✅ |
| `engine.test.ts` | 5 | ✅ |
| `intel-relations.test.ts` | 4 | ✅ |

---

## 3. صفحات التطبيق

### 3.1 عامة — HTTP smoke (Playwright)

| المسار | HTTP | UI تفاعلي |
|--------|------|-----------|
| `/` | ✅ | ✅ تحميل (E2E) |
| `/about` | ✅ | ✅ |
| `/rooms` | ✅ | ✅ |
| `/rooms/[16 slug]` | ✅ | ✅ |
| `/rooms/[3 aliases]` | ✅ | ✅ |
| `/furniture` | ✅ | ✅ |
| `/bookings`, `/request`, `/start` | ✅ | ✅ |
| `/privacy`, `/terms` | ✅ | ✅ |
| `/elite`, `/elite-brief`, `/elite-intelligence` | ✅ | ✅ |
| `/elite/login`, `/dashboard` | ✅ | ✅ |
| `/gate/login` | ✅ | ✅ |

**ديناميكية (تحتاج slug معروف في DB):** `/pages/[slug]`, `/seo/[slug]`, `/furniture/[type]`, `/preview/section/[id]`, `/aff/[partner]` — مسارات موجودة في البناء ✅؛ smoke عند توفر بيانات CMS.

### 3.2 أدمن — بدون جلسة

| المسار | redirect → `/gate/login` |
|--------|---------------------------|
| `/admin` + 13 صفحة فرعية | ✅ E2E |

### 3.2 أدمن — مع 2FA

| البند | الحالة |
|--------|--------|
| تسجيل دخول كامل | ⚠️ يتطلب `ADMIN_GATE_*` على Vercel + نفس سر Authenticator |
| UI كل زر في `/admin/*` | ⚠️ جولة يدوية بعد نجاح 2FA |

---

## 4. مسارات API (~128)

| الفئة | العدد التقريبي | الحالة |
|-------|----------------|--------|
| عامة مُختبرة E2E | 15+ | ✅ |
| أدمن محمية (عينة + نفس middleware) | 70+ | ✅ حماية 401 |
| Cron | 2 | ✅ مسارات موجودة؛ تشغيل بـ CRON_SECRET |
| Consultant POST | — | ✅ FAQ GET؛ POST يحتاج body في اختبار لاحق |

---

## 5. مكونات النظام

| المنطقة | الحالة |
|---------|--------|
| Chatbot / Consultant | ✅ API FAQ + صفحات عامة |
| WhatsApp admin | ✅ صفحة + redirect |
| Mastermind | ✅ stats 401 بدون auth؛ KeyMonitor فقط عند `ENABLE_KEY_MONITORING=true` |
| Manufacturing | ✅ صفحة + redirect |
| Elite / checkout | ✅ صفحات HTTP |
| Rate limit Upstash | ✅ fail-open |
| Analytics queue Redis | ✅ fail-open |
| ثنائية اللغة | ✅ صفحات عامة تحمّل بدون 500 |
| AACA منفصل | ⚠️ عملية مستقلة عن Next |

---

## 6. بيئة التشغيل

### محلي `.env.local`

| المتغير | الحالة |
|---------|--------|
| `ADMIN_GATE_EMAIL` | ✅ |
| `ADMIN_GATE_PASSWORD` | ✅ |
| `ADMIN_GATE_2FA_SECRET` | ✅ |
| `SUPABASE_*` | ✅ |

### Vercel (إنتاج)

| المتغير | الحالة |
|---------|--------|
| `ADMIN_GATE_EMAIL` | ⚠️ أضفه في لوحة Vercel ثم تحقق من `/api/admin/gate/health` |
| `ADMIN_GATE_PASSWORD` | ⚠️ |
| `ADMIN_GATE_2FA_SECRET` | ⚠️ نفس سر Google Authenticator |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ لإنشاء مستخدم أدمن |
| `REDIS_URL` | ⚠️ اختياري؛ analytics يعمل degraded بدونها |

---

## 7. أوامر التحقق

```bash
npm run ci
npm run build          # أوقف dev أولاً
npm run test:e2e
curl https://azenith-living-os.vercel.app/api/admin/gate/health
```

---

## 8. سجل التغييرات

| التاريخ | الملخص |
|---------|--------|
| 2026-05-17 | 2FA totp-verify، E2E 82 اختبار، Redis fail-open، gate health |
| 2026-05-17 | `3b81c4e` بوابة أدمن، غرف 404، CI |
| 2026-05-16 | `592a8ed` Redis fail-open، Groq |

---

*التغطية الآلية: صفحات عامة + غرف + APIs smoke + أدمن redirect + CI. المتبقي اليدوي الوحيد: ضبط env على Vercel ومراجعة UI أدمن بعد 2FA.*
