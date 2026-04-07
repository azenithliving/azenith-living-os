"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    slug: "",
    status: "draft",
    seo_title: "",
    seo_description: "",
    og_image: "",
  });
  const [saving, setSaving] = useState(false);

  const createPage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        router.push("/dashboard/pages");
      }
    } catch (error) {
      console.error("Failed to create page:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <h1 className="font-serif text-3xl text-white">إضافة صفحة جديدة</h1>
        </div>

        <form onSubmit={createPage} className="space-y-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-xl font-semibold text-white mb-6">معلومات الصفحة</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="newpage-title" className="block text-sm font-medium text-white/70 mb-2">
                  عنوان الصفحة *
                </label>
                <input
                  id="newpage-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="newpage-slug" className="block text-sm font-medium text-white/70 mb-2">
                  الرابط (Slug) *
                </label>
                <input
                  id="newpage-slug"
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  required
                />
              </div>

              <div>
                <label htmlFor="newpage-status" className="block text-sm font-medium text-white/70 mb-2">
                  الحالة
                </label>
                <select
                  id="newpage-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                >
                  <option value="draft">مسودة</option>
                  <option value="published">منشور</option>
                </select>
              </div>

            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
            <h2 className="text-xl font-semibold text-white mb-6">إعدادات SEO</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="newpage-seotitle" className="block text-sm font-medium text-white/70 mb-2">
                  عنوان SEO
                </label>
                <input
                  id="newpage-seotitle"
                  type="text"
                  value={form.seo_title}
                  onChange={(e) => setForm({ ...form, seo_title: e.target.value })}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                />
              </div>

              <div>
                <label htmlFor="newpage-seodesc" className="block text-sm font-medium text-white/70 mb-2">
                  وصف SEO
                </label>
                <textarea
                  id="newpage-seodesc"
                  value={form.seo_description}
                  onChange={(e) => setForm({ ...form, seo_description: e.target.value })}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                  rows={3}
                />
              </div>

              <div>
                <label htmlFor="newpage-ogimage" className="block text-sm font-medium text-white/70 mb-2">
                  صورة OG
                </label>
                <input
                  id="newpage-ogimage"
                  type="text"
                  value={form.og_image}
                  onChange={(e) => setForm({ ...form, og_image: e.target.value })}
                  className="w-full rounded border border-white/20 bg-white/[0.05] px-3 py-2 text-white"
                />
              </div>

            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/dashboard/pages")}
              className="rounded border border-white/20 px-6 py-2 text-sm text-white/70 hover:border-white/50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-brand-primary px-6 py-2 text-sm font-semibold text-brand-accent hover:bg-[#d8b56d] disabled:opacity-50"
            >
              {saving ? "جاري الإنشاء..." : "إنشاء الصفحة"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}