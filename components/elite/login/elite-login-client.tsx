"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Link2, MessageCircle, ShieldCheck } from "lucide-react";

/**
 * Elite access is invitation-only. A previous form generated a token but did
 * not send it through WhatsApp, which made the success state misleading and
 * allowed unauthorised access requests. The administrator now issues a real,
 * one-time invitation link from the admin area.
 */
export function EliteLoginClient() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6 pt-20">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-[#C5A059]/5 blur-3xl" />
        <div className="absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-[#E5C170]/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-3xl border border-white/10 bg-[#1A1A1B]/80 p-8 backdrop-blur-xl md:p-10">
          <div className="mb-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C5A059] to-[#E5C170]">
              <MessageCircle className="h-8 w-8 text-black" />
            </div>
            <h1 className="mb-3 font-serif text-2xl font-bold text-white md:text-3xl">دخول النخبة</h1>
            <p className="text-white/60">تُفتح تجربة النخبة برابط دعوة آمن ومستخدم لمرة واحدة.</p>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right">
              <div className="mb-3 flex items-center gap-3 text-[#E5C170]">
                <Link2 className="h-5 w-5" />
                <h2 className="font-semibold">لديك رابط دعوة</h2>
              </div>
              <p className="text-sm leading-6 text-white/60">
                افتح الرابط الذي أرسله فريق Azenith. يتحقق الموقع من الرابط ويبدأ جلستك تلقائيًا.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right">
              <div className="mb-3 flex items-center gap-3 text-[#E5C170]">
                <ShieldCheck className="h-5 w-5" />
                <h2 className="font-semibold">تحتاج دعوة؟</h2>
              </div>
              <p className="text-sm leading-6 text-white/60">
                أرسل طلب استشارة، وسيصدر الفريق رابطًا يدويًا عند تفعيل وصولك. لا يرسل هذا الموقع رسائل واتساب تلقائيًا ما لم تُهيّأ خدمة الإرسال.
              </p>
              <Link
                href="/request"
                className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#C5A059] to-[#E5C170] py-3 font-bold text-black transition-all hover:shadow-[0_0_30px_rgba(197,160,89,0.3)]"
              >
                اطلب دعوة النخبة
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6 text-center">
            <p className="text-sm text-white/40">
              ليست عضواً في النخبة؟{" "}
              <Link href="/start" className="text-[#C5A059] transition-colors hover:text-[#E5C170]">ابدأ رحلتك</Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/40 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            العودة للرئيسية
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
