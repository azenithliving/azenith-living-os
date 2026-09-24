import Link from "next/link";

export default function V2RootPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8" dir="rtl">
      <div className="max-w-lg w-full rounded-[2rem] border border-white/10 bg-white/[0.02] p-10 text-center">
        <p className="text-sm text-white/40">البيت الجديد — مطابق للقديم — فاضي</p>
        <h1 className="text-xl font-black text-white mt-2">نظرة عامة</h1>
        <p className="text-sm text-white/30 mt-2">هذه الصفحة فاضية — سيُنقل المحتوى لاحقاً على نظيف</p>
        <Link href="/admin" className="inline-block mt-6 text-xs px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white">← افتح القديم</Link>
      </div>
    </div>
  );
}
