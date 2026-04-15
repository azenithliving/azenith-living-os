"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Verify2FAPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Use the new combined API that handles login + 2FA verification
      const res = await fetch("/api/admin/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: code,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "رمز غير صحيح");
        setLoading(false);
        return;
      }

      // Save session token if provided
      if (data.sessionToken) {
        localStorage.setItem("sovereign_session_token", data.sessionToken);
      }

      // Go to admin dashboard
      router.push("/admin");
    } catch (err) {
      setError("حدث خطأ");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "400px", padding: "20px" }}>
        <h1 style={{ color: "white", textAlign: "center", marginBottom: "10px" }}>
          تسجيل الدخول
        </h1>
        <p style={{ color: "#888", textAlign: "center", marginBottom: "20px", fontSize: "14px" }}>
          أدخل بياناتك والرمز للتحقق بخطوتين
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {/* Email Input */}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            required
            autoFocus
            style={{
              padding: "15px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#111",
              color: "white",
            }}
          />

          {/* Password Input */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
            required
            style={{
              padding: "15px",
              fontSize: "16px",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#111",
              color: "white",
            }}
          />

          {/* 2FA Code Input */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="رمز التحقق (6 أرقام)"
            required
            style={{
              padding: "15px",
              fontSize: "18px",
              textAlign: "center",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#111",
              color: "white",
              letterSpacing: "0.5em",
            }}
          />

          {error && (
            <div style={{ color: "#ff4444", textAlign: "center", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6 || !email || !password}
            style={{
              padding: "15px",
              fontSize: "16px",
              background: loading ? "#666" : "#10b981",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "جاري التحقق..." : "تسجيل الدخول"}
          </button>
        </form>

        <button
          onClick={() => router.push("/admin-gate/login")}
          style={{
            marginTop: "15px",
            padding: "10px",
            width: "100%",
            background: "transparent",
            color: "#888",
            border: "1px solid #333",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          العودة لتسجيل الدخول
        </button>
      </div>
    </div>
  );
}
