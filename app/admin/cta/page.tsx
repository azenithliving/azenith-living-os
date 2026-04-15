export default function CTAPage() {
  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Call-to-action</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">دعوات العمل</h1>
          </div>
          <button className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
            إنشاء CTA جديد
          </button>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">دعوات العمل النشطة</h2>
          <p className="mt-2 text-sm text-white/60">إدارة وتخصيص دعوات العمل في الموقع.</p>
          <div className="mt-6 space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">طلب عرض أسعار</h3>
                  <p className="mt-1 text-sm text-white/60">دعوة للعملاء للحصول على عرض أسعار مجاني</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-brand-primary/20 px-3 py-1 text-xs text-brand-primary">الصفحة الرئيسية</span>
                    <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">نشط</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded border border-white/20 px-4 py-2 text-sm text-white/70 hover:border-brand-primary hover:text-brand-primary">
                    تعديل
                  </button>
                  <button className="rounded border border-red-500/20 px-4 py-2 text-sm text-red-400 hover:border-red-500">
                    حذف
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">استكشف الغرف</h3>
                  <p className="mt-1 text-sm text-white/60">دعوة لتصفح مجموعة الغرف المتاحة</p>
                  <div className="mt-3 flex gap-2">
                    <span className="rounded-full bg-brand-primary/20 px-3 py-1 text-xs text-brand-primary">صفحة الغرف</span>
                    <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">نشط</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="rounded border border-white/20 px-4 py-2 text-sm text-white/70 hover:border-brand-primary hover:text-brand-primary">
                    تعديل
                  </button>
                  <button className="rounded border border-red-500/20 px-4 py-2 text-sm text-red-400 hover:border-red-500">
                    حذف
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}