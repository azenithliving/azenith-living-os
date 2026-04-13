"use client";

import { useEffect } from "react";

import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ar-EG" dir="rtl" className="h-full antialiased">
      <head>
        <title>حدث خطأ | أزينث ليفينج</title>
      </head>
      <body className="min-h-screen bg-[#050505] text-white">
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-md">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#C5A059]">Azenith Living</p>
            <h1 className="mb-4 text-3xl font-semibold">تعذر تحميل التطبيق الآن</h1>
            <p className="mb-8 text-sm leading-7 text-white/70">
              حدث خلل على مستوى التطبيق منع تحميل الصفحة. يمكنك إعادة المحاولة، وإذا استمرت المشكلة فارجع بعد قليل.
            </p>
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="rounded-full bg-[#C5A059] px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
