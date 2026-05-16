"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home } from "lucide-react";

export default function RoomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Room Page Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-[#0a0a0a] px-4 py-16 text-center text-white">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 text-red-500">
        <AlertTriangle className="h-10 w-10" />
      </div>
      
      <h2 className="mb-4 text-3xl font-bold md:text-4xl">عذراً، حدث خطأ مفاجئ</h2>
      
      <p className="mx-auto mb-8 max-w-lg text-gray-400">
        واجهنا مشكلة أثناء تحميل تفاصيل هذه الغرفة. قد يكون هذا بسبب ضغط على الشبكة أو تحديثات جارية في النظام.
      </p>
      
      <div className="flex flex-col gap-4 sm:flex-row">
        <button
          onClick={reset}
          className="rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]"
        >
          المحاولة مرة أخرى
        </button>
        
        <Link
          href="/"
          className="flex items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-white/10"
        >
          <Home className="h-4 w-4" />
          العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}
