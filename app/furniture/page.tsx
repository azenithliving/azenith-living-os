"use client"

import Link from "next/link";
import { roomDefinitions } from "@/lib/site-content";
import FurnitureCard from "@/components/FurnitureCard";
import { getClientRuntimeConfig } from "@/lib/client-runtime-config";

export default function FurniturePage() {
  const allFurniture = roomDefinitions.flatMap(room => 
    (room.furniture || []).map(f => ({ ...f, roomSlug: room.slug, roomTitle: room.title }))
  );

  const clientRuntimeConfig = getClientRuntimeConfig();

  const getWhatsappUrl = (msg: string) => clientRuntimeConfig ? `https://wa.me/${clientRuntimeConfig.whatsappNumber}?text=${encodeURIComponent(msg)}` : "/start";

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl space-y-12">
        <div className="text-center space-y-6">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-primary/70">Furniture Hub</p>
          <h1 className="font-serif text-5xl md:text-7xl text-white">جميع قطع الأثاث حسب الغرفة</h1>
          <p className="max-w-3xl mx-auto text-xl leading-8 text-white/80">تصفح كامل الكتالوج مقسم حسب سياق الغرفة لتجربة متكاملة.</p>
          <Link href="/rooms" className="inline-flex items-center gap-3 rounded-full border border-white/20 px-8 py-4 text-lg font-semibold text-white hover:border-brand-primary hover:text-brand-primary transition-all">
            ← رجوع للغرف
          </Link>
        </div>

        <div className="space-y-16">
          {roomDefinitions.map(room => 
            (room.furniture || []).length > 0 && (
              <section key={room.slug} className="space-y-8 animate-fadeInUp">
                <div className="flex items-center gap-4">
                  <Link href={`/rooms/${room.slug}`} className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80">
                    <span>غرفة {room.title}</span>
                  </Link>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/30 to-transparent" />
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {room.furniture!.map(furniture => (
                    <FurnitureCard 
                      key={furniture.slug}
                      furniture={furniture}
                      whatsappUrl={getWhatsappUrl(`${room.title} - ${furniture.title}`)}
                    />
                  ))}
                </div>
              </section>
            )
          )}
        </div>

        {allFurniture.length === 0 && (
          <div className="text-center py-20">
            <p className="text-2xl text-white/60">قريباً: كتالوج كامل للأثاث</p>
          </div>
        )}
      </div>
    </main>
  );
}

