import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buildPageMetadata, SEO_LANDING_PAGES, SEO_ROOMS, absoluteUrl } from "@/lib/seo";

type SeoPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(SEO_LANDING_PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: SeoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = SEO_LANDING_PAGES[slug];

  if (!page) {
    return {
      title: "صفحة غير موجودة",
      robots: { index: false, follow: false },
    };
  }

  return buildPageMetadata({
    title: page.title,
    description: page.description,
    path: `/seo/${page.slug}`,
    keywords: [page.focus, page.title, "أزينث ليفينج", "Azenith Living"],
  });
}

export default async function SeoPage({ params }: SeoPageProps) {
  const { slug } = await params;
  const page = SEO_LANDING_PAGES[slug];

  if (!page) {
    notFound();
  }

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "الرئيسية", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: page.title, item: absoluteUrl(`/seo/${page.slug}`) },
    ],
  };

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([faqJsonLd, breadcrumbJsonLd]) }}
      />

      <article className="mx-auto max-w-5xl space-y-10">
        <header className="space-y-5">
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Azenith SEO Guide</p>
          <h1 className="font-serif text-4xl text-white md:text-6xl">{page.title}</h1>
          <p className="max-w-3xl text-base leading-8 text-white/70">{page.description}</p>
          <p className="max-w-3xl text-sm leading-7 text-white/50">{page.intent}</p>
        </header>

        <section className="grid gap-5 md:grid-cols-3">
          {page.sections.map((section) => (
            <div key={section.heading} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-xl font-semibold text-white">{section.heading}</h2>
              <p className="mt-3 text-sm leading-7 text-white/65">{section.body}</p>
            </div>
          ))}
        </section>

        <section className="space-y-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-7">
          <h2 className="text-2xl font-semibold text-white">كيف تساعدك أزينث ليفينج؟</h2>
          <p className="text-sm leading-8 text-white/70">
            نترجم نية البحث إلى قرار واضح: اختيار المساحة، فهم الأولويات، تقدير اتجاه الميزانية، ثم إرسال طلب منظم للفريق. لذلك صممنا صفحات الغرف، الأثاث، وخطوات البداية لتقود الزائر من الاستكشاف إلى التواصل دون ارتباك.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/start" className="rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-brand-accent">
              ابدأ رحلة التصميم
            </Link>
            <Link href="/request" className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:border-brand-primary">
              اطلب استشارة
            </Link>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-white">أسئلة شائعة</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {page.faqs.map((faq) => (
              <div key={faq.question} className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                <p className="mt-2 text-sm leading-7 text-white/65">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-2xl font-semibold text-white">مساحات مرتبطة</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {page.relatedRooms.map((slug) => {
              const room = SEO_ROOMS[slug];
              if (!room) return null;
              return (
                <Link key={slug} href={`/rooms/${slug}`} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 transition hover:border-brand-primary">
                  <p className="text-sm text-brand-primary">{room.titleEn}</p>
                  <h3 className="mt-2 text-xl font-semibold text-white">{room.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/60">{room.description}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </article>
    </main>
  );
}
