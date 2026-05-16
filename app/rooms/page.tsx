"use client";

import { useState } from "react";
import { roomDefinitions } from "@/lib/site-content";
import RoomLink from "@/components/RoomLink";
import useSessionStore from "@/stores/useSessionStore";

function RoomCard({ room, isRTL }: { room: any, isRTL: boolean }) {
  const [tab, setTab] = useState<"spaces" | "furniture">("spaces");

  return (
    <RoomLink
      roomSlug={room.slug}
      className="group block rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 transition-all hover:border-brand-primary hover:bg-brand-primary/[0.05] hover:-translate-y-2 relative"
    >
      <p className="text-sm text-brand-primary group-hover:text-brand-primary/80">{room.eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{room.title}</h2>
      <p className="mt-3 text-sm leading-7 text-white/60">{room.summary}</p>
      
      <div className="mt-5 space-y-2 text-sm text-white/72 min-h-[100px]">
        {tab === "spaces" && room.bullets.slice(0, 3).map((bullet: string) => (
          <div key={bullet} className="flex items-center gap-3 animate-fadeInUp">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
            <span>{bullet}</span>
          </div>
        ))}
        {tab === "furniture" && (room.furniture || []).slice(0, 3).map((furn: any) => (
          <div key={furn.slug} className="flex items-center gap-3 animate-fadeInUp">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span>{furn.title}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-white/10 flex gap-4">
        <button
          onClick={(e) => { e.preventDefault(); setTab("spaces"); }}
          className={`${tab === "spaces" ? "text-brand-primary" : "text-white/60"} hover:text-brand-primary/80 font-medium`}
        >
          {isRTL ? "المساحات" : "Spaces"}
        </button>
        {(room.furniture || []).length > 0 && (
          <button
            onClick={(e) => { e.preventDefault(); setTab("furniture"); }}
            className={`${tab === "furniture" ? "text-brand-primary" : "text-white/60"} hover:text-white font-medium`}
          >
            {isRTL ? "عرض الأثاث" : "View Furniture"}
          </button>
        )}
      </div>
    </RoomLink>
  );
}

export default function RoomsPage() {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";
  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-primary/70">
            {isRTL ? "المساحات" : "Spaces"}
          </p>
          <h1 className="font-serif text-4xl text-white md:text-6xl">
            {isRTL ? "اختر المساحة التي تريد بدءها." : "Choose the space you want to start with."}
          </h1>
          <p className="max-w-3xl text-base leading-8 text-white/65">
            {isRTL 
              ? "كل مساحة لها منطق توزيع، خامات، وخطوات قرار مختلفة. هذه الصفحة تقسم العرض بشكل عملي بدل عرض عام ومبهم."
              : "Each space has its own layout logic, materials, and decision steps. This page breaks down the offering practically instead of a vague general presentation."}
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {roomDefinitions.map((room) => (
            <RoomCard key={room.slug} room={room} isRTL={isRTL} />
          ))}
        </div>
      </div>
    </main>
  );
}
