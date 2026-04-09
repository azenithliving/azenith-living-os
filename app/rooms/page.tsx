import { roomDefinitions } from "@/lib/site-content";
import RoomLink from "@/components/RoomLink";

export default function RoomsPage() {
  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 space-y-4">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-primary/70">Vertical hubs</p>
          <h1 className="font-serif text-4xl text-white md:text-6xl">اختر المساحة التي تريد بدءها.</h1>
          <p className="max-w-3xl text-base leading-8 text-white/65">كل مساحة لها منطق توزيع، خامات، وخطوات قرار مختلفة. هذه الصفحة تقسم العرض بشكل عملي بدل عرض عام ومبهم.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {roomDefinitions.map((room) => (
            <RoomLink
              key={room.slug}
              roomSlug={room.slug}
              className="group rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 transition-all hover:border-brand-primary hover:bg-brand-primary/[0.05] hover:-translate-y-2"
            >
              <p className="text-sm text-brand-primary group-hover:text-brand-primary/80">{room.eyebrow}</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">{room.title}</h2>
              <p className="mt-3 text-sm leading-7 text-white/60">{room.summary}</p>
              <div className="mt-5 space-y-2 text-sm text-white/72">
                {room.bullets.slice(0, 3).map((bullet) => (
                  <div key={bullet} className="flex items-center gap-3 animate-fadeInUp animation-delay-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-primary" />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10 flex gap-4">
                <span className="text-brand-primary hover:text-brand-primary/80 font-medium cursor-pointer">استكشف الغرفة</span>
                {(room.furniture || []).length > 0 && (
                  <span className="text-white/60 hover:text-white font-medium cursor-pointer">عرض الأثاث</span>
                )}
              </div>
            </RoomLink>
          ))}
        </div>
      </div>
    </main>
  );
}
