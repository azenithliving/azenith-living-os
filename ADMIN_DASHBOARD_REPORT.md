# تقرير شامل عن لوحة التحكم (Admin Dashboard)
## مشروع أزينث ليفينج - Azenith Living

---

## 1. هيكل الصفحات والمسارات

### 1.1 مسارات `app/admin/` (الداشبورد الأساسية)

| الصفحة | المسار | الوظيفة |
|--------|--------|---------|
| الصفحة الرئيسية | `/admin` | إعادة توجيه تلقائية إلى `/dashboard` |
| مدير المبيعات | `/admin/sales-manager` | واجهة المتدرب الذكي للمبيعات، إدارة المعرفة والأسئلة المعلقة |
| المحادثات | `/admin/chat` | واجهة Azenith Mind للمحادثات الذكية مع البنية التحتية |
| غرفة العمليات | `/admin/war-room` | لوحة تحكم متقدمة للنظام (Swarm, Defense, Market, Cache) |
| المهندس المعماري | `/admin/architect` | واجهة The Command Horizon للتطوير والبرمجة |
| التسليح | `/admin/arsenal` | إدارة مفاتيح API والموارد والذكاء الصناعي |
| إدارة المفاتيح | `/admin/keys` | إدارة مفاتيح API (Groq, OpenRouter, Mistral, Pexels) |
| الذهني العالي | `/admin/mastermind` | واجهة Mastermind للتحكم المتقدم |
│   ├── المحادثات | `/admin/mastermind/chat` | محادثات Mastermind الذكية |
│   └── الإحصائيات | `/admin/mastermind/stats` | إحصائيات النظام والأوامر |
| السيادة | `/admin/sovereign` | لوحة Sovereign للتحكم الشامل |
| البريم | `/admin/prime` | واجهة Prime للكيان الذكي الأعلى |

### 1.2 مسارات `app/admin-gate/` (بوابة الأدمين)

| الصفحة | المسار | الوظيفة |
|--------|--------|---------|
| البوابة الرئيسية | `/admin-gate` | Sovereign Command Center - لوحة تحكم Master Admin |
| تسجيل الدخول | `/admin-gate/login` | صفحة تسجيل الدخول مع 2FA |
| إعداد الأمان | `/admin-gate/setup-security` | إعداد الأمان الأولي و 2FA |
| نظام إدارة المحتوى | `/admin-gate/cms` | محرر CMS المرئي للموقع |
| البحث الذكي | `/admin-gate/intelligence` | Intelligence Lake للبيانات والتحليلات |

### 1.3 مسارات `app/api/admin/` (واجهات برمجة التطبيقات)

| المسار | الوظيفة |
|--------|---------|
| `/api/admin/keys` | إدارة مفاتيح API (GET, POST, DELETE) |
| `/api/admin/keys/stats` | إحصائيات استخدام المفاتيح |
| `/api/admin/keys/public` | المفاتيح العامة للاستخدام |
| `/api/admin/command` | تنفيذ أوامر موقعة رقمياً |
| `/api/admin/war-room` | بيانات غرفة العمليات |
| `/api/admin/arsenal` | إدارة Arsenal النظام |
| `/api/admin/mastermind` | Mastermind API الرئيسي |
| `/api/admin/mastermind/chat` | محادثات Mastermind |
| `/api/admin/mastermind/stats` | إحصائيات Mastermind |
| `/api/admin/2fa/setup` | إعداد 2FA |
| `/api/admin/2fa/verify` | التحقق من 2FA |
| `/api/admin/2fa/status` | حالة 2FA |
| `/api/admin/2fa/disable` | تعطيل 2FA |
| `/api/admin/prime` | واجهة Prime |
| `/api/admin/silent` | العمليات الصامتة |
| `/api/admin/proactive` | العمليات الاستباقية |
| `/api/admin/supreme` | أوامر Supreme |
| `/api/admin/analyze-lead` | تحليل العملاء المحتملين |

---

## 2. القائمة الجانبية (Sidebar Navigation)

### 2.1 موقع ملف القائمة الجانبية

**الملف:** `app/admin/layout.tsx`

