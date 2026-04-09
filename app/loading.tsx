export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#050505] px-6 text-white">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#C5A059]/30 border-t-[#C5A059]" />
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#C5A059]">Azenith Living</p>
          <h2 className="text-2xl font-semibold">جارٍ تجهيز التجربة</h2>
          <p className="text-sm leading-7 text-white/70">نحمّل الصفحة الرئيسية ونرتب المحتوى لتظهر لك التجربة كاملة بدون انقطاع.</p>
        </div>
      </div>
    </div>
  );
}
