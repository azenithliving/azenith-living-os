import { listShelf } from "@/lib/shop/shelf";
import { priceLine, SHELF_EMPTY_LINE } from "@/lib/shop/words";

export const dynamic = "force-dynamic";

/**
 * The customer's ready-products shelf.
 *
 * His business is made-to-order, so this shelf is the exception rather than the rule: a piece that
 * was already executed and is waiting for someone to take it. While there is none the page says so
 * in the visitor's own language instead of showing an empty grid — measured on the published site,
 * an empty grid reads as a shop that closed.
 */
export default async function ShopPage() {
  const pieces = await listShelf();

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16" dir="rtl" data-shelf-state={pieces.length ? "stocked" : "empty"}>
      <div className="mx-auto max-w-7xl space-y-12">
        <div className="space-y-5 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-primary/70">متجر أزينث</p>
          <h1 className="font-serif text-4xl text-white md:text-6xl">قطع جاهزة للّاقي</h1>
          <p className="mx-auto max-w-3xl text-lg leading-8 text-white/80">
            اللي على الرفّ ده اتنفّذ فعلاً في مشاريع، وموجود بسعره — تاخده من غير انتظار. واللي مش
            لاقيه هنا بننفّذه على مقاسك زي باقي شغلنا.
          </p>
        </div>

        {pieces.length === 0 ? (
          <section className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-brand-primary/30 bg-white/[0.02] px-6 py-14 text-center">
            <p className="font-serif text-3xl text-brand-primary md:text-5xl">قريبًا</p>
            <p className="mt-5 text-base leading-8 text-white/85">{SHELF_EMPTY_LINE}</p>
            <p className="mt-3 text-sm leading-7 text-white/85">
              شغلنا الأساسي بيتنفّذ على مقاس كل بيت: تختار التصميم، نتفق، وبعدين ننفّذ. تحب تشوف
              الموديلات اللي بننفّذها أو تكلّمنا مباشرة؟
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/rooms"
                className="rounded-full border border-white/20 px-7 py-3 text-base font-semibold text-white transition-colors hover:border-brand-primary hover:text-brand-primary"
              >
                تصفّح الغرف
              </a>
              <a
                href="/request"
                className="rounded-full bg-brand-primary px-7 py-3 text-base font-bold text-[#1A1A1B] transition-transform hover:scale-[1.02]"
              >
                كلّمنا على مقاسك
              </a>
            </div>
          </section>
        ) : (
          <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {pieces.map((piece) => (
              <article
                key={piece.id}
                className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] transition-colors hover:border-brand-primary/40"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/40">
                  {/* The cover is his own photograph from the store's bucket or a licensed link,
                      so it is drawn as a plain image — the site's image allow-list carries only
                      the picture bank's host. */}
                  <img
                    src={piece.coverUrl}
                    alt={piece.name || "قطعة جاهزة"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-3 p-5">
                  <h2 className="text-xl font-bold text-white">{piece.name}</h2>
                  {piece.shortDescription ? (
                    <p className="text-sm leading-7 text-white/85">{piece.shortDescription}</p>
                  ) : null}
                  <p className="text-lg font-black text-brand-primary">{priceLine(piece.price)}</p>
                  <a
                    href="/request"
                    className="inline-block rounded-full border border-brand-primary/40 px-5 py-2.5 text-sm font-bold text-brand-primary transition-colors hover:bg-brand-primary hover:text-[#1A1A1B]"
                  >
                    احجزها
                  </a>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
