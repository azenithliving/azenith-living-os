"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";

import Footer from "./Footer";
import AIStylePicker from "./AIStylePicker";
import AboutAzenith from "./AboutAzenith";

import { 
  BASE_ROOMS, 
  ROOM_STYLE_DESCRIPTIONS, 
  STYLE_LABELS, 
  ROOM_QUERIES, 
  STYLE_QUERY_HINTS, 
  STYLE_RESULT_PAGE 
} from "@/lib/constants/rooms";

import { buildWhatsAppUrl } from "@/lib/conversion-engine";
import type { RuntimeConfig } from "@/lib/runtime-config";
import useSessionStore from "@/stores/useSessionStore";

type HomePageClientProps = {
  runtimeConfig: RuntimeConfig;
  initialRoomImages?: Record<string, string>;
};

// In-memory cache to prevent refetching images for the same style during a session
const imageCache: Record<string, Record<string, string>> = {};

export default function HomePageClient({ runtimeConfig, initialRoomImages = {} }: HomePageClientProps) {
  console.log("[CLIENT] HomePageClient mounted, isHydrated:", useSessionStore.getState().isHydrated, "initialImages:", Object.keys(initialRoomImages).length);
  
  const router = useRouter();
  const intent = useSessionStore((state) => state.intent);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  const roomType = useSessionStore((state) => state.roomType);
  const budget = useSessionStore((state) => state.budget);
  const serviceType = useSessionStore((state) => state.serviceType);

  // PERSISTED UI STATE - Read from store instead of local state
  const selectedStyle = useSessionStore((state) => state.selectedStyle);
  const setSelectedStyle = useSessionStore((state) => state.setSelectedStyle);
  const styleSwitches = useSessionStore((state) => state.styleSwitches);
  const isHydrated = useSessionStore((state) => state.isHydrated);

  // Use server-fetched images as initial state to eliminate loading flash
  const [roomImages, setRoomImages] = useState<Record<string, string>>(initialRoomImages);
  const [loading, setLoading] = useState(Object.keys(initialRoomImages).length === 0);
  console.log("[CLIENT] Initial loading state:", Object.keys(initialRoomImages).length === 0);
  // Local state for immediate UI feedback - synced to store
  const [styleSwitchCount, setStyleSwitchCount] = useState(styleSwitches);
  const styleSwitchRef = useRef(styleSwitches);
  const timersRef = useRef<Map<string, number>>(new Map());

  // Hydration guard - show loading state or default during hydration
  const displayStyle = isHydrated ? selectedStyle : "modern";
  console.log("[CLIENT] displayStyle:", displayStyle, "isHydrated:", isHydrated);

  // Sync local ref with store when hydrated
  useEffect(() => {
    if (isHydrated) {
      styleSwitchRef.current = styleSwitches;
      setStyleSwitchCount(styleSwitches);
    }
  }, [isHydrated, styleSwitches]);

  const handleStyleChange = (newStyle: string) => {
    if (selectedStyle !== newStyle) {
      // Update store (handles persistence and interaction tracking)
      setSelectedStyle(newStyle);
      // Update local ref for immediate UI feedback
      const nextCount = styleSwitchRef.current + 1;
      styleSwitchRef.current = nextCount;
      setStyleSwitchCount(nextCount);
    }
    trackEvent("ui_auto_optimization_triggered");
  };

  const startRoomTimer = (roomSlug: string) => {
    if (timersRef.current.has(roomSlug)) return;

    const timer = window.setTimeout(() => {
      trackEvent("room_intent_hover_long");
      timersRef.current.delete(roomSlug);
    }, 3000);

    timersRef.current.set(roomSlug, timer);
  };

  const clearRoomTimer = (roomSlug: string) => {
    const timer = timersRef.current.get(roomSlug);
    if (!timer) return;
    window.clearTimeout(timer);
    timersRef.current.delete(roomSlug);
  };

  // Room card click handler - clear images and show loading before navigation
  const handleRoomClick = (roomSlug: string) => {
    // 1. Clear images array to prevent showing stale data
    setRoomImages({});
    // 2. Set loading state to show spinner
    setLoading(true);
    // 3. Navigate to room page
    router.push(`/rooms/${roomSlug}?style=${displayStyle}`);
  };

  const roomList = useMemo(() => {
    const ranked = BASE_ROOMS.map((room) => {
      const styleDesc = ROOM_STYLE_DESCRIPTIONS[room.slug]?.[displayStyle];
      if (styleDesc) {
        return {
          ...room,
          eyebrow: styleDesc.eyebrow,
          title: styleDesc.title,
          summary: styleDesc.summary,
        };
      }
      return { ...room };
    });

    if (displayStyle === "modern") {
      const livingIndex = ranked.findIndex((room) => room.slug === "living-room");
      if (livingIndex > 0) {
        const [livingRoom] = ranked.splice(livingIndex, 1);
        ranked.unshift(livingRoom);
      }
    } else if (displayStyle === "industrial") {
      const officeIndex = ranked.findIndex((room) => room.slug === "home-office");
      if (officeIndex > 0) {
        const [officeRoom] = ranked.splice(officeIndex, 1);
        ranked.unshift(officeRoom);
      }
    }

    return ranked;
  }, [displayStyle]);

  useEffect(() => {
    const timers = timersRef.current;

    return () => {
      for (const [, timer] of timers) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  useEffect(() => {
    // If we already have cached images for this style, use them instantly
    if (imageCache[displayStyle] && Object.keys(imageCache[displayStyle]).length > 0) {
      setRoomImages(imageCache[displayStyle]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchRoomImages = async () => {
      setRoomImages({});
      setLoading(true);

      try {
        // Step 1: Try to fetch CMS images from database first
        const cmsImages: Record<string, string> = {};
        try {
          const cmsRes = await fetch('/api/room-sections', {
            signal: controller.signal,
          });
          if (cmsRes.ok) {
            const cmsData = await cmsRes.json();
            if (cmsData.sections) {
              cmsData.sections.forEach((section: { slug: string; cmsImageUrl: string | null }) => {
                if (section.cmsImageUrl) {
                  cmsImages[section.slug] = section.cmsImageUrl;
                }
              });
            }
          }
        } catch (cmsError) {
          console.warn('[CMS] Failed to fetch CMS images, falling back to Pexels:', cmsError);
        }

        // Step 2: For rooms without CMS images, fetch from Pexels API
        const imagePromises = roomList.map(async (room, index) => {
          // If CMS image exists, use it
          if (cmsImages[room.slug]) {
            return { [room.slug]: cmsImages[room.slug] };
          }

          // Otherwise, fall back to Pexels API
          try {
            const query = `${STYLE_QUERY_HINTS[displayStyle] || displayStyle} luxury interior design ${ROOM_QUERIES[room.slug] || room.title}`;
            const randomPage = Math.floor(Math.random() * 5) + 1;
            const page = STYLE_RESULT_PAGE[displayStyle] + index + randomPage;
            const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}&per_page=1&page=${page}`, {
              signal: controller.signal,
            });

            if (!res.ok) {
              throw new Error(`API returned ${res.status}`);
            }

            const data = await res.json();
            const img = data.photos?.[0]?.src?.large || "/placeholder-room.jpg";
            return { [room.slug]: img };
          } catch {
            return { [room.slug]: "/placeholder-room.jpg" };
          }
        });

        const images = await Promise.all(imagePromises);
        if (!controller.signal.aborted) {
          const finalImages = Object.assign({}, ...images);
          setRoomImages(finalImages);
          imageCache[displayStyle] = finalImages; // Save to cache
        }
      } finally {
        // ALWAYS clear loading state, even if aborted
        setLoading(false);
      }
    };

    void fetchRoomImages();
    return () => controller.abort();
  }, [roomList, displayStyle]);

  useEffect(() => {
    updateProfile({ lastPage: "/" });
    trackEvent("page_view");
  }, [trackEvent, updateProfile]);

  const primaryCtaText =
    styleSwitchCount > 3
      ? "حائر بين الستايلات؟ اطلب استشارة دمج مجانية"
      : intent === "buyer" && runtimeConfig.whatsappNumber
        ? "تحدث مع مهندس التصميم الآن"
        : "ابدأ رحلة التصميم";
  const profile = { roomType, budget, style: displayStyle, serviceType, intent };
  const whatsappUrl = runtimeConfig.whatsappNumber
    ? buildWhatsAppUrl(runtimeConfig.whatsappNumber, profile, runtimeConfig.brandNameAr)
    : "/start";
  const primaryHref = intent === "buyer" && runtimeConfig.whatsappNumber ? whatsappUrl : "/start";

  const handlePrimaryClick = () => {
    trackEvent(intent === "buyer" && runtimeConfig.whatsappNumber ? "whatsapp_click" : "click_cta");
  };
  const styleAltLabel = STYLE_LABELS[displayStyle] ?? displayStyle;

  return (
    <>
      <section className="relative z-20">
        <div className="relative z-10 mx-auto max-w-7xl bg-transparent px-6 pb-40 pt-20">
          <div className="relative z-20 bg-transparent">
            <div className="mb-16 bg-transparent">
              <AIStylePicker selectedStyle={displayStyle} onStyleChange={handleStyleChange} />
            </div>

            <div className="relative z-20 grid grid-cols-1 gap-10 bg-transparent md:grid-cols-2 lg:grid-cols-3">
              {roomList.map((room, index) => (
                <div key={room.slug} className="group relative z-20">
                  <Link
                    href={`/rooms/${room.slug}?style=${displayStyle}`}
                    onMouseEnter={() => startRoomTimer(room.slug)}
                    onMouseLeave={() => clearRoomTimer(room.slug)}
                    onClick={() => handleRoomClick(room.slug)}
                    className="relative block aspect-[16/10] cursor-pointer overflow-hidden rounded-[2.5rem] border border-white/5 shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] hover:border-brand-primary/30 hover:shadow-[0_20px_40px_rgba(197,160,89,0.3)]"
                  >
                    <Image
                      key={`${displayStyle}-${room.slug}-${roomImages[room.slug] || "placeholder"}`}
                      src={roomImages[room.slug] || "/placeholder-room.jpg"}
                      alt={`${room.title} بتصميم ${styleAltLabel}`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="absolute inset-0 object-cover transition-transform duration-1000 group-hover:scale-110"
                      priority={index < 6}
                      loading={index < 6 ? "eager" : "lazy"}
                    />
                    <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 z-20 p-8 text-right">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-primary">{room.eyebrow}</span>
                      <h3 className="mb-2 text-2xl font-serif font-bold text-white">{room.title}</h3>
                      <p className="line-clamp-2 text-sm leading-relaxed text-white/70">{room.summary}</p>
                    </div>
                  </Link>
                </div>
              ))}

              <div className="group relative z-20">
                <Link
                  href={`/rooms/interior-design?style=${displayStyle}`}
                  onMouseEnter={() => startRoomTimer("interior-design")}
                  onMouseLeave={() => clearRoomTimer("interior-design")}
                  onClick={() => handleRoomClick("interior-design")}
                  className="relative block aspect-[16/10] cursor-pointer overflow-hidden rounded-[2.5rem] border border-white/5 shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] hover:border-brand-primary/30 hover:shadow-[0_20px_40px_rgba(197,160,89,0.3)]"
                >
                  <Image
                    key={`${displayStyle}-interior-design-${roomImages["interior-design"] || "placeholder"}`}
                    src={roomImages["interior-design"] || "/placeholder-room.jpg"}
                    alt={`تصميم داخلي شامل بأسلوب ${styleAltLabel}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="absolute inset-0 object-cover transition-transform duration-1000 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 z-20 p-8 text-right">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-primary">تصميم شامل</span>
                    <h3 className="mb-2 text-2xl font-serif font-bold text-white">تصميم داخلي شامل</h3>
                    <p className="line-clamp-2 text-sm leading-relaxed text-white/70">حلول متكاملة لتصميم مساحتك بالكامل.</p>
                  </div>
                </Link>
              </div>

              <div className="group relative z-20 bg-transparent">
                <div className="relative block aspect-[16/10] overflow-hidden rounded-[2.5rem] border-2 border-[#C5A059] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1A1A1B] via-[#0D0D0E] to-black shadow-[0_0_50px_rgba(197,160,89,0.3)] transition-all duration-500 group-hover:-translate-y-3 group-hover:border-brand-primary/30">
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 animate-pulse text-[#C5A059]" />
                      <span className="text-[8px] font-bold uppercase tracking-[0.3em] text-[#C5A059] animate-pulse">الخطوة الحصرية</span>
                    </div>
                    <h2 className="mb-4 text-xl font-black leading-tight text-white md:text-2xl">
                      استكشف <span className="bg-gradient-to-r from-[#C5A059] to-[#E5C170] bg-clip-text text-transparent">المساحات</span>
                    </h2>
                    <p className="mb-6 max-w-[200px] text-xs leading-relaxed text-white/50 md:text-sm">
                      {styleSwitchCount > 2 ? "وجدنا الستايل المناسب لك.. لنبدأ التنفيذ" : "اكتشف إبداعاتنا في التصميم الداخلي المبتكر."}
                    </p>
                    <Link
                      href={styleSwitchCount > 2 ? primaryHref : "/rooms"}
                      onClick={styleSwitchCount > 2 ? handlePrimaryClick : undefined}
                      className="w-full rounded-xl bg-gradient-to-r from-[#C5A059] to-[#E5C170] px-4 py-3 text-center text-sm font-black text-black shadow-[0_15px_30px_-10px_rgba(197,160,89,0.6)] transition-all hover:shadow-[0_0_20px_rgba(197,160,89,0.5)] active:scale-95"
                    >
                      {styleSwitchCount > 2 ? "اطلب استشارة دمج مجانية" : "استكشف المساحات"}
                    </Link>
                    <span className="mt-4 text-[8px] font-medium text-white/40">تصاميم فريدة • جودة استثنائية</span>
                  </div>
                </div>
              </div>

              <div className="relative z-50 flex aspect-[16/10] transform flex-col items-center justify-center overflow-hidden rounded-[2.5rem] border-2 border-[#C5A059] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1A1A1B] via-[#0D0D0E] to-black p-8 text-center shadow-[0_0_50px_rgba(197,160,89,0.3)] transition-all duration-500 hover:scale-105 md:col-span-2 lg:col-span-1">
                <div className="mb-6 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse text-[#C5A059]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C5A059] animate-pulse">الخطوة الحصرية</span>
                </div>
                <h4 className="mb-4 text-xl font-bold text-white">جاهز لتصميم مساحتك؟</h4>
                <p className="mb-6 text-sm leading-tight text-white/80">ابدأ الآن مسار تصميم مخصص يناسب ذوقك واحتياجك الحقيقي.</p>
                <Link
                  href="/start"
                  className="w-full rounded-xl bg-gradient-to-r from-[#C5A059] to-[#E5C170] py-4 text-center text-lg font-black text-black shadow-[0_15px_30px_-10px_rgba(197,160,89,0.6)] transition-all hover:shadow-[0_0_20px_rgba(197,160,89,0.5)] active:scale-95"
                >
                  ابدأ رحلة التصميم
                </Link>
                <span className="mt-6 text-[10px] font-medium text-white/40">عقد تنفيذ مضمون</span>
              </div>
            </div>

            {loading ? (
              <div className="relative z-20 bg-transparent py-20 text-center">
                <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
                <p className="text-white/40">تنسيق المساحات البصرية...</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <AboutAzenith />

      <div className="fixed inset-x-6 bottom-6 z-50 md:hidden">
        <Link
          href={primaryHref}
          onClick={handlePrimaryClick}
          className="relative z-50 flex items-center justify-center gap-3 rounded-2xl bg-brand-primary py-5 font-bold text-brand-accent shadow-2xl"
        >
          <MessageCircle className="h-6 w-6" />
          {primaryCtaText}
        </Link>
      </div>

      <Footer
        contactEmail={runtimeConfig.contactEmail}
        contactPhone={runtimeConfig.contactPhone}
        businessAddress={runtimeConfig.businessAddress}
      />
    </>
  );
}
