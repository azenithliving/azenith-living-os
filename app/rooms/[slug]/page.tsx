/* eslint-disable @next/next/no-img-element */
"use client";

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { roomDefinitions } from "@/lib/site-content";
import Link from "next/link";
import { getClientRuntimeConfig } from "@/lib/client-runtime-config";
import useSessionStore from "@/stores/useSessionStore";

export default function FurnitureDetailPage() {
  const params = useParams();
  const roomSlug = params.slug as string;
  const furnitureSlug = params.furniture as string;
  const runtimeConfig = getClientRuntimeConfig();

  const room = roomDefinitions.find(r => r.slug === roomSlug);
  const furniture = room?.furniture.find(f => f.slug === furnitureSlug);

  const updateProfile = useSessionStore((state) => state.updateProfile);

  useEffect(() => {
    updateProfile({ lastPage: `/rooms/${roomSlug}/furniture/${furnitureSlug}` });
  }, [roomSlug, furnitureSlug, updateProfile]);

  if (!room || !furniture) {
    return <div>غير متوفر</div>;
  }

  const message = `مرحبا، أنا مهتم بـ ${furniture.title} من ${room.title}\nالسعر: ${furniture.priceRange}\n${furniture.description}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-brand-secondary px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Back Navigation */}
        <Link 
          href={`/room/${roomSlug}`} 
          className="inline-flex items-center gap-2 text-brand-primary/80 hover:text-brand-primary font-medium mb-8"
        >
          ← رجوع للغرفة
        </Link>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Visual Gallery */}
          <section className="space-y-6">
            <div className="relative h-96 rounded-[2rem] overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800 shadow-2xl">
              <img 
                src={furniture.images[0]} 
                alt={furniture.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {furniture.images.length > 1 && (
              <div className="grid grid-cols-3 gap-3">
                {furniture.images.slice(1).map((img, index) => (
                  <div key={index} className="h-24 rounded-xl overflow-hidden bg-gray-900/50 cursor-pointer hover:ring-2 ring-brand-primary/50 transition-all">
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Details & CTA */}
          <section className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <div>
              <h1 className="font-serif text-4xl text-white font-semibold mb-2">{furniture.title}</h1>
              <p className="text-3xl font-bold text-brand-primary mb-6">{furniture.priceRange}</p>
              <p className="text-lg text-white/80 leading-8 mb-6">{furniture.description}</p>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">المميزات الرئيسية</h3>
              <div className="grid grid-cols-2 gap-2">
                {furniture.features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                    <span className="w-2 h-2 bg-brand-primary rounded-full flex-shrink-0" />
                    <span className="text-white/90">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Variations */}
            <div>
              <h3 className="text-xl font-semibold text-white mb-4">المتوفر بـ</h3>
              <div className="flex flex-wrap gap-2">
                {furniture.variations.map((variation, index) => (
                  <span key={index} className="px-4 py-2 bg-white/10 text-white text-sm rounded-full font-medium border border-white/20 hover:bg-white/20 transition-colors cursor-pointer">
                    {variation}
                  </span>
                ))}
              </div>
            </div>

            {/* Primary CTA */}
            <Link 
              href={`https://wa.me/${runtimeConfig.whatsappNumber}?text=${encodeURIComponent(message)}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full block rounded-[2rem] bg-gradient-to-r from-brand-primary to-[#d8b56d] text-brand-accent p-6 text-center text-xl font-bold shadow-2xl hover:shadow-3xl hover:scale-[1.02] transition-all group"
            >
              <span>اطلب هذا القطعة الآن</span>
              <span className="block text-sm opacity-90 group-hover:opacity-100">📱 تواصل مباشرة مع المختص</span>
            </Link>

            {/* Secondary CTA */}
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t border-white/10">
              <Link 
                href={`/room/${room.slug}`} 
                className="block rounded-xl border border-white/20 bg-white/5 p-4 text-center hover:border-brand-primary/50 transition-all"
              >
                ← غرفة {room.title}
              </Link>
              <Link 
                href="/rooms" 
                className="block rounded-xl border border-white/20 bg-white/5 p-4 text-center hover:border-brand-primary/50 transition-all"
              >
                جميع الغرف
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

