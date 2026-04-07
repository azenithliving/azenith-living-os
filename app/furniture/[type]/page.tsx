"use client"

import Link from "next/link";
import { useParams } from "next/navigation";
import { roomDefinitions, type FurnitureDefinition } from "@/lib/site-content";
import { getClientRuntimeConfig } from "@/lib/client-runtime-config";
import FurnitureCard from "@/components/FurnitureCard";

type FurnitureWithRoom = FurnitureDefinition & {
  roomSlug: string;
  roomTitle: string;
};

export default function FurnitureTypePage() {
  const params = useParams();
  const type = params.type as string;
  const matchingFurniture = roomDefinitions.flatMap(room => 
    (room.furniture || []).filter(f => 
      f.title.toLowerCase().includes(type) || 
      (type === 'sofas' && f.title.includes('كنب')) ||
      (type === 'corner-sofas' && f.title.includes('زاوية'))
    ).map(f => ({ ...f, roomSlug: room.slug, roomTitle: room.title }))
  );

  const clientRuntimeConfig = getClientRuntimeConfig();

  const getWhatsappUrl = (msg: string) => clientRuntimeConfig ? `https://wa.me/${clientRuntimeConfig.whatsappNumber}?text=${encodeURIComponent(msg)}` : "/start";

  const titleMap: Record<string, string> = {
    sofas: "الكنب",
    'corner-sofas': "كنب الزوايا"
  };

  const pageTitle = titleMap[type as keyof typeof titleMap] || type;

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-6 animate-fadeInUp">
          <Link href="/furniture" className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 text-lg">
            ← الكتالوج الكامل
          </Link>
          <h1 className="font-serif text-5xl md:text-7xl text-white">{pageTitle}</h1>
          <p className="max-w-2xl mx-auto text-xl leading-8 text-white/80">
            جميع {pageTitle.toLowerCase()} متاحة مقسمة حسب سياق الغرفة لاختيار مثالي.
          </p>
        </div>

        {matchingFurniture.length > 0 ? (
          <div className="space-y-12">
            {roomDefinitions.map(room => {
              const roomFurniture = matchingFurniture.filter(f => f.roomSlug === room.slug);
              if (roomFurniture.length === 0) return null;
              return (
                <section key={room.slug} className="space-y-8 animate-fadeInUp">
                  <div className="flex items-center gap-4">
                    <Link href={`/room/${room.slug}`} className="inline-flex items-center gap-2 text-brand-primary hover:text-brand-primary/80 font-semibold">
                      <span>{room.title}</span>
                    </Link>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/30 to-transparent" />
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {roomFurniture.map((furniture: FurnitureWithRoom) => (
                      <FurnitureCard 
                        key={furniture.slug}
                        furniture={furniture}
                        whatsappUrl={getWhatsappUrl(`${room.title} - ${furniture.title}`)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 space-y-4">
            <p className="text-2xl text-white/60">لا توجد قطع {pageTitle.toLowerCase()} حالياً</p>
            <Link href="/furniture" className="inline-flex items-center gap-3 rounded-full border border-white/20 px-8 py-4 text-lg font-semibold text-white hover:border-brand-primary hover:text-brand-primary">
              تصفح الكتالوج الكامل ←
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

