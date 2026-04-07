import Link from "next/link";
import { notFound } from "next/navigation";

import { getSeoDefinition, roomDefinitions } from "@/lib/site-content";

type SeoPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function SeoPage({ params }: SeoPageProps) {
  const { slug } = await params;
  const page = getSeoDefinition(slug);

  if (!page) {
    notFound();
  }

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">SEO landing</p>
          <h1 className="font-serif text-4xl text-white md:text-6xl">{page.title}</h1>
          <p className="max-w-3xl text-base leading-8 text-white/65">{page.description}</p>
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-7 text-sm leading-8 text-white/72">
          <p>هذه الصفحة مبنية كصفحة هبوط متخصصة حول {page.focus}، بهدف التقاط نية البحث وتحويلها إلى طلب فعلي أو محادثة واتساب. المحتوى هنا هو baseline إنتاجي يمكن توسيعه لاحقًا عبر CMS وpipeline النشر.</p>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          {roomDefinitions.slice(0, 4).map((room) => (
            <Link key={room.slug} href={`/room/${room.slug}`} className="rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand-primary">
              <p className="text-sm text-brand-primary">{room.eyebrow}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{room.title}</h2>
              <p className="mt-2 text-sm leading-7 text-white/60">{room.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
