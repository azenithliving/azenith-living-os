"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

import { buildWhatsAppUrl } from '@/lib/conversion-engine';
import type { RuntimeConfig } from '@/lib/runtime-config';
import { TONE_MAP, roomDefinitions } from '@/lib/site-content';
import AIStylePicker from './AIStylePicker';
import useSessionStore from '@/stores/useSessionStore';

type RefactoredRoomGatewayProps = {
  runtimeConfig: RuntimeConfig;
};

const roomQueries: { [key: string]: string } = {
  'living-room': 'modern luxury living room',
  'master-bedroom': 'luxury master bedroom suite',
  'kitchen': 'modern luxury kitchen design',
  'bathroom': 'luxury bathroom spa design',
  'dining-room': 'elegant dining room',
  'home-office': 'luxury home office',
  'youth-room': 'modern youth bedroom',
  'dressing-room': 'walk-in closet',
  'interior-design': 'luxury interior design home'
};

export default function RefactoredRoomGateway({ runtimeConfig }: RefactoredRoomGatewayProps) {
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
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

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

  const primaryCtaText = styleSwitchCount > 3 ? "حائر بين الستايلات؟ اطلب استشارة دمج مجانية" : (intent === "buyer" && runtimeConfig.whatsappNumber ? "تحدث مع مهندس التصميم الآن" : "ابدأ رحلة التصميم");
  const profile = { roomType, budget, style: selectedStyle, serviceType, intent };
  const whatsappUrl = runtimeConfig.whatsappNumber ? buildWhatsAppUrl(runtimeConfig.whatsappNumber, profile, runtimeConfig.brandNameAr) : "/start";
  const primaryHref = intent === "buyer" && runtimeConfig.whatsappNumber ? whatsappUrl : "/start";

  const handlePrimaryClick = () => {
    trackEvent(intent === "buyer" && runtimeConfig.whatsappNumber ? "whatsapp_click" : "click_cta");
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMousePosition({ x, y });
  };

  return (
    <>
      {/* Main Experience Grid with Perspective Wrapper */}
      <section className="relative z-20">
        <div className="max-w-7xl mx-auto bg-transparent px-6 pt-20 pb-40 relative z-10">
          <div className="bg-transparent relative z-20">
            <div className="mb-16 bg-transparent">
              <AIStylePicker
                selectedStyle={selectedStyle}
                onStyleChange={handleStyleChange}
              />
            </div>

            {/* Perspective Wrapper for 3D Effects */}
            <div className="relative" style={{ perspective: '1000px' }}>
              
              {/* HERO GATEWAY CARD - Breakout Element */}
              <div className="relative mb-8 flex justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 60 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  onMouseMove={handleMouseMove}
                  className="relative w-[calc(100%+6rem)] h-[calc(100%+4rem)] md:w-[calc(100%+8rem)] md:h-[calc(100%+6rem)] rounded-[3rem] overflow-hidden z-50 cursor-pointer group"
                  style={{
                    transform: `perspective(1000px) rotateY(${mousePosition.x * 15}deg) rotateX(${-mousePosition.y * 10}deg)`,
                    willChange: 'transform',
                    boxShadow: '0 0 120px 40px rgba(197,160,89,0.4), 0 40px 80px -20px rgba(0,0,0,0.9)'
                  }}
                >
                  {/* Volcanic Obsidian Background with Liquid Gold */}
                  <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#0A0A0B] via-[#1A1A1B] to-[#0D0D0E]"></div>
                    <div className="absolute inset-0 opacity-40">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C5A059]/60 to-transparent animate-[liquidswirl_8s_ease-in-out_infinite]"></div>
                    </div>
                    <div className="absolute inset-0 opacity-20">
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#E5C170]/30 to-transparent animate-[pulse_4s_ease-in-out_infinite]"></div>
                    </div>
                  </div>

                  {/* Animated Metallic Border */}
                  <div className="absolute inset-0 rounded-[3rem] p-[2px]">
                    <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-r from-[#C5A059] via-[#E5C170] to-[#C5A059] animate-spin opacity-80" style={{ animationDuration: '20s' }}></div>
                  </div>
                  
                  {/* Glass-Metallic Surface */}
                  <div className="absolute inset-[2px] rounded-[calc(3rem-2px)] backdrop-blur-3xl bg-[#0D0D0E]/60 border border-[#C5A059]/20"></div>
                  
                  {/* Content */}
                  <div className="relative z-20 h-full flex flex-col items-center justify-center p-8 md:p-16 text-center">
                    <div className="flex items-center gap-2 mb-6">
                      <Sparkles className="h-5 w-5 text-[#C5A059] animate-pulse" />
                      <span className="text-[#C5A059] text-[11px] font-bold tracking-[0.5em] uppercase">
                        البوابة الحصرية
                      </span>
                    </div>
                    
                    <h2 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight">
                      نصمم <span className="bg-gradient-to-r from-[#C5A059] via-[#E5C170] to-[#C5A059] bg-clip-text text-transparent animate-[goldshimmer_3s_linear_infinite]">مساحتك</span> <br/>
                      <span className="text-white/90">لا غرفاً</span>
                    </h2>

                    <p className="text-white/50 text-base md:text-lg mb-12 max-w-2xl leading-relaxed">
                      {styleSwitchCount > 2 ? "وجدنا الستايل المناسب لك.. لنبدأ التنفيذ" : "صمم مساحتك الاستثنائية الآن بلمسة واحدة"}
                    </p>

                    {/* The Command Button - High-Gloss Metallic */}
                    <Link 
                      href={primaryHref} 
                      onClick={handlePrimaryClick}
                      className="relative overflow-hidden w-full md:w-auto px-16 py-6 bg-gradient-to-br from-[#C5A059] via-[#E5C170] to-[#997A45] text-[#0D0D0E] rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 shadow-[0_20px_40px_-15px_rgba(197,160,89,0.7)] group-hover:shadow-[0_25px_50px_-20px_rgba(197,160,89,0.8)]"
                    >
                      <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                      <div className="absolute inset-0 rounded-2xl border border-[#C5A059]/30"></div>
                      <span className="relative z-10">{primaryCtaText}</span>
                    </Link>

                    <div className="mt-8 space-y-2">
                      <p className="text-[11px] text-white/40 font-medium">عقد تنفيذ مضمون • تصميم خلال 24 ساعة</p>
                      <p className="text-[10px] text-[#C5A059]/60 font-bold tracking-wider uppercase">*خدمة حصرية بضمان الجودة</p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Room Grid - Supporting Cards (z-index: 1) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-transparent relative z-10">
                {roomList.slice(0, 6).map((room) => (
                  <div key={room.slug} className="group bg-transparent relative z-10">
                    <Link
                      href={`/room/${room.slug}`}
                      onMouseEnter={() => startRoomTimer(room.slug)}
                      onMouseLeave={() => clearRoomTimer(room.slug)}
                      className="block aspect-[16/10] rounded-[2rem] overflow-hidden relative border border-white/5 shadow-lg transition-all duration-500 group-hover:-translate-y-1 group-hover:border-brand-primary/20"
                    >
                      <div
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
                        style={{ backgroundImage: `url(${roomImages[room.slug] || '/placeholder-room.jpg'})` }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-right z-20">
                        <span className="text-brand-primary text-xs uppercase tracking-widest font-bold mb-2 block">{room.eyebrow}</span>
                        <h3 className="text-xl font-serif text-white font-bold mb-2">{room.title}</h3>
                        <p className="text-white/70 text-sm line-clamp-2 leading-relaxed">{room.summary}</p>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>

              {loading && (
                <div className="text-center py-20 bg-transparent relative z-10">
                  <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white/40">تنسيق المساحات البصرية...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CSS Animations */}
      <style jsx>{`
        @keyframes liquidswirl {
          0%, 100% { transform: translateX(-100%) translateY(-100%) rotate(0deg); }
          50% { transform: translateX(100%) translateY(100%) rotate(180deg); }
        }
        @keyframes goldshimmer {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
      `}</style>
    </>
  );
}
