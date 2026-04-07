"use client";

import { useState } from "react";
import { PAYMENT_PLANS } from "@/lib/payments";

type PaymentPlan = keyof typeof PAYMENT_PLANS;

export default function BillingPage() {
  const [currentPlan, setCurrentPlan] = useState<PaymentPlan>("free");
  const [loading, setLoading] = useState(false);

  const selectPlan = async (planId: PaymentPlan) => {
    if (planId === "free") {
      // Free plan doesn't need payment
      setCurrentPlan("free");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          successUrl: `${window.location.origin}/dashboard/billing?success=true`,
          cancelUrl: `${window.location.origin}/dashboard/billing?canceled=true`
        })
      });

      const data = await response.json();
      if (data.ok && data.checkoutUrl) {
        // Redirect to Stripe checkout
        window.location.href = data.checkoutUrl;
      }
    } catch (error) {
      console.error("Failed to initiate checkout:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Billing</p>
          <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">الفواتير والخطط</h1>
        </div>

        {/* Status Message */}
        {typeof window !== "undefined" && new URLSearchParams(window.location.search).get("success") && (
          <div className="rounded-[2rem] border border-green-500/20 bg-green-500/10 p-6">
            <p className="text-green-400">تم الترقية بنجاح! سيتم تفعيل ميزاتك الجديدة فوراً.</p>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="grid gap-6 md:grid-cols-3">
          {Object.entries(PAYMENT_PLANS).map(([planId, plan]) => (
            <div
              key={planId}
              className={`rounded-[2rem] border p-8 transition ${
                currentPlan === planId
                  ? "border-brand-primary bg-brand-primary/10"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
              <p className="mt-2 text-base text-white/60">{plan.features.length} ميزات</p>

              <div className="mt-6">
                <p className="text-4xl font-bold text-brand-primary">
                  {plan.amount === 0 ? "مجاني" : `${(plan.amount / 100).toFixed(0)} SAR`}
                </p>
                {plan.amount > 0 && (
                  <p className="mt-1 text-sm text-white/60">/ شهر</p>
                )}
              </div>

              <button
                onClick={() => selectPlan(planId as PaymentPlan)}
                disabled={loading || currentPlan === planId}
                className={`mt-8 w-full rounded-full py-3 text-sm font-semibold transition ${
                  currentPlan === planId
                    ? "bg-white/20 text-white/70"
                    : "bg-brand-primary text-brand-accent hover:bg-[#d8b56d] disabled:opacity-50"
                }`}
              >
                {currentPlan === planId ? "الخطة الحالية" : loading ? "جاري المعالجة..." : "اختر هذه الخطة"}
              </button>

              <div className="mt-8 space-y-3 border-t border-white/10 pt-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="mt-1 text-brand-primary">✓</span>
                    <span className="text-sm text-white/70">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Invoice History */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">سجل الفواتير</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">لا توجد فواتير بعد</h3>
                  <p className="mt-1 text-sm text-white/60">ستظهر فواتيرك هنا عند الاشتراك في خطة مدفوعة</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Method */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white mb-6">طرق الدفع</h2>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-white/60">لا توجد طرق دفع محفوظة</p>
            <button className="mt-4 rounded border border-brand-primary px-4 py-2 text-sm text-brand-primary hover:bg-brand-primary/10">
              إضافة طريقة دفع
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}