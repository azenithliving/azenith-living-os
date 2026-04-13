"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
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
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-white">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-md">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#C5A059]">تعذر إكمال العرض</p>
        <h2 className="mb-4 text-3xl font-semibold">حدث خطأ غير متوقع في الصفحة</h2>
        <p className="mb-8 text-sm leading-7 text-white/70">
          يمكنك إعادة المحاولة الآن، أو الرجوع إلى الصفحة الرئيسية ومتابعة التصفح. إذا استمر الخطأ فغالبًا توجد مشكلة مؤقتة في
          التحميل.
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition-colors hover:border-[#C5A059]/50 hover:text-[#C5A059]"
          >
            العودة للرئيسية
          </Link>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-full bg-[#C5A059] px-6 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    </div>
  );
}
