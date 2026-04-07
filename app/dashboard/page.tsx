import Link from "next/link";

import { getDashboardSnapshot } from "@/lib/dashboard";

export default async function Dashboard() {
  const snapshot = await getDashboardSnapshot();

  if (snapshot.setupError) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-8 text-right">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Setup required</p>
          <h1 className="mt-4 font-serif text-4xl text-white md:text-5xl">الداشبورد متوقف لأن schema Supabase غير مفعّلة بعد.</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/65">{snapshot.setupError}</p>
        </div>
      </main>
    );
  }

  if (!snapshot.tenant) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-right">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Tenant status</p>
          <h1 className="mt-4 font-serif text-4xl text-white md:text-5xl">لا توجد شركة مفعلة لهذا الدومين بعد.</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/65">البنية متعددة المستأجرين جاهزة، لكن يجب إضافة الشركة من لوحة التحكم وربط الدومين قبل ظهور بيانات حقيقية في الـ CRM.</p>
          <div className="mt-8">
            <Link href="/dashboard/tenants" className="inline-flex rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
              انتقل لإدارة المستأجرين
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Control center</p>
          <h1 className="font-serif text-4xl text-white md:text-5xl">لوحة تشغيل {snapshot.tenant.name}</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6"><p className="text-sm text-white/50">العملاء المحتملون</p><p className="mt-3 text-4xl font-semibold text-white">{snapshot.leadCount}</p></div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6"><p className="text-sm text-white/50">الطلبات</p><p className="mt-3 text-4xl font-semibold text-white">{snapshot.requestCount}</p></div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6"><p className="text-sm text-white/50">نقرات واتساب</p><p className="mt-3 text-4xl font-semibold text-white">{snapshot.whatsappCount}</p></div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-brand-primary">Tenant system</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">إدارة المستأجرين</h2>
            </div>
            <Link href="/dashboard/tenants" className="inline-flex rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
              افتح صفحة المستأجرين
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/60">يمكنك إنشاء مستأجرين جدد وإدارة شركات النظام من هنا لاحقاً.</p>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-brand-primary">Automation system</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">نظام الأتمتة</h2>
            </div>
            <Link href="/dashboard/automation" className="inline-flex rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
              افتح نظام الأتمتة
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/60">إدارة القواعد الآلية وتتبع الإجراءات المنفذة تلقائياً.</p>
        </div>        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-brand-primary">Analytics</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">التحليلات والإحصائيات</h2>
            </div>
            <Link href="/dashboard/analytics" className="inline-flex rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
              افتح التحليلات
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/60">عرض كامل للبيانات والإحصائيات والتقارير التفصيلية.</p>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-brand-primary">Content Generator</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">منشئ المحتوى الذكي</h2>
            </div>
            <Link href="/dashboard/content-generator" className="inline-flex rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
              استخدم منشئ المحتوى
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/60">توليد محتوى متقدم باستخدام الذكاء الاصطناعي.</p>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-brand-primary">Billing</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">الفواتير والخطط</h2>
            </div>
            <Link href="/dashboard/billing" className="inline-flex rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
              إدارة الفواتير
            </Link>
          </div>
          <p className="mt-4 text-sm text-white/60">إدارة الاشتراكات والفواتير وطرق الدفع.</p>
        </div>        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div><p className="text-sm text-brand-primary">آخر العملاء</p><h2 className="mt-2 text-2xl font-semibold text-white">آخر 10 leads</h2></div>
            <Link href="/dashboard/leads" className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 transition hover:border-brand-primary hover:text-brand-primary">فتح صفحة العملاء</Link>
          </div>
          <div className="space-y-3">
            {snapshot.leads.length === 0 ? <p className="text-sm text-white/55">لا توجد Leads محفوظة بعد.</p> : snapshot.leads.map((lead) => (
              <div key={lead.id} className="grid gap-3 rounded-[1.5rem] border border-white/8 bg-[#111112] px-4 py-4 text-sm text-white/72 md:grid-cols-[1.2fr_0.9fr_0.6fr_0.8fr]">
                <span>{lead.roomType}</span>
                <span>{lead.serviceType}</span>
                <span>Score: {lead.score}</span>
                <span>{lead.intent}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
