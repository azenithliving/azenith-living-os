import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
      <p className="text-sm uppercase tracking-[0.3em] text-[#C5A059]">404</p>
      <h1 className="mt-4 font-serif text-4xl md:text-5xl">الصفحة غير موجودة</h1>
      <p className="mt-4 max-w-md text-white/60">
        الرابط الذي طلبته غير متاح. يمكنك العودة للرئيسية أو استكشاف المساحات.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link
          href="/"
          className="rounded-full border border-[#C5A059]/50 bg-[#C5A059]/10 px-6 py-3 text-sm font-medium text-[#C5A059] transition hover:bg-[#C5A059]/20"
        >
          الرئيسية
        </Link>
        <Link
          href="/rooms"
          className="rounded-full border border-white/15 px-6 py-3 text-sm text-white/80 transition hover:border-white/30"
        >
          المساحات
        </Link>
      </div>
    </main>
  );
}
