"use client";

import { useEffect, useState } from "react";

import { ArrowLeft, CheckCircle2, Compass, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { buildWhatsAppUrl } from "@/lib/conversion-engine";
import type { RuntimeConfig } from "@/lib/runtime-config";
import { executionTimeline, packageLadder, roomDefinitions, trustPoints } from "@/lib/site-content";
import AIStylePicker from "./AIStylePicker";
import useSessionStore from "@/stores/useSessionStore";

type HomePageClientProps = {
  runtimeConfig: RuntimeConfig;
};

function isExternalHref(href: string) {
  return href.startsWith("https://");
}

const roomQueries: Record<string, string> = {
  'master-bedroom': 'luxury master bedroom',
  'living-room': 'modern living room',
  'kitchen': 'luxury kitchen',
  'dressing-room': 'walk-in closet',
  'dining-room': 'elegant dining',
  'home-office': 'luxury home office',
  'youth-room': 'modern youth bedroom',
  'interior-design': 'luxury interior design home'
};

export default function HomePageClient({ runtimeConfig }: HomePageClientProps) {
  const intent = useSessionStore((state) => state.intent);
  const roomType = useSessionStore((state) => state.roomType);
  const budget = useSessionStore((state) => state.budget);
  const style = useSessionStore((state) => state.style);
  const serviceType = useSessionStore((state) => state.serviceType);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);

  const [roomImages, setRoomImages] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState<string>('modern');
  const [styleSwitchCount] = useState(0);

  useEffect(() => {
    const fetchRoomImages = async () => {
      setRoomImages({});
      setLoading(true);
      const imagePromises = roomDefinitions.map(async (room) => {
        try {
          const query = `${selectedStyle} ${roomQueries[room.slug] || room.title}`;
          const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}`);
          const data = await res.json();
          const img = data.photos?.[0]?.src?.large || `https://source.unsplash.com/600x400/?${room.title.replace(/\\s+/g, '-').toLowerCase()}`;
          return { [room.slug]: img };
        } catch {
          return { [room.slug]: `https://source.unsplash.com/600x400/?${room.title.replace(/\\s+/g, '-').toLowerCase()}` };
        }
      });
      const images = await Promise.all(imagePromises);
      setRoomImages(Object.assign({}, ...images));
      setLoading(false);
    };
    fetchRoomImages();
  }, [selectedStyle]);

  useEffect(() => {
    updateProfile({ lastPage: "/" });
    trackEvent("page_view");
  }, [trackEvent, updateProfile]);

  const primaryCtaText = styleSwitchCount > 3 ? "حائر بين الستايلات؟ اطلب استشارة دمج مجانية" : (intent === "buyer" && runtimeConfig.whatsappNumber ? "تحدث مع مهندس التصميم الآن" : "ابدأ رحلة التصميم");
  const profile = { roomType, budget, style, serviceType, intent };
  const whatsappUrl = runtimeConfig.whatsappNumber ? buildWhatsAppUrl(runtimeConfig.whatsappNumber, profile, runtimeConfig.brandNameAr) : "/start";
  const primaryHref = intent === "buyer" && runtimeConfig.whatsappNumber ? whatsappUrl : "/start";

  const handlePrimaryClick = () => {
    trackEvent(intent === "buyer" && runtimeConfig.whatsappNumber ? "whatsapp_click" : "click_cta");
  };

  return (
    <main className="relative overflow-hidden">
      <section className="relative min-h-screen px-6 pb-24 pt-10 md:px-10 lg:px-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(197,160,89,0.22),transparent_28%),radial-gradient(circle_at_left_center,rgba(255,255,255,0.06),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.03),transparent_45%),linear-gradient(180deg,rgba(0,0,0,0.65),transparent_20%)]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-16 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-brand-primary"><Sparkles className="h-4 w-4" />{runtimeConfig.freeHookOffer}</span>
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.35em] text-brand-primary/70">{runtimeConfig.brandName}</p>
              <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] text-white md:text-7xl">نصمم واقعك، لا مجرد غرف.</h1>
              <p className="max-w-2xl text-lg leading-8 text-white/72 md:text-xl">{runtimeConfig.brandNameAr} تبني مسار تحويل واضح للمساحات السكنية الراقية: تقييم أولي سريع، توصية تنفيذ قابلة للتشغيل، وإغلاق منظم عبر واتساب.</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href={primaryHref} target={isExternalHref(primaryHref) ? "_blank" : undefined} rel={isExternalHref(primaryHref) ? "noopener noreferrer" : undefined} onClick={handlePrimaryClick} className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-primary px-7 py-4 text-base font-semibold text-brand-accent transition hover:translate-y-[-1px] hover:bg-[#d8b56d]">
                {intent === "buyer" && runtimeConfig.whatsappNumber ? <MessageCircle className="h-5 w-5" /> : <Compass className="h-5 w-5" />}
                {primaryCtaText}
              </Link>
              <Link href="/rooms" onClick={() => trackEvent("click_cta")} className="inline-flex items-center justify-center gap-3 rounded-full border border-white/15 px-7 py-4 text-base font-semibold text-white transition hover:border-brand-primary hover:text-brand-primary">
                استكشف المساحات
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-white/60">كل نقرة هنا تُبني ملف العميل داخل الجلسة، وتحوّل المسار إلى تجربة تصميم تجارية حقيقية.</p>
            <div className="grid gap-3 pt-4 text-sm text-white/75 md:grid-cols-2">
              {trustPoints.map((point) => (
                <div key={point} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 text-brand-primary" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#171719] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-x-6 top-6 h-px bg-gradient-to-r from-transparent via-brand-primary/80 to-transparent" />
              <div className="grid gap-6 lg:grid-rows-[auto_auto_1fr]">
                <AIStylePicker 
                  selectedStyle={selectedStyle}
                  onStyleChange={setSelectedStyle}
                  styleSwitchCount={styleSwitchCount}
                />
                <div className="grid grid-cols-2 gap-4 md:gap-6">
                  {roomDefinitions.map((room) => (
                    <Link 
                      key={room.slug} 
                      href={`/room/${room.slug}`} 
                      className="group relative rounded-[1.75rem] overflow-hidden transition-all hover:scale-105 hover:shadow-2xl"
                    >
                      <div 
                        className="absolute inset-0 bg-cover bg-center hover:scale-110 transition-transform duration-500"
                        style={{ 
                          backgroundImage: `url(${roomImages[room.slug] || `https://source.unsplash.com/600x400/?${room.title.replace(/\\s+/g, '-').toLowerCase()}`})`
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/80" />
                      <div className="relative z-10 p-4 md:p-6 h-full flex flex-col justify-end">
                        <p className="text-xs text-brand-primary/90 group-hover:text-brand-primary">{room.eyebrow}</p>
                        <h2 className="mt-1 text-lg font-semibold text-white">{room.title}</h2>
                        <p className="mt-1 text-sm leading-5 text-white/90 line-clamp-2">{room.summary}</p>
                      </div>
                    </Link>
                  ))}
                </div>
                {loading && <div className="col-span-2 text-center text-white/50 py-8">جاري تحميل الصور...</div>}
                <div className="rounded-[2rem] border border-brand-primary/15 bg-brand-primary/[0.08] p-6">
                  <p className="text-sm text-brand-primary">One dominant CTA</p>
                  <div className="mt-3 flex items-end justify-between gap-4">
                    <div>
                      <p className="text-2xl font-semibold text-white">{primaryCtaText}</p>
                      <p className="mt-2 text-sm leading-6 text-white/60">يتغير بناءً على سلوك الزائر الحالي وملفه داخل الجلسة.</p>
                    </div>
                    <ShieldCheck className="h-10 w-10 text-brand-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="border-t border-white/8 px-6 py-20 md:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Core journey</p>
            <h2 className="font-serif text-4xl text-white md:text-5xl">رحلة واضحة من أول زيارة حتى قرار التنفيذ.</h2>
            <p className="max-w-xl text-base leading-8 text-white/65">كل جزء في الصفحة له وظيفة واحدة: توضيح العرض، تثبيت الثقة، ثم دفع الزائر إلى خطوة عملية.</p>
          </div>
          <div className="grid gap-5">
            {executionTimeline.map((item) => (
              <div key={item.step} className="grid gap-3 border-b border-white/8 pb-5 md:grid-cols-[72px_1fr]">
                <p className="text-3xl font-semibold text-brand-primary">{item.step}</p>
                <div>
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/60">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="px-6 py-20 md:px-10 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Offer ladder</p>
              <h2 className="mt-3 font-serif text-4xl text-white md:text-5xl">ثلاث درجات واضحة بدل عرض مبهم.</h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-white/60">الباقات هنا ليست مجرد أسعار. كل باقة تمثل مستوى وضوح أعلى وسرعة أكبر في اتخاذ القرار.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {packageLadder.map((pkg, index) => (
              <div key={pkg.key} className={`rounded-[2rem] border p-7 ${index === 1 ? "border-brand-primary bg-brand-primary/[0.08]" : "border-white/10 bg-white/[0.03]"}`}>
                <p className="text-sm text-brand-primary">{pkg.title}</p>
                <p className="mt-4 text-4xl font-semibold text-white">{pkg.price}</p>
                <p className="mt-4 text-sm leading-7 text-white/62">{pkg.summary}</p>
                <div className="mt-6 space-y-3 text-sm text-white/72">
                  {pkg.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                      <span>{bullet}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <div className="fixed inset-x-4 bottom-4 z-40 md:hidden">
        <Link href={primaryHref} target={isExternalHref(primaryHref) ? "_blank" : undefined} rel={isExternalHref(primaryHref) ? "noopener noreferrer" : undefined} onClick={handlePrimaryClick} className="flex items-center justify-center gap-3 rounded-full border border-brand-primary/20 bg-[#111112]/90 px-5 py-4 text-base font-semibold text-white backdrop-blur">
          <MessageCircle className="h-5 w-5 text-brand-primary" />
          {primaryCtaText}
        </Link>
      </div>
    </main>
  );
}
