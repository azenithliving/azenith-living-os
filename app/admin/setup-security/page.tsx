"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Shield, QrCode, Key, CheckCircle, AlertCircle, Copy, Download } from "lucide-react";

export default function SetupSecurity() {
  const router = useRouter();
  const [step, setStep] = useState<"checking" | "2fa-setup" | "2fa-verify" | "digital-key" | "complete" | "">("checking");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [publicKey, setPublicKey] = useState("");

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const res = await fetch("/api/admin/2fa/status");
      const data = await res.json();

      if (data.enabled && data.hasPublicKey) {
        // كل شيء مفعل
        router.push("/admin-gate");
      } else if (data.enabled && !data.hasPublicKey) {
        // 2FA مفعل لكن المفتاح الرقمي غير موجود
        setStep("digital-key");
      } else {
        // بدء إعداد 2FA
        setStep("2fa-setup");
      }
    } catch (err) {
      setError("Failed to check security status");
      setStep("2fa-setup");
    }
  };

  const setup2FA = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/2fa/setup", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to setup 2FA");
        setLoading(false);
        return;
      }

      setQrCode(data.qrCode);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
      setStep("2fa-verify");
    } catch (err) {
      setError("Failed to setup 2FA");
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid code");
        setLoading(false);
        return;
      }

      if (data.enabled) {
        setStep("digital-key");
      }
    } catch (err) {
      setError("Failed to verify 2FA");
    } finally {
      setLoading(false);
    }
  };

  const generateDigitalKey = async () => {
    setLoading(true);
    setError("");

    try {
      // استيراد دوال التشفير ديناميكياً
      const { setupDigitalSignature } = await import("@/lib/sign-command-client");
      const result = await setupDigitalSignature();

      if (!result.success) {
        setError(result.error || "Failed to setup digital signature");
        setLoading(false);
        return;
      }

      setPublicKey(result.publicKey || "");
      setStep("complete");
    } catch (err) {
      setError("Your browser does not support Web Crypto API");
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `AZENITH SOVEREIGN - 2FA BACKUP CODES
Generated: ${new Date().toISOString()}

IMPORTANT: Keep these codes safe! They can be used to disable 2FA if you lose access to your authenticator app.

${backupCodes.join("\n")}

Store these codes in a secure location (password manager or physical safe).
`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "azenith-2fa-backup-codes.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderStep = () => {
    switch (step) {
      case "checking":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent"></div>
            <p className="mt-4 text-white/60">Checking security status...</p>
          </div>
        );

      case "2fa-setup":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-primary/10">
                <Shield className="h-8 w-8 text-brand-primary" />
              </div>
              <h2 className="text-xl font-semibold text-white">Setup Two-Factor Authentication</h2>
              <p className="mt-2 text-sm text-white/50">
                2FA is mandatory for admin access. This adds an extra layer of security to your account.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-200">
                <strong>Important:</strong> You will need an authenticator app like Google Authenticator, 
                Authy, or Microsoft Authenticator on your smartphone.
              </p>
            </div>

            <button
              onClick={setup2FA}
              disabled={loading}
              className="w-full rounded-full bg-brand-primary px-6 py-4 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
            >
              {loading ? "Setting up..." : "Start 2FA Setup"}
            </button>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        );

      case "2fa-verify":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                <QrCode className="h-8 w-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Scan QR Code</h2>
              <p className="mt-2 text-sm text-white/50">
                Scan this code with your authenticator app, then enter the 6-digit code below.
              </p>
            </div>

            {/* QR Code */}
            {qrCode && (
              <div className="mx-auto w-fit rounded-xl bg-white p-4">
                <img src={qrCode} alt="2FA QR Code" className="h-48 w-48" />
              </div>
            )}

            {/* Manual Entry */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/50">Can&apos;t scan? Enter this code manually:</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-[#111112] px-3 py-2 text-sm text-white/80">
                  {secret}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(secret)}
                  className="rounded bg-white/10 p-2 text-white/60 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Verification Input */}
            <div>
              <label className="mb-2 block text-sm text-white/70">Enter 6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-2xl border border-white/10 bg-[#111112] py-3 px-4 text-center text-2xl tracking-[0.5em] text-white outline-none transition focus:border-emerald-400"
                placeholder="000000"
              />
            </div>

            <button
              onClick={verify2FA}
              disabled={loading || verificationCode.length !== 6}
              className="w-full rounded-full bg-emerald-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>

            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="mb-2 text-sm text-white/70">Backup Codes (Save these!)</p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <code key={i} className="rounded bg-[#111112] px-2 py-1 text-center text-xs text-white/80">
                      {code}
                    </code>
                  ))}
                </div>
                <button
                  onClick={downloadBackupCodes}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary/20 py-2 text-sm text-brand-primary transition hover:bg-brand-primary/30"
                >
                  <Download className="h-4 w-4" />
                  Download Backup Codes
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        );

      case "digital-key":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
                <Key className="h-8 w-8 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Generate Digital Signature Key</h2>
              <p className="mt-2 text-sm text-white/50">
                This key will be used to sign all admin commands. It never leaves your browser.
              </p>
            </div>

            <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4">
              <p className="text-sm text-blue-200">
                <strong>How it works:</strong>
              </p>
              <ul className="list-inside list-disc space-y-1 text-sm text-blue-200">
                <li>A unique key pair is generated in your browser</li>
                <li>The public key is stored on the server for verification</li>
                <li>The private key is encrypted and stored locally</li>
                <li>All admin commands must be digitally signed</li>
              </ul>
            </div>

            <button
              onClick={generateDigitalKey}
              disabled={loading}
              className="w-full rounded-full bg-blue-500 px-6 py-4 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-50"
            >
              {loading ? "Generating..." : "Generate Digital Key"}
            </button>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        );

      case "complete":
        return (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-10 w-10 text-emerald-400" />
            </div>

            <h2 className="text-2xl font-semibold text-white">Security Setup Complete!</h2>

            <p className="text-white/60">
              Your admin account is now secured with:
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Shield className="h-5 w-5" />
                <span>Two-Factor Authentication (2FA)</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-emerald-400">
                <Key className="h-5 w-5" />
                <span>Digital Signatures</span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-sm text-emerald-200">
                You can now access the Sovereign Command Center. All your actions will be logged 
                and digitally signed for maximum security.
              </p>
            </div>

            <button
              onClick={() => router.push("/admin-gate")}
              className="w-full rounded-full bg-brand-primary px-6 py-4 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]"
            >
              Enter Command Center
            </button>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] px-6 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-brand-primary">AZENITH SOVEREIGN</h1>
          <p className="mt-2 text-sm text-white/50">Security Setup</p>
        </div>

        {/* Setup Card */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          {renderStep()}
        </div>

        {/* Progress Indicator */}
        {step !== "checking" && step !== "complete" && (
          <div className="mt-6 flex justify-center gap-2">
            <div className={`h-2 w-2 rounded-full ${step === "2fa-setup" || step === "2fa-verify" ? "bg-brand-primary" : "bg-white/20"}`}></div>
            <div className={`h-2 w-2 rounded-full ${step === "digital-key" ? "bg-brand-primary" : "bg-white/20"}`}></div>
            <div className="h-2 w-2 rounded-full bg-white/20"></div>
          </div>
        )}
      </div>
    </div>
  );
}
