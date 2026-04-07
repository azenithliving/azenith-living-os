import { getDashboardSnapshot } from "@/lib/dashboard";

function getLeadTemperature(score: number): "hot" | "warm" | "cold" {
  if (score > 70) return "hot";
  if (score > 30) return "warm";
  return "cold";
}

function getTemperatureColor(temp: "hot" | "warm" | "cold"): string {
  switch (temp) {
    case "hot":
      return "border-red-500/30 bg-red-500/10";
    case "warm":
      return "border-yellow-500/30 bg-yellow-500/10";
    default:
      return "border-blue-500/30 bg-blue-500/10";
  }
}

export default async function LeadsPage() {
  const snapshot = await getDashboardSnapshot();

  if (snapshot.setupError) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-amber-500/20 bg-amber-500/10 p-8">
          <h1 className="font-serif text-4xl text-white md:text-5xl">تعذر تحميل العملاء لأن schema Supabase غير مفعّلة بعد.</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/65">{snapshot.setupError}</p>
        </div>
      </main>
    );
  }

  if (!snapshot.tenant) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h1 className="font-serif text-4xl text-white md:text-5xl">صفحة العملاء المحتملين جاهزة، لكن لا يوجد Tenant مفعّل.</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/65">أضف الشركة واربط الدومين من لوحة التحكم أولًا، ثم ستظهر الـ leads والطلبات تلقائيًا هنا.</p>
        </div>
      </main>
    );
  }

  const sortedLeads = [...snapshot.leads].sort((a, b) => b.score - a.score);
  const hotLeads = sortedLeads.filter((l) => getLeadTemperature(l.score) === "hot");
  const warmLeads = sortedLeads.filter((l) => getLeadTemperature(l.score) === "warm");
  const coldLeads = sortedLeads.filter((l) => getLeadTemperature(l.score) === "cold");

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Leads CRM</p>
          <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">العملاء المحتملون</h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-white/60">مرتبة حسب درجة الحرارة (Hot/Warm/Cold) بناءً على النشاط والنوايا.</p>
        </div>

        {sortedLeads.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-sm text-white/60">لم يتم تسجيل أي Lead بعد على هذا الدومين.</div>
        ) : (
          <>
            {hotLeads.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">🔥 عملاء ساخنون ({hotLeads.length})</h2>
                <div className="grid gap-3">
                  {hotLeads.map((lead) => (
                    <article key={lead.id} className={`grid gap-4 rounded-[2rem] border p-6 md:grid-cols-[1fr_1fr_0.8fr_0.6fr] ${getTemperatureColor("hot")}`}>
                      <div><p className="text-sm text-white/45">المساحة</p><p className="mt-1 font-semibold text-white">{lead.roomType}</p></div>
                      <div><p className="text-sm text-white/45">الخدمة</p><p className="mt-1 font-semibold text-white">{lead.serviceType}</p></div>
                      <div><p className="text-sm text-white/45">النية</p><p className="mt-1 font-semibold text-white">{lead.intent}</p></div>
                      <div><p className="text-sm text-white/45">السكور</p><p className="mt-1 font-semibold text-lg text-white">{lead.score}</p></div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {warmLeads.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">🌤️ عملاء دافئون ({warmLeads.length})</h2>
                <div className="grid gap-3">
                  {warmLeads.map((lead) => (
                    <article key={lead.id} className={`grid gap-4 rounded-[2rem] border p-6 md:grid-cols-[1fr_1fr_1fr_0.8fr_0.6fr] ${getTemperatureColor("warm")}`}>
                      <div><p className="text-sm text-white/45">المساحة</p><p className="mt-1 font-semibold text-white">{lead.roomType}</p></div>
                      <div><p className="text-sm text-white/45">الخدمة</p><p className="mt-1 font-semibold text-white">{lead.serviceType}</p></div>
                      <div><p className="text-sm text-white/45">الأسلوب</p><p className="mt-1 font-semibold text-white">{lead.style || "-"}</p></div>
                      <div><p className="text-sm text-white/45">النية</p><p className="mt-1 font-semibold text-white">{lead.intent}</p></div>
                      <div><p className="text-sm text-white/45">السكور</p><p className="mt-1 font-semibold text-lg text-white">{lead.score}</p></div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {coldLeads.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">❄️ عملاء باردون ({coldLeads.length})</h2>
                <div className="grid gap-3">
                  {coldLeads.map((lead) => (
                    <article key={lead.id} className={`grid gap-4 rounded-[2rem] border p-6 md:grid-cols-[1fr_1fr_1fr_0.8fr_0.6fr] ${getTemperatureColor("cold")}`}>
                      <div><p className="text-sm text-white/45">المساحة</p><p className="mt-1 font-semibold text-white">{lead.roomType}</p></div>
                      <div><p className="text-sm text-white/45">الخدمة</p><p className="mt-1 font-semibold text-white">{lead.serviceType}</p></div>
                      <div><p className="text-sm text-white/45">الأسلوب</p><p className="mt-1 font-semibold text-white">{lead.style || "-"}</p></div>
                      <div><p className="text-sm text-white/45">النية</p><p className="mt-1 font-semibold text-white">{lead.intent}</p></div>
                      <div><p className="text-sm text-white/45">السكور</p><p className="mt-1 font-semibold text-lg text-white">{lead.score}</p></div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