```typescript
// @/app/admin/layout.tsx
const navItems = [
  { href: "/admin", label: "الرئيسية", icon: Home },
  { href: "/admin/sales-manager", label: "مدير المبيعات 🤵", icon: Briefcase },
  { href: "/admin/chat", label: "المحادثات", icon: MessageSquare },
  { href: "/admin/war-room", label: "غرفة العمليات", icon: BarChart3 },
  { href: "/admin/architect", label: "المهندس المعماري", icon: Settings },
];
```

### 2.2 البنود الحالية في القائمة

| الترتيب | الاسم | الأيقونة | الرابط |
|---------|-------|----------|--------|
| 1 | الرئيسية | Home | `/admin` |
| 2 | مدير المبيعات 🤵 | Briefcase | `/admin/sales-manager` |
| 3 | المحادثات | MessageSquare | `/admin/chat` |
| 4 | غرفة العمليات | BarChart3 | `/admin/war-room` |
| 5 | المهندس المعماري | Settings | `/admin/architect` |

### 2.3 كيفية إضافة بند جديد

لإضافة بند جديد للقائمة الجانبية، قم بتعديل الملف `app/admin/layout.tsx`:

```typescript
// @/app/admin/layout.tsx
import { 
  Home, 
  Briefcase, 
  MessageSquare, 
  BarChart3, 
  Settings,
  PlusCircle  // الأيقونة الجديدة
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "الرئيسية", icon: Home },
  { href: "/admin/sales-manager", label: "مدير المبيعات 🤵", icon: Briefcase },
  { href: "/admin/chat", label: "المحادثات", icon: MessageSquare },
  { href: "/admin/war-room", label: "غرفة العمليات", icon: BarChart3 },
  { href: "/admin/architect", label: "المهندس المعماري", icon: Settings },
  // بند جديد
  { href: "/admin/new-page", label: "صفحة جديدة", icon: PlusCircle },
];
```

**ملاحظة:** يجب إنشاء صفحة جديدة في `app/admin/new-page/page.tsx` للبند الجديد.

---

## 3. الصلاحيات والمصادقة

### 3.1 حماية صفحات الداشبورد

#### 3.1.1 Middleware (`middleware.ts`)

```typescript
// @/middleware.ts
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const { supabaseResponse, user } = await updateSession(request);

  // التحقق من admin-gate (باستثناء صفحة تسجيل الدخول)
  if (
    pathname.startsWith("/admin-gate") &&
    !pathname.startsWith("/admin-gate/login") &&
    !user
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin-gate/login";
    return NextResponse.redirect(url);
  }

  // إعادة توجيه المستخدم المسجل دخوله من صفحة الدخول
  if (pathname.startsWith("/admin-gate/login") && user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin-gate";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

#### 3.1.2 المسارات المحمية في Middleware Config

```typescript
export const config = {
  matcher: [
    "/admin-gate/:path*",
    "/elite/:path*",
    "/api/pexels/:path*",
    "/api/room-sections/:path*",
    "/api/curate-images/:path*",
    "/api/elite-gallery/:path*",
    "/api/content-generator/:path*",
    "/api/enhance-image/:path*",
    "/api/:path*",
  ],
};
```

### 3.2 التحقق من صلاحية المستخدم

#### 3.2.1 Master Admin (`lib/admin.ts`)

```typescript
// @/lib/admin.ts
const MASTER_DOMAINS = [
  "admin.azenithliving.com",
  "localhost:3000",
  "127.0.0.1:3000",
];

const getMasterAdminEmails = (): string[] => {
  const emails = process.env.MASTER_ADMIN_EMAILS || "";
  return emails.split(",").map(e => e.trim()).filter(Boolean);
};

export async function isMasterAdmin(): Promise<boolean> {
  const context = await getAdminContext();
  return context.isMasterAdmin;
}

