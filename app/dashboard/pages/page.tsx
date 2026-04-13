"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Page = {
  id: string;
  slug: string;
  title: string;
  status: string;
  created_at: string;
};

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPages();
  }, []);

  const fetchPages = async () => {
    try {
      const response = await fetch("/api/pages");
      const data = await response.json();

      if (data.ok) {
        setPages(data.pages || []);
      } else {
        setError(data.message || "Failed to fetch pages");
      }
    } catch {
      setError("Failed to fetch pages");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "text-green-400 bg-green-500/20";
      case "draft":
        return "text-yellow-400 bg-yellow-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "published":
        return "منشور";
      case "draft":
        return "مسودة";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white">جاري تحميل الصفحات...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-red-400">خطأ: {error}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Site builder</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">إدارة الصفحات</h1>
          </div>
          <Link href="/dashboard/pages/new" className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
            إضافة صفحة جديدة
          </Link>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">الصفحات الحالية</h2>
          <p className="mt-2 text-sm text-white/60">إدارة وتخصيص صفحات الموقع.</p>

          {pages.length === 0 ? (
            <div className="mt-6 text-center text-white/60">
              لا توجد صفحات حتى الآن. أنشئ صفحة جديدة للبدء.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {pages.map((page) => (
                <div key={page.id} className="flex items-center justify-between rounded-lg border border-white/8 bg-[#111112] p-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{page.title}</h3>
                    <div className="mt-1 flex items-center gap-3">
                      <p className="text-sm text-white/60">/{page.slug}</p>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(page.status)}`}>
                        {getStatusText(page.status)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/pages/${page.slug}`}
                      target="_blank"
                      className="rounded border border-white/10 px-3 py-1 text-sm text-white/70 transition hover:border-blue-500 hover:text-blue-400"
                    >
                      عرض
                    </Link>
                    <Link
                      href={`/dashboard/pages/edit/${page.id}`}
                      className="rounded border border-white/10 px-3 py-1 text-sm text-white/70 transition hover:border-brand-primary hover:text-brand-primary"
                    >
                      تعديل
                    </Link>
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