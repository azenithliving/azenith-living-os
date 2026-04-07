"use client"

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getRoomDefinition, packageLadder, type RoomDefinition } from "@/lib/site-content";
import { getClientRuntimeConfig } from "@/lib/client-runtime-config";

import useSessionStore from "@/stores/useSessionStore";
import FurnitureCard from "@/components/FurnitureCard";

interface FurnitureType {
  slug: string;
  title: string;
  images: string[];
  video?: string;
  description: string;
  priceRange: string;
  features: string[];
  variations: string[];
}

export default function RoomPage() {
  const params = useParams();
  const id = params.id as string;
  const [filterPrice, setFilterPrice] = useState<string>("all");
  const [filterFeature, setFilterFeature] = useState<string>("");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const room = useMemo(() => getRoomDefinition(id) as RoomDefinition | null, [id]);
  const filteredFurniture = useMemo(() => {
    let filtered = room?.furniture ?? [];
    if (filterPrice !== "all") {
      filtered = filtered.filter((f) => f.priceRange.includes(filterPrice));
    }
    if (filterFeature) {
      filtered = filtered.filter((f) => f.features.some((feat) => feat.includes(filterFeature)));
    }
    return filtered as FurnitureType[];
  }, [filterFeature, filterPrice, room]);
  // Static client config
  const runtimeConfig = getClientRuntimeConfig();

  useEffect(() => {
    if (room) {
      updateProfile({ roomType: room.title, lastPage: `/room/${id}` });
    }
  }, [id, room, updateProfile]);

  const toggleWishlist = (slug: string) => {
    setWishlist(prev => 
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
  };

  const roomFurnitureMessage = `${room?.title || ''} - استفسار عن الأثاث`;
  const getWhatsappUrl = (msg: string) => `https://wa.me/${runtimeConfig?.whatsappNumber || ''}?text=${encodeURIComponent(msg)}`;

  if (!room) {
    return <div>جاري التحميل...</div>;
  }

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Immersive Hero with 360 */}
        <section className="relative rounded-[2rem] overflow-hidden bg-gradient-to-br from-brand-primary/5 to-white/5 p-8 md:p-12">
          <div className="absolute inset-0">
            {/* 360 Tour Placeholder */}
            <iframe 
              src="https://360rumors.com/wp-content/uploads/2021/04/example-360-iframe.html" 
              className="w-full h-[400px] md:h-[500px] rounded-[1.5rem] border-0"
              allowFullScreen
            />
          </div>
          <div className="relative z-10 space-y-6 bg-black/30 backdrop-blur-md p-8 rounded-[1.5rem] mt-8">
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/80 animate-fadeInUp">{room.eyebrow}</p>
            <h1 className="font-serif text-4xl text-white md:text-6xl animate-fadeInUp animation-delay-200">{room.title}</h1>
            <p className="max-w-2xl text-xl leading-8 text-white/80 backdrop-blur-sm animate-fadeInUp animation-delay-400">{room.outcome}</p>
          </div>
        </section>

        <div className="grid gap-12 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Focus Points */}
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
              <h2 className="text-3xl font-semibold text-white mb-8">ما الذي نركز عليه هنا؟</h2>
              <div className="grid gap-4 md:grid-cols-2">
{room.bullets.map((bullet: string, index: number) => (
                  <div key={index} className="group rounded-[1.5rem] border border-white/8 bg-[#111112]/50 p-6 text-sm leading-7 text-white/80 backdrop-blur transition-all hover:border-brand-primary/50 hover:bg-brand-primary/5 hover:-translate-y-1">
                    {bullet}
                  </div>
                ))}
              </div>
              <p className="mt-8 text-lg leading-8 text-white/70">{room.summary}</p>
            </section>

        {/* Furniture Gallery with Filters */}
            {room.furniture && room.furniture.length > 0 && (
              <section className="space-y-8">
                <div className="flex flex-wrap gap-4 mb-6">
                  <select value={filterPrice} onChange={(e) => setFilterPrice(e.target.value)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-white">
                    <option value="all">جميع الأسعار</option>
                    <option value="10,000">أقل من 10,000</option>
                    <option value="25,000">10,000 - 25,000</option>
                    <option value="25,000+">أعلى من 25,000</option>
                  </select>
                  <select value={filterFeature} onChange={(e) => setFilterFeature(e.target.value)} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-white">
                    <option value="">جميع المميزات</option>
                    <option value="خشب">خشب طبيعي</option>
                    <option value="إضاءة">إضاءة</option>
                    <option value="تخزين">تخزين</option>
                  </select>
                  <span className="ml-auto text-sm text-white/60">({filteredFurniture.length}/{room.furniture.length}) نتيجة</span>
                </div>
                <h2 className="text-3xl font-semibold text-white">الأثاث الموصى به لهذه المساحة</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredFurniture.map((furniture) => (
                      <FurnitureCard 
                      key={furniture.slug}
                      furniture={furniture}
                      whatsappUrl={getWhatsappUrl(`${room.title} - ${furniture.title}`)}
                      isWishlisted={wishlist.includes(furniture.slug)}
                      onWishlistToggle={() => toggleWishlist(furniture.slug)}
                    />

                  ))}
                </div>
                {wishlist.length > 0 && (
                  <div className="mt-8 p-6 rounded-[2rem] border border-brand-primary/30 bg-brand-primary/10">
                    <h3 className="text-xl font-semibold text-white mb-4">قائمة الرغبات ({wishlist.length})</h3>
                    <p className="text-sm text-white/70">اضغط على القلب في أي قطعة لإضافتها/إزالتها.</p>
                  </div>
                )}
              </section>
            )}

          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            <div className="rounded-[2rem] border border-brand-primary/20 bg-gradient-to-b from-brand-primary/10 to-brand-primary/5 p-8 sticky top-24">
              <p className="text-sm uppercase tracking-wide text-brand-primary font-medium mb-2">أفضل نقطة بدء</p>
              <h3 className="text-2xl font-semibold text-white mb-4">{packageLadder[1].title}</h3>
              <p className="text-sm leading-6 text-white/75 mb-6">{packageLadder[1].summary}</p>
              <div className="space-y-3 mb-8">
                {packageLadder[1].bullets.map((bullet, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="h-2 w-2 mt-2 rounded-full bg-brand-primary flex-shrink-0" />
                    <span className="text-sm text-white/80 leading-6">{bullet}</span>
                  </div>
                ))}
              </div>
              <Link href="/start" className="w-full block rounded-full bg-brand-primary text-brand-accent px-6 py-3 text-center font-semibold shadow-lg hover:bg-[#d8b56d] hover:shadow-xl transition-all">
                ابدأ التقييم لهذه المساحة
              </Link>
            </div>

            {/* Quick CTA */}
            {(room.furniture || []).length > 0 && (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6">
                <p className="text-sm text-brand-primary mb-3">جاهز للشراء؟</p>
            <Link 
                  href={getWhatsappUrl(roomFurnitureMessage)}
                  target="_blank"
                  className="w-full block rounded-full bg-gradient-to-r from-brand-primary to-[#d8b56d]/90 text-brand-accent px-6 py-4 text-center font-bold shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02]"
                >
                  تواصل عبر واتساب 👋
                </Link>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
