"use client";

import Footer from './Footer';
import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { CheckCircle2, MessageCircle, Sparkles } from 'lucide-react';

import { buildWhatsAppUrl } from '@/lib/conversion-engine';
import type { RuntimeConfig } from '@/lib/runtime-config';
import { executionTimeline, TONE_MAP, packageLadder, roomDefinitions, trustPoints } from '@/lib/site-content';
import AIStylePicker from './AIStylePicker';
import useSessionStore from '@/stores/useSessionStore';

type HomePageClientProps = {
  runtimeConfig: RuntimeConfig;
};

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
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const processInteraction = useSessionStore((state) => state.processInteraction);
  const leadScore = useSessionStore((state) => state.leadScore);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  const roomType = useSessionStore((state) => state.roomType);
  const budget = useSessionStore((state) => state.budget);
  const serviceType = useSessionStore((state) => state.serviceType);

  const [roomImages, setRoomImages] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [styleSwitchCount, setStyleSwitchCount] = useState(0);
  const styleSwitchRef = useRef(0);
  const [viewedRooms, setViewedRooms] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleStyleChange = (newStyle: string) => {
    if (selectedStyle !== newStyle) {
      processInteraction('style_switch', 2);
      const newCount = styleSwitchRef.current + 1;
      styleSwitchRef.current = newCount;
      setStyleSwitchCount(newCount);
    }
    processInteraction('style_select', 1);
    setSelectedStyle(newStyle);
    trackEvent('ui_auto_optimization_triggered');
  };

  const startRoomTimer = (roomSlug: string) => {
    if (timersRef.current.has(roomSlug)) return;
    const timer = setTimeout(() => {
      trackEvent('room_intent_hover_long');
      setViewedRooms(prev => prev + 1);
      timersRef.current.delete(roomSlug);
    }, 3000);
    timersRef.current.set(roomSlug, timer);
  };

  const clearRoomTimer = (roomSlug: string) => {
    if (timersRef.current.has(roomSlug)) {
      clearTimeout(timersRef.current.get(roomSlug));
      timersRef.current.delete(roomSlug);
    }
  };

  const roomList = useMemo(() => {
    const ranked = [...roomDefinitions];
    if (selectedStyle === 'modern') {
      const livingIndex = ranked.findIndex(r => r.slug === 'living-room');
      if (livingIndex > 0) {
        const living = ranked.splice(livingIndex, 1)[0];
        ranked.unshift(living);
      }
    } else if (selectedStyle === 'industrial') {
      const officeIndex = ranked.findIndex(r => r.slug === 'home-office');
      if (officeIndex > 0) {
        const office = ranked.splice(officeIndex, 1)[0];
        ranked.unshift(office);
      }
    }
    if (ranked[0] && TONE_MAP[selectedStyle]) {
      ranked[0].title = TONE_MAP[selectedStyle].headline;
      ranked[0].summary = TONE_MAP[selectedStyle].desc;
    }
    return ranked;
  }, [selectedStyle]);

  useEffect(() => {
    if (viewedRooms > 5 && !toastVisible) {
      const timeout = setTimeout(() => setToastVisible(true), 500);
      return () => clearTimeout(timeout);
    }
  }, [viewedRooms, toastVisible]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(timer => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    const fetchRoomImages = async () => {
      setLoading(true);
      const imagePromises = roomList.map(async (room) => {
        try {
          const query = `${selectedStyle} ${roomQueries[room.slug] || room.title}`;
          const res = await fetch(`/api/pexels?query=${encodeURIComponent(query)}`);
          const data = await res.json();
          const img = data.photos?.[0]?.src?.large || `https://source.unsplash.com/600x400/?${room.slug}`;
          return { [room.slug]: img };
        } catch {
          return { [room.slug]: `https://source.unsplash.com/600x400/?${room.slug}` };
        }
      });
      const images = await Promise.all(imagePromises);
      setRoomImages(Object.assign({}, ...images));
      setLoading(false);
    };
    fetchRoomImages();
  }, [roomList, selectedStyle]);

  useEffect(() => {
    updateProfile({ lastPage: "/" });
    trackEvent("page_view");
  }, [trackEvent, updateProfile]);

  const isGoldenCTA = leadScore > 15;
  const exploreCTA = isGoldenCTA ? "احصل على عرض سعري مخصص لذوقك" : "استكشف المساحات";
  const primaryCtaText = styleSwitchCount > 3 ? "حائر بين الستايلات؟ اطلب استشارة دمج مجانية" : (intent === "buyer" && runtimeConfig.whatsappNumber ? "تحدث مع مهندس التصميم الآن" : "ابدأ رحلة التصميم");
  const profile = { roomType, budget, style: selectedStyle, serviceType, intent };
  const whatsappUrl = runtimeConfig.whatsappNumber ? buildWhatsAppUrl(runtimeConfig.whatsappNumber, profile, runtimeConfig.brandNameAr) : "/start";
  const primaryHref = intent === "buyer" && runtimeConfig.whatsappNumber ? whatsappUrl : "/start";

  const handlePrimaryClick = () => {
    trackEvent(intent === "buyer" && runtimeConfig.whatsappNumber ? "whatsapp_click" : "click_cta");
  };

  return (
    <>
      {/* Main Experience Grid */}
      <section className="relative z-20">
        <div className="max-w-7xl mx-auto bg-transparent px-6 pt-20 pb-40 relative z-10">
          <div className="bg-transparent relative z-20">
            <div className="mb-16 bg-transparent">
              <AIStylePicker
                selectedStyle={selectedStyle}
                onStyleChange={handleStyleChange}
              />
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 bg-transparent relative z-20">
            {/* Index 0-5: Regular Room Cards */}
            {roomList.slice(0, 6).map((room, index) => (
              <div key={room.slug} className="group bg-transparent relative z-20">
                <Link
                  href={`/room/${room.slug}`}
                  onMouseEnter={() => startRoomTimer(room.slug)}
                  onMouseLeave={() => clearRoomTimer(room.slug)}
                  className="block aspect-[16/10] rounded-[2.5rem] overflow-hidden relative border border-white/5 shadow-2xl transition-all duration-500 group-hover:-translate-y-3 group-hover:border-brand-primary/30"
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
                    style={{ backgroundImage: `url(${roomImages[room.slug] || '/placeholder-room.jpg'})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-8 text-right z-20">
                    <span className="text-brand-primary text-xs uppercase tracking-widest font-bold mb-2 block">{room.eyebrow}</span>
                    <h3 className="text-2xl font-serif text-white font-bold mb-2">{room.title}</h3>
                    <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">{room.summary}</p>
                  </div>
                </Link>
              </div>
            ))}
            
            {/* Index 6: Full Interior Design Card */}
            <div className="group bg-transparent relative z-20">
              <Link
                href={`/room/interior-design`}
                onMouseEnter={() => startRoomTimer('interior-design')}
                onMouseLeave={() => clearRoomTimer('interior-design')}
                className="block aspect-[16/10] rounded-[2.5rem] overflow-hidden relative border border-white/5 shadow-2xl transition-all duration-500 group-hover:-translate-y-3 group-hover:border-brand-primary/30"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110"
                  style={{ backgroundImage: `url(${roomImages['interior-design'] || '/placeholder-room.jpg'})` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10"></div>
                <div className="absolute bottom-0 left-0 right-0 p-8 text-right z-20">
                  <span className="text-brand-primary text-xs uppercase tracking-widest font-bold mb-2 block">تصميم شامل</span>
                  <h3 className="text-2xl font-serif text-white font-bold mb-2">تصميم داخلي شامل</h3>
                  <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">حلول متكاملة لتصميم مساحتك بالكامل</p>
                </div>
              </Link>
            </div>

            {/* Index 7: Explore Spaces Luxury Card - Standard Size with Dynamic Logic */}
            <div className="group bg-transparent relative z-20">
              <div className="block aspect-[16/10] rounded-[2.5rem] overflow-hidden relative border border-white/5 shadow-2xl transition-all duration-500 group-hover:-translate-y-3 group-hover:border-brand-primary/30 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1A1A1B] via-[#0D0D0E] to-black border-2 border-[#C5A059] shadow-[0_0_50px_rgba(197,160,89,0.3)]">
                {/* Content Container */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                  {/* Top Badge with Pulse */}
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-3 w-3 text-[#C5A059] animate-pulse" />
                    <span className="text-[#C5A059] text-[8px] font-bold tracking-[0.3em] uppercase animate-pulse">
                      الخطوة الحصرية
                    </span>
                  </div>

                  {/* Main Title - Bold with Gold Gradient */}
                  <h2 className="text-xl md:text-2xl font-black text-white mb-4 leading-tight">
                    استكشف <span className="bg-gradient-to-r from-[#C5A059] to-[#E5C170] bg-clip-text text-transparent">المساحات</span>
                  </h2>

                  {/* Subtext */}
                  <p className="text-white/50 text-xs md:text-sm mb-6 max-w-[200px] leading-relaxed">
                    {styleSwitchCount > 2 ? "وجدنا الستايل المناسب لك.. لنبدأ التنفيذ" : "اكتشف إبداعاتنا في التصميم الداخلي المبتكر"}
                  </p>

                  {/* The Action Button - Dynamic Text */}
                  <Link 
                    href={styleSwitchCount > 2 ? primaryHref : "/rooms"}
                    onClick={styleSwitchCount > 2 ? handlePrimaryClick : undefined}
                    className="bg-gradient-to-r from-[#C5A059] to-[#E5C170] text-black font-black text-sm py-3 px-4 rounded-xl hover:shadow-[0_0_20px_rgba(197,160,89,0.5)] transition-all active:scale-95 shadow-[0_15px_30px_-10px_rgba(197,160,89,0.6)] text-center w-full"
                  >
                    {styleSwitchCount > 2 ? "حائر بين الستايلات؟ اطلب استشارة دمج مجانية" : "استكشف المساحات"}
                  </Link>

                  {/* Bottom Micro-copy */}
                  <span className="mt-4 text-[8px] text-white/40 font-medium">تصاميم فريدة • جودة استثنائية</span>
                </div>
              </div>
            </div>

            {/* Index 8: Start Design Journey Card - Static State */}
            <div className="relative z-50 md:col-span-2 lg:col-span-1 transform transition-all duration-500 hover:scale-105 aspect-[16/10] rounded-[2.5rem] overflow-hidden shadow-[0_0_50px_rgba(197,160,89,0.3)] border-2 border-[#C5A059] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1A1A1B] via-[#0D0D0E] to-black flex flex-col items-center justify-center p-8 text-center">
              {/* Top Badge with Pulse */}
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-4 w-4 text-[#C5A059] animate-pulse" />
                <span className="text-[#C5A059] text-[10px] font-bold tracking-[0.3em] uppercase animate-pulse">
                  الخطوة الحصرية
                </span>
              </div>

              {/* Main Title */}
              <h4 className="text-white text-xl font-bold mb-4">جاهز لتصميم مساحتك؟</h4>
              <p className="text-white/80 text-sm mb-6 leading-tight">اضغط للبدء في رحلة تصميم مخصصة لذوقك</p>

              {/* The Action Button - Static "ابدأ رحلة التصميم" */}
              <Link 
                href="/start"
                className="bg-gradient-to-r from-[#C5A059] to-[#E5C170] text-black font-black text-lg py-4 w-full rounded-xl hover:shadow-[0_0_20px_rgba(197,160,89,0.5)] transition-all active:scale-95 shadow-[0_15px_30px_-10px_rgba(197,160,89,0.6)] text-center"
              >
                ابدأ رحلة التصميم
              </Link>

              {/* Bottom Micro-copy */}
              <span className="mt-6 text-[10px] text-white/40 font-medium">عقد تنفيذ مضمون</span>
            </div>
          </div>

          {loading && (
            <div className="text-center py-20 bg-transparent relative z-20">
            <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white/40">تنسيق المساحات البصرية...</p>
            </div>
          )}
          </div>
        </div>
      </section>

      {/* Corporate Identity Section - Legacy & Trust */}
      <section className="relative z-20 overflow-hidden px-6 pt-24 pb-32 md:px-12 bg-gradient-to-b from-black via-[#0A0A0A] to-black">
        <div className="absolute inset-0 bg-[url('/dining-bg.jpg')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/60"></div>
        
        <div className="relative z-30 max-w-7xl mx-auto">
          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-16 items-start mb-20">
            {/* Left: Text Content */}
            <div className="space-y-8">
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white leading-tight tracking-tight">
                أزينث ليفينج: كيان تأسس على خبرة نصف قرن.
              </h2>
              <p className="text-white/80 text-lg md:text-xl leading-relaxed max-w-2xl">
                تأسست أزينث ليفينج عام 2012 برؤيةٍ تدمج بين دقة التخطيط المؤسسي وإرثٍ عائلي في صناعة الأثاث يمتد لأكثر من 50 عاماً. نحن لا ننظر إلى الأثاث كقطعة خشب، بل كمعادلة هندسية تبدأ من اختيار المواد الخام وفق معايير عالمية، وتمر عبر نظامنا التشغيلي (Azenith OS) لضمان تنفيذٍ يطابق التصورات بدقةٍ متناهية، وتنتهي بضمانٍ يمتد لثلاث سنوات. نحن الكيان الذي يحول المخططات إلى واقعٍ مستدام في مساحتك الخاصة.
              </p>
            </div>
            
            {/* Right: Legacy Stats Pillars */}
            <div className="grid grid-cols-1 gap-6">
              {/* Pillar 1: 50 Years */}
              <div className="p-8 rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent backdrop-blur-sm">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl md:text-6xl font-black text-[#C5A059]">50</span>
                  <span className="text-2xl font-bold text-[#C5A059]">عاماً</span>
                </div>
                <p className="text-white/70 text-lg mt-3">من الشغف في ورش الأثاث الفاخر.</p>
              </div>
              
              {/* Pillar 2: 2012 */}
              <div className="p-8 rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent backdrop-blur-sm">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl md:text-6xl font-black text-[#C5A059]">2012</span>
                </div>
                <p className="text-white/70 text-lg mt-3">عام التأسيس (الاستقرار المؤسسي).</p>
              </div>
              
              {/* Pillar 3: 3 Years Warranty */}
              <div className="p-8 rounded-3xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/10 to-transparent backdrop-blur-sm">
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl md:text-6xl font-black text-[#C5A059]">3</span>
                  <span className="text-2xl font-bold text-[#C5A059]">سنوات</span>
                </div>
                <p className="text-white/70 text-lg mt-3">الضمان الذهبي (الالتزام بعد البيع).</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile Floating CTA */}
      <div className="fixed bottom-6 inset-x-6 z-50 md:hidden">
        <Link 
          href={primaryHref}
          className="flex items-center justify-center gap-3 bg-brand-primary py-5 rounded-2xl text-brand-accent font-bold shadow-2xl relative z-50"
        >
          <MessageCircle className="h-6 w-6" />
          {primaryCtaText}
        </Link>
      </div>

      <Footer />
    </>
  );
}
