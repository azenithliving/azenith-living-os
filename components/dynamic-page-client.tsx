"use client";

import { useEffect } from "react";

import Image from "next/image";
import type { RuntimeConfig } from "@/lib/runtime-config";
import useSessionStore from "@/stores/useSessionStore";
import type { PageData, SectionData } from "@/app/[locale]/pages/[slug]/page";

type DynamicPageClientProps = {
  pageData: PageData;
  runtimeConfig: RuntimeConfig;
};

function renderSection(section: SectionData, runtimeConfig: RuntimeConfig) {
  const config = section.config as Record<string, unknown>;
  switch (section.type) {
    case "hero": {
      const eyebrow = typeof config.eyebrow === "string" ? config.eyebrow : undefined;
      const title = typeof config.title === "string" ? config.title : undefined;
      const description = typeof config.description === "string" ? config.description : undefined;
      const primaryCtaHref = typeof config.primaryCtaHref === "string" ? config.primaryCtaHref : undefined;
      const secondaryCtaHref = typeof config.secondaryCtaHref === "string" ? config.secondaryCtaHref : undefined;
      const primaryCtaText = typeof config.primaryCtaText === "string" ? config.primaryCtaText : undefined;
      const secondaryCtaText = typeof config.secondaryCtaText === "string" ? config.secondaryCtaText : undefined;
      const imageUrl = typeof config.imageUrl === "string" ? config.imageUrl : undefined;
      const imageAlt = typeof config.imageAlt === "string" ? config.imageAlt : undefined;

      return (
        <section className="relative min-h-screen px-6 pb-24 pt-10 md:px-10 lg:px-16">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,160,89,0.22),transparent_28%),radial-gradient(circle_at_left_center,rgba(255,255,255,0.06),transparent_22%)]" />
          <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-16 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-8">
              <div className="space-y-4">
                <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">
                  {eyebrow || runtimeConfig.brandNameAr}
                </p>
                <h1 className="font-serif text-4xl text-white md:text-6xl">
                  {title || "تصميم داخلي فاخر"}
                </h1>
                <p className="max-w-3xl text-base leading-8 text-white/65">
                  {description || "نحن متخصصون في تصميم الديكور الداخلي الفاخر للمنازل والمكاتب"}
                </p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row">
                <a
                  href={primaryCtaHref || "/start"}
                  className="rounded-full bg-brand-primary px-8 py-4 text-center font-semibold text-brand-accent transition hover:bg-[#d8b56d]"
                >
                  {primaryCtaText || "ابدأ الآن"}
                </a>
                <a
                  href={secondaryCtaHref || "/rooms"}
                  className="rounded-full border border-white/20 px-8 py-4 text-center text-white transition hover:border-brand-primary hover:text-brand-primary"
                >
                  {secondaryCtaText || "استكشف الغرف"}
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square overflow-hidden rounded-[2rem] bg-white/5">
                {imageUrl && (
                  <Image
                    src={imageUrl}
                    alt={imageAlt || ""}
                    fill
                    className="object-cover"
                  />
                )}
              </div>
            </div>
          </div>
        </section>
      );
    }

    case "text": {
      const titleStr = typeof config.title === "string" ? config.title : null;
      const contentStr = typeof config.content === "string" ? config.content : null;
      return (
        <section className="px-6 py-12 md:px-10 lg:px-16">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="space-y-4">
              {titleStr && (
                <h2 className="font-serif text-3xl text-white md:text-4xl">
                  {titleStr}
                </h2>
              )}
              {contentStr && (
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: contentStr }}
                />
              )}
            </div>
          </div>
        </section>
      );
    }

    case "gallery":
      return (
        <section className="px-6 py-12 md:px-10 lg:px-16">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.isArray(config.images) && config.images.map((image: { url: string; alt?: string }, index: number) => (
                <div key={index} className="aspect-square overflow-hidden rounded-[1.75rem] bg-white/5">
                  <Image
                    src={image.url}
                    alt={image.alt || ""}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    default:
      return (
        <section className="px-6 py-12 md:px-10 lg:px-16">
          <div className="mx-auto max-w-5xl">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
              <p className="text-white/60">Section type &quot;{section.type}&quot; not implemented yet.</p>
            </div>
          </div>
        </section>
      );
  }
}

export default function DynamicPageClient({ pageData, runtimeConfig }: DynamicPageClientProps) {
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);

  useEffect(() => {
    updateProfile({ lastPage: `/pages/${pageData.slug}` });
    trackEvent("page_view");
  }, [trackEvent, updateProfile, pageData.slug]);

  return (
    <main className="relative overflow-hidden">
      {pageData.sections.map((section: SectionData) => (
        <div key={section.id}>
          {renderSection(section, runtimeConfig)}
        </div>
      ))}
    </main>
  );
}