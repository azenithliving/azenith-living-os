"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, AlertCircle, Shield } from "lucide-react";

const ADMIN_PASSWORD = "azenith2024";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Check password
    if (password !== ADMIN_PASSWORD) {
      setError("كلمة المرور غير صحيحة");
      setLoading(false);
      return;
    }

    // Set admin_auth cookie
    document.cookie = "admin_auth=true; path=/; max-age=86400; SameSite=Lax";

    // Redirect to admin
    router.push("/admin");
    router.refresh();
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
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
                <Shield className="h-8 w-8 text-brand-primary" />
              </div>
              <h2 className="text-xl font-semibold text-white">تسجيل الدخول</h2>
              <p className="mt-2 text-sm text-white/50">
                أدخل كلمة المرور للوصول إلى لوحة التحكم
              </p>
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
                  className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 pr-4 pl-12 text-white outline-none transition focus:border-brand-primary"
                  placeholder="أدخل كلمة المرور"
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

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-full bg-brand-primary px-6 py-4 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:cursor-not-allowed disabled:opacity-50"
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
                "تسجيل الدخول"
              )}
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-white/30">
          Secured with Digital Signatures & Immutable Audit Logs
        </p>
      </div>
    </div>
  );
}
