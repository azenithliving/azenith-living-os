import { getDashboardSnapshot } from "@/lib/dashboard";
import { DiamondLeads, Lead } from "./DiamondLeads";

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

  const leads = snapshot.leads as Lead[];

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-amber-400/70">Elite Intelligence</p>
          <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">Lead Qualification Dashboard</h1>
          <p className="mt-3 max-w-2xl text-base leading-8 text-white/60">
            AI-powered lead scoring with Diamond/Gold/Silver tiers. Click WhatsApp to send detailed dossiers.
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-sm text-white/60">
            لم يتم تسجيل أي Lead بعد على هذا الدومين.
          </div>
        ) : (
          <DiamondLeads 
            leads={leads} 
            adminWhatsApp={snapshot.tenant.whatsapp || undefined}
          />
        )}
      </div>
    </main>
  );
}
