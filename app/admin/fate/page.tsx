"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

/**
 * The previous "Fate" console could display invented scarcity, lock visitor
 * screens, and claim discounts without an order or campaign behind them. It
 * is retired rather than kept as an inert control panel.
 */
export default function FateControlPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 md:p-12" dir="rtl">
      <section className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-8 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400" />
        <h1 className="mt-5 text-3xl font-bold text-white">تم إيقاف أدوات التأثير الوهمية</h1>
        <p className="mx-auto mt-4 max-w-xl leading-8 text-white/65">
          لا يستخدم الموقع عدادات خصم غير موثقة، أو إشعارات حضور مصطنعة، أو تجميد شاشة الزائر. استخدم مركز المبيعات لإدارة المحادثات والمتابعات الحقيقية.
        </p>
        <Link href="/admin/sales" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-5 py-3 font-bold text-black transition hover:bg-[#d8b56d]">
          <ArrowLeft className="h-4 w-4" /> فتح مركز المبيعات
        </Link>
      </section>
    </main>
  );
}
