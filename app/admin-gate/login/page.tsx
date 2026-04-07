"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Mail, Lock, AlertCircle, Shield } from "lucide-react";

export default function AdminGateLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    // Standard redirect - middleware will handle auth check
    router.push("/admin-gate");
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
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
              <Shield className="h-8 w-8 text-brand-primary" />
            </div>
            <h2 className="text-xl font-semibold text-white">Admin Login</h2>
            <p className="mt-2 text-sm text-white/50">
              Sign in with your admin credentials
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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

          {/* Help Text */}
          <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-white/40">
              <strong className="text-white/60">Default Admin:</strong><br />
              Email: azenithliving@gmail.com<br />
              Password: 3laa92aziz
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-white/30">
          Secured with Supabase Auth and AES-256 encryption
        </p>
      </div>
    </div>
  );
}
