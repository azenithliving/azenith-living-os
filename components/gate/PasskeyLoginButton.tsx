"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Fingerprint, Loader } from "lucide-react";

/**
 * الدخول ببصمة الجهاز — the dashboard opens with a key that never leaves the owner's device.
 *
 * The store keeps only what the device signs; nothing here carries a password, and the password door
 * stayed where it was as the way out if a device is ever lost (the owner's word 2026-11-06). Every
 * sentence below names the step that actually failed, because a bare «error» on this screen reads as
 * a broken phone.
 */
function bytesFromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The browser hands back ArrayBuffers; the door verifies the base64url form it stored. */
function encodeAssertion(credential: PublicKeyCredential) {
  const json = credential.toJSON() as unknown as {
    id: string;
    rawId: string;
    type: string;
    response: Record<string, ArrayBuffer | string | null>;
  };
  const inner: Record<string, string> = {};
  for (const [field, value] of Object.entries(json.response)) {
    if (value instanceof ArrayBuffer) inner[field] = toBase64Url(value);
    else if (typeof value === "string") inner[field] = value;
  }
  return { id: json.id, rawId: json.rawId, type: json.type, response: inner };
}

export default function PasskeyLoginButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const supported =
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential === "function" &&
    Boolean(navigator.credentials);

  const signIn = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNote("");
    try {
      const res = await fetch("/api/admin/passkeys/authenticate/options", { method: "POST" });
      const options = await res.json().catch(() => null);
      if (!res.ok || !options?.challenge) {
        throw new Error(options?.error || "التحدي ما اتعملش — المتجر ما ردّش");
      }

      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: bytesFromBase64Url(options.challenge),
          userVerification: options.userVerification ?? "required",
          timeout: 60000,
          allowCredentials: [],
        },
      })) as PublicKeyCredential | null;

      if (!credential) throw new Error("الجهاز ما ردّش — مفيش بصمة اتسجلت");

      const verify = await fetch("/api/admin/passkeys/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: encodeAssertion(credential) }),
      });
      const outcome = await verify.json().catch(() => ({}));

      if (!verify.ok || !outcome?.success) {
        throw new Error(outcome?.message || "البصمة ما فتحتش اللوحة — المتجر ما ردّش");
      }

      setNote(outcome.message);
      if (outcome.counterNote) setError(outcome.counterNote);
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "البصمة ما فتحتش اللوحة");
      setBusy(false);
    }
  };

  if (!supported) {
    return (
      <p className="text-sm text-white/50">
        المتصفح ده ما بيعرفش مفاتيح الدخول — استخدم كلمة السر، أو افتح الموقع من متصفح التليفون.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-[#C5A059] px-6 py-4 text-sm font-semibold text-[#1a1a1a] transition hover:bg-[#d8b56d] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader className="h-4 w-4 animate-spin" />
            جاري انتظار البصمة...
          </>
        ) : (
          <>
            <Fingerprint className="h-5 w-5" />
            الدخول ببصمة الجهاز
          </>
        )}
      </button>

      {note && <p className="text-center text-sm text-emerald-200">{note}</p>}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
