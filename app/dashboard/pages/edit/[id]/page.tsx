"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Page = {
  id: string;
  slug: string;
  title: string;
  status: string;
  seo_title?: string;
  seo_description?: string;
  og_image?: string;
};

type Section = {
  id: string;
  type: string;
  position: number;
  config: Record<string, unknown>;
  status: string;
};

export default function EditPage() {
  const params = useParams();
  const router = useRouter();
  const [page, setPage] = useState<Page | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadPage = async () => {
    try {
      const [pageResponse, sectionsResponse] = await Promise.all([
        fetch(`/api/pages/${params.id}`),
        fetch(`/api/pages/${params.id}/sections`),
      ]);

      const pageData = await pageResponse.json();
      const sectionsData = await sectionsResponse.json();

      if (pageData.ok) {
        setPage(pageData.page);
      }
      if (sectionsData.ok) {
        setSections(sectionsData.sections || []);
      }
    } catch (error) {
      console.error("Failed to load page:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const savePage = async () => {
    if (!page) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/pages/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      if (response.ok) {
        router.push("/dashboard/pages");
      }
    } catch (error) {
      console.error("Failed to save page:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white">جاري تحميل الصفحة...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!page) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-red-400">الصفحة غير موجودة</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl text-white">تعديل الصفحة: {page.title}</h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard/pages")}
              className="rounded border border-white/20 px-4 py-2 text-sm text-white/70 hover:border-white/50"
            >
              إلغاء
            </button>
            <button
              onClick={savePage}
              disabled={saving}
              className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-accent hover:bg-[#d8b56d] disabled:opacity-50"
            >
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </div>
        </div>

        {/* Page Settings */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-xl font-semibold text-white mb-6">إعدادات الصفحة</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="editpage-title" className="block text-sm font-medium text-white/70 mb-2">
                عنوان الصفحة
              </label>
              <input
                id="editpage-title"
                type="text"
                value={page.title}
                onChange={(e) => setPage({ ...page, title: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

            <div>
              <label htmlFor="editpage-slug" className="block text-sm font-medium text-white/70 mb-2">
                الرابط (Slug)
              </label>
              <input
                id="editpage-slug"
                type="text"
                value={page.slug}
                onChange={(e) => setPage({ ...page, slug: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

            <div>
              <label htmlFor="editpage-status" className="block text-sm font-medium text-white/70 mb-2">
                الحالة
              </label>
              <select
                id="editpage-status"
                value={page.status}
                onChange={(e) => setPage({ ...page, status: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              >
                <option value="draft">مسودة</option>
                <option value="published">منشور</option>
              </select>
            </div>

          </div>
        </div>

        {/* SEO Settings */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-xl font-semibold text-white mb-6">إعدادات SEO</h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="editpage-seotitle" className="block text-sm font-medium text-white/70 mb-2">
                عنوان SEO
              </label>
              <input
                id="editpage-seotitle"
                type="text"
                value={page.seo_title || ""}
                onChange={(e) => setPage({ ...page, seo_title: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

            <div>
              <label htmlFor="editpage-seodesc" className="block text-sm font-medium text-white/70 mb-2">
                وصف SEO
              </label>
              <textarea
                id="editpage-seodesc"
                value={page.seo_description || ""}
                onChange={(e) => setPage({ ...page, seo_description: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                rows={3}
              />
            </div>

            <div>
              <label htmlFor="editpage-ogimage" className="block text-sm font-medium text-white/70 mb-2">
                صورة OG
              </label>
              <input
                id="editpage-ogimage"
                type="text"
                value={page.og_image || ""}
                onChange={(e) => setPage({ ...page, og_image: e.target.value })}
                className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
              />
            </div>

          </div>
        </div>

        {/* Page Sections */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">أقسام الصفحة</h2>
            <button className="rounded bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-accent hover:bg-[#d8b56d]">
              إضافة قسم
            </button>
          </div>

          {sections.length === 0 ? (
            <div className="text-center text-white/60 py-8">
              لا توجد أقسام في هذه الصفحة
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white capitalize">{section.type}</h3>
                      <p className="text-sm text-white/60">الموضع: {section.position}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded border border-white/20 px-3 py-1 text-sm text-white/70 hover:border-brand-primary hover:text-brand-primary">
                        تعديل
                      </button>
                      <button className="rounded border border-red-500/20 px-3 py-1 text-sm text-red-400 hover:border-red-500">
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}