"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Verify2FAPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code, isLoginVerification: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "رمز غير صحيح");
        setLoading(false);
        return;
      }

      // Save verification status
      await fetch("/api/admin/2fa/set-verified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verified: true }),
      });

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
        <h1 style={{ color: "white", textAlign: "center", marginBottom: "20px" }}>
          التحقق بخطوتين
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="أدخل الرمز (6 أرقام)"
            required
            autoFocus
            style={{
              padding: "15px",
              fontSize: "18px",
              textAlign: "center",
              borderRadius: "8px",
              border: "1px solid #333",
              background: "#111",
              color: "white",
            }}
          />

          {error && (
            <div style={{ color: "#ff4444", textAlign: "center", fontSize: "14px" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
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
            {loading ? "جاري التحقق..." : "تحقق"}
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
