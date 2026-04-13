"use client";

/**
 * ELITE LOGIN PAGE CLIENT
 * Passwordless WhatsApp authentication interface
 * 
 * CLASSIFICATION: ISOLATE
 * Elite-specific login experience
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, ArrowLeft, MessageCircle, CheckCircle2 } from "lucide-react";
import { initiateWhatsAppLogin } from "@/app/[locale]/elite/actions/elite-actions";

export function EliteLoginClient() {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await initiateWhatsAppLogin(phone);
      
      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.error || "فشل في إرسال رابط الدخول");
      }
    } catch {
      setError("حدث خطأ غير متوقع");
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, "");
    
    // Format as Egyptian mobile number
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6 pt-20">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-[#C5A059]/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-[#E5C170]/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-[#1A1A1B]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-10">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C5A059] to-[#E5C170] flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="h-8 w-8 text-black" />
            </div>
            <h1 className="text-2xl md:text-3xl font-serif text-white font-bold mb-3">
              دخول النخبة
            </h1>
            <p className="text-white/60">
              أدخل رقم هاتفك لاستلام رابط الدخول عبر واتساب
            </p>
          </div>

          {isSuccess ? (
            /* Success State */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-white mb-3">
                تم إرسال رابط الدخول!
              </h2>
              <p className="text-white/60 mb-6">
                تحقق من رسائل واتساب الخاصة بك واضغط على الرابط للدخول
              </p>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setPhone("");
                }}
                className="text-[#C5A059] hover:text-[#E5C170] transition-colors"
              >
                إعادة إرسال لرقم آخر
              </button>
            </motion.div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Phone Input */}
              <div className="relative">
                <label className="block text-white/80 text-sm font-medium mb-2 text-right">
                  رقم الهاتف
                </label>
                <div className="relative">
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                    <Phone className="h-5 w-5" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    placeholder="01X XXX XXXXX"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pr-12 pl-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#C5A059]/50 focus:ring-1 focus:ring-[#C5A059]/50 transition-all text-left"
                    dir="ltr"
                    maxLength={13}
                    required
                  />
                </div>
                <p className="text-white/40 text-xs mt-2 text-right">
                  أدخل رقم واتساب المسجل لدينا
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-200 text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || phone.replace(/\D/g, "").length < 10}
                className="w-full group flex items-center justify-center gap-3 bg-gradient-to-r from-[#C5A059] to-[#E5C170] text-black font-bold py-4 rounded-xl hover:shadow-[0_0_30px_rgba(197,160,89,0.3)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <span>إرسال رابط الدخول</span>
                    <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-white/40 text-sm">
              ليست عضواً في النخبة؟{" "}
              <a href="/start" className="text-[#C5A059] hover:text-[#E5C170] transition-colors">
                ابدأ رحلتك
              </a>
            </p>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <a
            href="/"
            className="text-white/40 hover:text-white text-sm transition-colors inline-flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة للرئيسية
          </a>
        </div>
      </motion.div>
    </div>
  );
}
