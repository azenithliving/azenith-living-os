"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Key, AlertCircle, Smartphone, Shield } from "lucide-react";

export default function Verify2FAPage() {
  console.log("[Verify2FA] Component rendering");

  const router = useRouter();
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Verify2FA] Form submitted with code:", twoFactorCode);
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: twoFactorCode,
          isLoginVerification: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "رمز التحقق غير صحيح");
        setLoading(false);
        return;
      }

      // حفظ حالة التحقق في cookie عبر API
      await fetch("/api/admin/2fa/set-verified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      });

      // الدخول الناجح - التوجيه للداشبورد
      router.push("/admin");
      router.refresh();

    } catch (err) {
      setError("فشل في التحقق من الرمز");
      setLoading(false);
    }
  };

  console.log("[Verify2FA] Rendering form, twoFactorCode:", twoFactorCode);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-[#C5A059]">AZENITH</h1>
          <p className="mt-2 text-sm text-white/50">لوحة التحكم</p>
        </div>

        {/* 2FA Card */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <form onSubmit={handle2FAVerification} className="space-y-4">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <Smartphone className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">التحقق بخطوتين</h2>
              <p className="mt-2 text-sm text-white/50">
                أدخل الرمز المكون من 6 أرقام من تطبيق المصادقة
              </p>
            </div>

            {/* 2FA Code Input */}
            <div>
              <label className="mb-2 block text-sm text-white/70">رمز التحقق</label>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 pr-4 pl-12 text-center text-2xl tracking-[0.5em] text-white outline-none transition focus:border-emerald-400"
                  placeholder="000000"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || twoFactorCode.length !== 6}
              className="w-full rounded-full bg-emerald-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  جاري التحقق...
                </span>
              ) : (
                "تحقق واستمر"
              )}
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => router.push("/admin-gate/login")}
              className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white/70 transition hover:bg-white/10"
            >
              العودة لتسجيل الدخول
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-white/30 flex items-center justify-center gap-2">
          <Shield className="h-3 w-3" />
          محمي بالمصادقة الثنائية وتسجيلات التدقيق غير القابلة للتعديل
        </p>
      </div>
    </div>
  );
}