export async function requireMasterAdmin(): Promise<void> {
  if (!(await isMasterAdmin())) {
    throw new Error("Master admin access required");
  }
}
```

#### 3.2.2 التحقق في الصفحات

```typescript
// مثال من @/app/admin-gate/page.tsx
export default async function AdminGateDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await isMasterAdmin();

  if (!isAdmin) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>Only authorized master admins can access this portal.</p>
      </div>
    );
  }
  // ...
}
```

### 3.3 ملفات المصادقة والجلسات

| الملف | الوظيفة |
|-------|---------|
| `lib/auth/session.ts` | إدارة الجلسات الآمنة (Sovereign Vault) |
| `lib/auth/vault.ts` | إدارة الأجهزة الموثوقة |
| `lib/admin.ts` | التحقق من Master Admin |
| `lib/admin-data.ts` | بيانات لوحة تحكم Master Admin |
| `middleware.ts` | حماية المسارات و Rate Limiting |
| `utils/supabase/server.ts` | عميل Supabase للخادم |
| `utils/supabase/client.ts` | عميل Supabase للعميل |
| `utils/supabase/middleware.ts` | تحديث الجلسات في Middleware |

### 3.4 نظام الجلسات (Session System)

```typescript
// @/lib/auth/session.ts
const SESSION_COOKIE_NAME = "azenith_sovereign_session";
const TRUSTED_DEVICE_COOKIE_NAME = "azenith_trusted_device";
const SESSION_DURATION_DAYS = 90;  // للأجهزة الموثوقة
const SESSION_DURATION_MINUTES = 30;  // للأجهزة العادية

export async function createSession(
  adminId: string,
  email: string,
  isTrustedDevice: boolean = false,
  userAgent: string = "",
  ip: string = ""
): Promise<SessionData>

export async function getSession(): Promise<SessionData | null>

export async function requireSession(): Promise<SessionData>

export async function destroySession(): Promise<void>
```

### 3.5 نظام المصادقة الثنائية (2FA)

| API Endpoint | الوظيفة |
|-------------|---------|
| `POST /api/admin/2fa/setup` | إعداد 2FA لأول مرة |
| `POST /api/admin/2fa/verify` | التحقق من رمز 2FA |
| `GET /api/admin/2fa/status` | التحقق من حالة 2FA |
| `POST /api/admin/2fa/disable` | تعطيل 2FA |

---

## 4. المكونات المشتركة

### 4.1 تخطيط الداشبورد (`app/admin/layout.tsx`)

```typescript
// @/app/admin/layout.tsx
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex">
      {/* Sidebar */}
      <aside className="w-64 border-l border-white/10 bg-[#0A0A0A] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-semibold text-[#C5A059]">AZENITH</h1>
          <p className="text-xs text-white/50 mt-1">لوحة التحكم</p>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              {/* ... */}
            </Link>
          ))}
        </nav>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <p className="text-xs text-white/40 text-center">
            أزينث ليفينج © 2025
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

### 4.2 تخطيط Admin-Gate (`app/admin-gate/layout.tsx`)

```typescript
// @/app/admin-gate/layout.tsx
export default async function AdminGateLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Top Navigation - فقط إذا كان المستخدم مسجل دخول */}
      {user && (
        <header className="border-b border-white/10 bg-[#0A0A0A]/95">
          {/* AZENITH SOVEREIGN Logo + User Info */}
        </header>
      )}

      <main className={user ? "mx-auto max-w-7xl px-6 py-8" : ""}>
        {children}
      </main>
    </div>
  );
}
```

### 4.3 مكونات Admin المشتركة (`components/admin/`)

| المكون | الملف | الوظيفة |
|--------|-------|---------|
| MetricCard | `master-dashboard-components.tsx` | بطاقة إحصائيات رئيسية |
| TenantTable | `master-dashboard-components.tsx` | جدول الشركات المستأجرة |
| ActivityFeed | `master-dashboard-components.tsx` | خلاصة النشاطات الأخيرة |
| DistributionChart | `master-dashboard-components.tsx` | رسم بياني للتوزيع |
| GrowthInsights | `GrowthInsights.tsx` | رؤى النمو والتحليلات |

### 4.4 المكتبات المستخدمة في المكونات

```typescript
// الأيقونات
import { 
  Home, MessageSquare, Briefcase, BarChart3, Settings,
  Building2, TrendingUp, Users, Mail, Phone, Clock,
  ArrowUpRight, ArrowDownRight, Crown, Brain, Shield,
  Zap, Sparkles, Command, Terminal, Activity, Globe,
  Infinity, Heart, Lightbulb, Code, Palette
} from "lucide-react";

// الحركات
import { motion, AnimatePresence } from "framer-motion";
```

---

## 5. واجهات برمجة التطبيقات الخاصة بالداشبورد

### 5.1 إدارة المفاتيح (`/api/admin/keys/*`)

#### GET /api/admin/keys
```typescript
// إرجاع جميع المفاتيح (مخفية)
Response: { 
  success: true, 
  keys: ApiKey[], 
  grouped: { groq, openrouter, mistral, pexels } 
}
```

