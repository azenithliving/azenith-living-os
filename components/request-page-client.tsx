"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { AlertCircle, LoaderCircle, MessageCircle } from "lucide-react";
import Link from "next/link";

import { buildWhatsAppUrl } from "@/lib/conversion-engine";
import { estimateQuote, getPackageRecommendations } from "@/lib/quote-estimator";
import type { RuntimeConfig } from "@/lib/runtime-config";
import useSessionStore from "@/stores/useSessionStore";
import { getTranslation } from "@/lib/multilingual-engine";

type RequestPageClientProps = {
  runtimeConfig: RuntimeConfig;
};

type LeadApiResponse = { ok: boolean; message?: string };

export default function RequestPageClient({ runtimeConfig }: RequestPageClientProps) {
  const sessionId = useSessionStore((state) => state.sessionId);
  const score = useSessionStore((state) => state.score);
  const intent = useSessionStore((state) => state.intent);
  const roomType = useSessionStore((state) => state.roomType);
  const budget = useSessionStore((state) => state.budget);
  const style = useSessionStore((state) => state.style);
  const serviceType = useSessionStore((state) => state.serviceType);
  const updateProfile = useSessionStore((state) => state.updateProfile);
  const trackEvent = useSessionStore((state) => state.trackEvent);
  const language = useSessionStore((state) => state.language);

  // Translation helper
  const t = (key: string) => getTranslation(key, language);
  const isRTL = language === "ar";
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const profile = useMemo(() => ({ roomType, budget, style, serviceType, intent }), [budget, intent, roomType, serviceType, style]);
  const hasEnoughProfileData = Boolean(roomType && budget && style && serviceType);
  const quote = estimateQuote({ roomType: roomType || "غرف المعيشة", budget: budget || "5,500 - 12,000 EGP", style: style || "مودرن دافئ", serviceType: serviceType || "تصميم وتنفيذ" });
  const recommendations = getPackageRecommendations({ roomType: roomType || "غرف المعيشة", budget: budget || "5,500 - 12,000 EGP", style: style || "مودرن دافئ", serviceType: serviceType || "تصميم وتنفيذ" });
  const whatsappUrl = runtimeConfig.whatsappNumber ? buildWhatsAppUrl(runtimeConfig.whatsappNumber, profile, runtimeConfig.brandNameAr) : "/start";

  useEffect(() => {
    updateProfile({ lastPage: "/request" });
    trackEvent("page_view");
    trackEvent("quote_view");
  }, [trackEvent, updateProfile]);

  async function submitLead() {
    setErrorMessage("");
    setStatusMessage("");
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, fullName, phone, email, notes, roomType, budget, style, serviceType, score, intent, lastPage: "/request" }),
    });
    const payload = (await response.json()) as LeadApiResponse;
    if (!response.ok || !payload.ok) {
      setErrorMessage(payload.message ?? "تعذر حفظ الطلب الآن.");
      return;
    }
    trackEvent("request_submit");
    setSubmitted(true);
    setStatusMessage("تم حفظ الطلب بنجاح. يمكنك الآن الانتقال إلى واتساب ومعك ملخص واضح للحالة.");
  }

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasEnoughProfileData) {
      setErrorMessage(isRTL ? "أكمل خطوة التقييم السريع أولًا حتى نبني التقدير الصحيح." : "Complete the quick assessment step first to build the correct estimate.");
      return;
    }
    startTransition(() => { void submitLead(); });
  };

  return (
    <main className="px-6 py-12 md:px-10 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_0.3fr]">
        <section className="space-y-8">
          <div className="space-y-4">
            <p className="text-sm uppercase tracking-[0.3em] text-brand-primary/70">{isRTL ? "Request intake" : "Request"}</p>
            <h1 className="font-serif text-4xl text-white md:text-6xl">{isRTL ? "حوّل التقييم إلى طلب فعلي." : "Turn Assessment into Real Request."}</h1>
            <p className="max-w-3xl text-base leading-8 text-white/65">{isRTL ? "هذه المرحلة تحفظ بيانات العميل وتجهز رسالة الإغلاق عبر واتساب." : "This stage saves client data and prepares the closing message via WhatsApp."}</p>
          </div>
          <form onSubmit={onSubmit} className="grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:grid-cols-2">
            <label className="space-y-2"><span className="text-sm text-white/65">{t("elite.contact.name")}</span><input required value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary" /></label>
            <label className="space-y-2"><span className="text-sm text-white/65">{t("elite.contact.phone")}</span><input required value={phone} onChange={(event) => setPhone(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary" /></label>
            <label className="space-y-2"><span className="text-sm text-white/65">{t("elite.contact.email")}</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary" /></label>
            <div className="rounded-2xl border border-white/10 bg-[#111112] px-4 py-3 text-sm text-white/72"><p className="text-white/45">{isRTL ? "الملف الحالي" : "Current Profile"}</p><p className="mt-2">{roomType || (isRTL ? "لم تُحدد المساحة بعد" : "Room not selected")} / {serviceType || (isRTL ? "لم تُحدد الخدمة بعد" : "Service not selected")}</p></div>
            <label className="space-y-2 md:col-span-2"><span className="text-sm text-white/65">{isRTL ? "ملاحظات إضافية" : "Additional Notes"}</span><textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary" /></label>
            {(errorMessage || statusMessage) ? <div className={`md:col-span-2 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm ${errorMessage ? "border border-red-500/20 bg-red-500/10 text-red-100" : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100"}`}><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{errorMessage || statusMessage}</span></div> : null}
            <div className="md:col-span-2 flex flex-col gap-4 sm:flex-row">
              <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-primary px-7 py-4 text-base font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-60">{isPending ? <LoaderCircle className="h-5 w-5 animate-spin" /> : null}{t("elite.submit")}</button>
              <Link href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("whatsapp_click")} className="inline-flex items-center justify-center gap-3 rounded-full border border-white/10 px-7 py-4 text-base font-semibold text-white transition hover:border-brand-primary hover:text-brand-primary"><MessageCircle className="h-5 w-5" />{isRTL ? "الانتقال إلى واتساب" : "Go to WhatsApp"}</Link>
            </div>
          </form>
        </section>
        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-brand-primary/15 bg-brand-primary/[0.08] p-6"><p className="text-sm text-brand-primary">{isRTL ? "تقدير مبدئي" : "Initial Estimate"}</p><p className="mt-4 text-4xl font-semibold text-white">{quote.estimated.toLocaleString("en-US")} EGP</p><div className="mt-5 space-y-3 text-sm text-white/70"><div className="flex items-center justify-between gap-3"><span>{isRTL ? "رسوم التصميم" : "Design Fee"}</span><span>{quote.designFee.toLocaleString("en-US")} EGP</span></div><div className="flex items-center justify-between gap-3"><span>{isRTL ? "نطاق التنفيذ" : "Execution Range"}</span><span>{quote.executionEnvelope.toLocaleString("en-US")} EGP</span></div><div className="flex items-center justify-between gap-3"><span>{isRTL ? "النية الحالية" : "Current Intent"}</span><span>{intent}</span></div></div></div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6"><p className="text-sm text-brand-primary">{isRTL ? "الباقات الأنسب" : "Recommended Packages"}</p><div className="mt-5 space-y-4">{recommendations.map((item) => <div key={item.key} className="border-b border-white/8 pb-4 last:border-b-0 last:pb-0"><div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-white">{item.title}</h2><span className="text-sm text-brand-primary">{item.price}</span></div><p className="mt-2 text-sm leading-7 text-white/60">{item.summary}</p></div>)}</div></div>
          {submitted ? <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-6 text-sm leading-7 text-emerald-100">{isRTL ? "تم حفظ الطلب، والخطوة التالية المنطقية الآن هي الإغلاق عبر واتساب." : "Request saved. The next logical step is closing via WhatsApp."}</div> : null}
        </aside>
      </div>
    </main>
  );
}
