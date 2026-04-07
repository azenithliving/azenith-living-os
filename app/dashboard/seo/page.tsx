export default function SEOPage() {
  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">SEO settings</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">إعدادات SEO</h1>
          </div>
          <button className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
            حفظ التغييرات
          </button>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white">معلومات الموقع الأساسية</h2>
            <p className="mt-2 text-sm text-white/60">إعدادات SEO الأساسية للموقع.</p>
            <div className="mt-6 space-y-4">
              <div>
                <label htmlFor="seo-site-title" className="text-sm text-white/80">عنوان الموقع:</label>
                <input
                  id="seo-site-title"
                  type="text"
                  defaultValue="Azenith Living - تصميم داخلي فاخر"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-sm text-white/80">وصف الموقع:</label>
                <textarea
                  rows={3}
                  defaultValue="نحن متخصصون في تصميم الديكور الداخلي الفاخر للمنازل والمكاتب في الرياض"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-white/80">الكلمات المفتاحية:</label>
                <input
                  type="text"
                  defaultValue="تصميم داخلي, ديكور, رياض, فاخر"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-2xl font-semibold text-white">وسوم Open Graph</h2>
            <p className="mt-2 text-sm text-white/60">إعدادات مشاركة الموقع على وسائل التواصل.</p>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm text-white/80">عنوان Open Graph:</label>
                <input
                  type="text"
                  defaultValue="Azenith Living - تصميم داخلي فاخر"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-white/80">وصف Open Graph:</label>
                <textarea
                  rows={2}
                  defaultValue="نحن متخصصون في تصميم الديكور الداخلي الفاخر"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-white/80">صورة Open Graph:</label>
                <input
                  type="url"
                  placeholder="https://example.com/og-image.jpg"
                  className="mt-2 w-full rounded border border-white/20 bg-transparent px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}