#### POST /api/admin/keys
```typescript
// إضافة مفتاح جديد أو اختبار مفتاح
Body: { provider: string, key: string, test?: boolean }
```

#### DELETE /api/admin/keys
```typescript
// حذف مفتاح
Body: { id: number }
```

### 5.2 التحكم في الأوامر (`/api/admin/command`)

```typescript
// POST /api/admin/command
Body: {
  command: string,        // من قائمة ALLOWED_COMMANDS
  signature: string,        // توقيع رقمي
  parameters: object        // معاملات إضافية
}

// الأوامر المسموح بها:
const ALLOWED_COMMANDS = [
  "test",
  "get_keys",
  "add_key",
  "rate_limit_update",
  "system_status",
  "ping",
  "health_check",
  "get_logs",
  "get_stats",
];
```

### 5.3 غرفة العمليات (`/api/admin/war-room`)

```typescript
// GET /api/admin/war-room
Response: {
  success: true,
  data: {
    swarm: { totalNodes, activeNodes, collectiveIntelligence, consensusRate, regions },
    defense: { systemHealth, activeThreats, blockedIPs, avgLatency },
    market: { scenariosGenerated, opportunitiesFound, revenuePotential, readyToDeploy },
    optimization: { bottlenecksFixed, timeSaved, efficiencyGain, lastOptimization },
    cache: { hitRate, costSavings, entries },
    snapshots: { total, lastSnapshot }
  }
}
```

### 5.4 Arsenal النظام (`/api/admin/arsenal`)

```typescript
// GET /api/admin/arsenal
Response: { success: true, stats: SystemStats }

// POST /api/admin/arsenal
Body: { action: string, payload?: object }
Actions: "clear-cache", "trigger-heal", "update-key-status"
```

### 5.5 Mastermind API

```typescript
// GET /api/admin/mastermind
// GET /api/admin/mastermind/chat
// POST /api/admin/mastermind/chat
// GET /api/admin/mastermind/stats
```

### 5.6 المصادقة الثنائية

```typescript
// GET /api/admin/2fa/status
Response: { enabled: boolean }

// POST /api/admin/2fa/setup
Body: { token: string }
Response: { success: true, message: "2FA enabled" }

// POST /api/admin/2fa/verify
Body: { token: string, isLoginVerification?: boolean }
Response: { success: true, sessionToken?: string }

// POST /api/admin/2fa/disable
Body: { token: string, confirmDisable: boolean }
```

---

## 6. ملخص الأمان

### 6.1 طبقات الأمان

1. **Middleware Layer**: Rate limiting + Session validation
2. **Authentication Layer**: Supabase Auth + 2FA
3. **Authorization Layer**: Master Admin checks (Domain + Email)
4. **API Layer**: Signed commands + 2FA verification
5. **Session Layer**: HttpOnly cookies + Device fingerprinting

### 6.2 التحقق من الهوية

| المستوى | التحقق |
|---------|--------|
| المستخدم العادي | تسجيل دخول Supabase |
| Admin | Master Domain أو Master Email |
| Master Admin | Master Domain + Master Email + 2FA |
| تنفيذ الأوامر | 2FA + توقيع رقمي |

### 6.3 المتغيرات البيئية المطلوبة

```bash
# Master Admin
MASTER_ADMIN_EMAILS=admin@example.com,owner@example.com

# 2FA & Security
VAULT_MASTER_KEY=your-secret-key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 7. الخلاصة

لوحة التحكم في مشروع أزينث ليفينج مقسمة إلى قسمين رئيسيين:

1. **`/admin`**: واجهة الداشبورد الداخلية مع القائمة الجانبية، تحتوي على أدوات المبيعات والمحادثات وغرفة العمليات والتطوير.

2. **`/admin-gate`**: بوابة Master Admin للتحكم الشامل في النظام، تتطلب مصادقة ثنائية (2FA) وتمكّن من إدارة الشركات والمحتوى.

النظام يستخدم مصادقة متعددة الطبقات:
- Middleware للتحقق من الجلسات
- Supabase Auth للمصادقة الأساسية
- التحقق من Master Admin حسب النطاق أو البريد
- 2FA للعمليات الحساسة
- توقيع رقمي للأوامر المهمة

---

*آخر تحديث: أبريل 2026*
*المستند: ADMIN_DASHBOARD_REPORT.md*
