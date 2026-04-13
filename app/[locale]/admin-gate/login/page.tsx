"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Mail, Lock, AlertCircle, Shield, Key, Smartphone } from "lucide-react";

type LoginStep = "credentials" | "2fa" | "setup-2fa";

export default function AdminGateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [requires2FA, setRequires2FA] = useState(false);
  const [sessionToken, setSessionToken] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message === "Invalid login credentials" 
        ? "Invalid email or password" 
        : authError.message);
      setLoading(false);
      return;
    }

    // التحقق من حالة 2FA للمستخدم
    try {
      const statusRes = await fetch("/api/admin/2fa/status");
      const statusData = await statusRes.json();

      if (statusRes.ok && statusData.enabled) {
        // 2FA مفعل - الانتقال لخطوة التحقق
        setRequires2FA(true);
        setStep("2fa");
        setLoading(false);
        return;
      }

      if (statusRes.ok && !statusData.enabled) {
        // المستخدم مسجل دخول لكن بدون 2FA - يجب الإعداد
        setStep("setup-2fa");
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("2FA check error:", err);
    }

    // لا يوجد 2FA مطلوب - الدخول المباشر
    router.push("/admin-gate");
    router.refresh();
  };

  const handle2FAVerification = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setError(data.error || "Invalid 2FA code");
        setLoading(false);
        return;
      }

      // حفظ رمز الجلسة المُعززة
      if (data.sessionToken) {
        localStorage.setItem("sovereign_session_token", data.sessionToken);
      }

      // الدخول الناجح
      router.push("/admin-gate");
      router.refresh();

    } catch (err) {
      setError("Failed to verify 2FA");
      setLoading(false);
    }
  };

  const handleSetup2FA = () => {
    // توجيه المستخدم لصفحة إعداد 2FA
    router.push("/admin-gate/setup-security");
  };

  // Render step-specific content
  const renderStep = () => {
    switch (step) {
      case "credentials":
        return (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
                <Shield className="h-8 w-8 text-brand-primary" />
              </div>
              <h2 className="text-xl font-semibold text-white">Admin Login</h2>
              <p className="mt-2 text-sm text-white/50">
                Sign in with your admin credentials
              </p>
            </div>

            {/* Email Input */}
            <div>
              <label className="mb-2 block text-sm text-white/70">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 pr-4 pl-12 text-white outline-none transition focus:border-brand-primary"
                  placeholder="admin@azenithliving.com"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="mb-2 block text-sm text-white/70">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 pr-4 pl-12 text-white outline-none transition focus:border-brand-primary"
                  placeholder="Enter your password"
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
              className="w-full rounded-full bg-brand-primary px-6 py-4 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        );

      case "2fa":
        return (
          <form onSubmit={handle2FAVerification} className="space-y-4">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <Smartphone className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Two-Factor Authentication</h2>
              <p className="mt-2 text-sm text-white/50">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {/* 2FA Code Input */}
            <div>
              <label className="mb-2 block text-sm text-white/70">Authentication Code</label>
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
                  Verifying...
                </span>
              ) : (
                "Verify & Continue"
              )}
            </button>

            {/* Back Button */}
            <button
              type="button"
              onClick={() => setStep("credentials")}
              className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white/70 transition hover:bg-white/10"
            >
              Back to Login
            </button>
          </form>
        );

      case "setup-2fa":
        return (
          <div className="space-y-4 text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                <Shield className="h-8 w-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Security Setup Required</h2>
              <p className="mt-2 text-sm text-white/50">
                Your account requires 2FA setup before accessing the admin panel
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-200">
                Two-factor authentication (2FA) is mandatory for all admin accounts.
                Please complete the setup to continue.
              </p>
            </div>

            <button
              onClick={handleSetup2FA}
              className="w-full rounded-full bg-brand-primary px-6 py-4 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]"
            >
              Setup 2FA Now
            </button>

            <button
              onClick={() => setStep("credentials")}
              className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white/70 transition hover:bg-white/10"
            >
              Back to Login
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-brand-primary">AZENITH SOVEREIGN</h1>
          <p className="mt-2 text-sm text-white/50">Master Admin Portal</p>
        </div>

        {/* Login Card */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          {renderStep()}
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-white/30">
          Secured with 2FA, Digital Signatures & Immutable Audit Logs
        </p>
      </div>
    </div>
  );
}
