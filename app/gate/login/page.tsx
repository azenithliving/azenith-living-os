"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, AlertCircle, Shield, QrCode } from "lucide-react";

const ADMIN_EMAIL = "azenithliving@gmail.com";
const ADMIN_PASSWORD = "alaa92aziz";

export default function GateLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"login" | "2fa">("login");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Check credentials
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    // Setup 2FA
    try {
      const response = await fetch("/api/gate/2fa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "فشل إعداد 2FA");
        setLoading(false);
        return;
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("2fa");
      setLoading(false);
    } catch {
      setError("حدث خطأ أثناء إعداد 2FA");
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/gate/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, token, secret }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "رمز 2FA غير صحيح");
        setLoading(false);
        return;
      }

      // Set admin_auth cookie
      document.cookie = "admin_auth=true; path=/; max-age=86400; SameSite=Lax";

      // Redirect to admin
      router.push("/admin");
      router.refresh();
    } catch {
      setError("حدث خطأ أثناء التحقق");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-[#C5A059]">AZENITH</h1>
          <p className="mt-2 text-sm text-white/50">بوابة الدخول</p>
        </div>

        {/* Login Card */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <form onSubmit={step === "login" ? handleLogin : (e) => e.preventDefault()} className="space-y-4">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#C5A059]/10">
                <Shield className="h-8 w-8 text-[#C5A059]" />
              </div>
              <h2 className="text-xl font-semibold text-white">تسجيل الدخول</h2>
              <p className="mt-2 text-sm text-white/50">
                أدخل بياناتك للوصول إلى لوحة التحكم
              </p>
            </div>

            {step === "login" ? (
              <>
                {/* Email Input */}
                <div>
                  <label className="mb-2 block text-sm text-white/70">البريد الإلكتروني</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 pr-4 pl-12 text-white outline-none transition focus:border-[#C5A059]"
                      placeholder="azenithliving@gmail.com"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="mb-2 block text-sm text-white/70">كلمة المرور</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 pr-4 pl-12 text-white outline-none transition focus:border-[#C5A059]"
                      placeholder="••••••••"
                      required
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

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading || !email || !password}
                  className="w-full rounded-full bg-[#C5A059] px-6 py-4 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#d8b56d] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      جاري الدخول...
                    </span>
                  ) : (
                    "التالي"
                  )}
                </button>
              </>
            ) : (
              <>
                {/* 2FA QR Code */}
                <div className="text-center mb-4">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#C5A059]/10">
                    <QrCode className="h-8 w-8 text-[#C5A059]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">التحقق بخطوتين</h3>
                  <p className="mt-2 text-sm text-white/50">
                    امسح رمز QR باستخدام Google Authenticator
                  </p>
                </div>

                {qrCode && (
                  <div className="flex justify-center mb-4">
                    <img src={qrCode} alt="2FA QR Code" className="rounded-xl" />
                  </div>
                )}

                {/* 2FA Token Input */}
                <div>
                  <label className="mb-2 block text-sm text-white/70">رمز التحقق</label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 px-4 text-white text-center text-2xl tracking-[0.5em] outline-none transition focus:border-[#C5A059]"
                    placeholder="000000"
                    maxLength={6}
                    required
                    autoFocus
                  />
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
                  type="button"
                  onClick={handleVerify2FA}
                  disabled={loading || token.length !== 6}
                  className="w-full rounded-full bg-[#C5A059] px-6 py-4 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#d8b56d] disabled:cursor-not-allowed disabled:opacity-50"
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
                    "دخول"
                  )}
                </button>

                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => setStep("login")}
                  className="w-full text-sm text-white/50 hover:text-white transition"
                >
                  رجوع
                </button>
              </>
            )}
          </form>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-white/30">
          منطقة محمية - يتطلب مصادقة صارمة
        </p>
      </div>
    </div>
  );
}
