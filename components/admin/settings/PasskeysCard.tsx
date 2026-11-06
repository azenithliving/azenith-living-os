"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * مفاتيح الدخول — the keys that open the dashboard without a typed code.
 *
 * The owner's word 2026-11-06 chose this over the phone app. A key is minted on his own device and
 * never leaves it: the store keeps only what the device signs, and the password stays as the way out
 * if a device is ever lost. The list is read from the record, so a number here is measured, never a
 * promise — and when the record cannot be read the card says so instead of showing an empty shelf.
 */
interface KeyRow {
  label: string;
  enrolledAt: string;
  multiDevice: boolean;
  backedUp: boolean;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = Uint8Array.from(new Uint8Array(buffer));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** The browser hands back ArrayBuffers; the door expects the base64url form it can verify. */
function encodeResponse(credential: PublicKeyCredential) {
  const json = credential.toJSON() as unknown as {
    id: string;
    rawId: string;
    type: string;
    response: Record<string, ArrayBuffer>;
  };
  const response: Record<string, string> = {};
  for (const [field, value] of Object.entries(json.response)) {
    response[field] = value instanceof ArrayBuffer ? toBase64Url(value) : String(value);
  }
  return { id: json.id, rawId: json.rawId, type: json.type, response };
}

export default function PasskeysCard() {
  const [keys, setKeys] = useState<KeyRow[] | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/admin/passkeys/list", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.measured === false) throw new Error(j?.error || "مفاتيح الدخول ما قريتش");
      setKeys((j.keys ?? []) as KeyRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "مفاتيح الدخول ما قريتش");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enroll = async () => {
    if (!label.trim() || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const optionsRes = await fetch("/api/admin/passkeys/options", { cache: "no-store" });
      const options = await optionsRes.json().catch(() => ({}));
      if (!optionsRes.ok || !options.challenge) throw new Error(options.error || "ما قدرناش نطلب التحدي من المتجر");

      const credential = await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: new Uint8Array(atob(options.challenge.replace(/-/g, "+").replace(/_/g, "/"))
            .split("")
            .map((c) => c.charCodeAt(0))),
          user: { ...options.user, id: new Uint8Array(atob(options.user.id.replace(/-/g, "+").replace(/_/g, "/"))
            .split("")
            .map((c) => c.charCodeAt(0))) },
          excludeCredentials: (options.excludeCredentials ?? []).map((entry: { id: string }) => ({ ...entry, type: "public-key" })),
          timeouts: options.timeout ? [options.timeout] : undefined,
        } as PublicKeyCredentialCreationOptions,
      });
      if (!(credential instanceof PublicKeyCredential)) throw new Error("الجهاز ما ردّش على التحدي");

      const savedRes = await fetch("/api/admin/passkeys/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), response: encodeResponse(credential) }),
      });
      const saved = await savedRes.json().catch(() => ({}));
      if (!savedRes.ok || saved?.saved !== true) throw new Error(saved.message || "المفتاح ما اتسجلش");

      setNotice(saved.message);
      setLabel("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "المفتاح ما اتسجلش");
    } finally {
      setBusy(false);
    }
  };

  const supported = typeof navigator !== "undefined" && "credentials" in navigator && "PublicKeyCredential" in window;

  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white">مفاتيح الدخول</h2>
          <p className="mt-1 text-xs text-white/70">
            بديل الكود اللي على التليفون: بصمتك أو وشك يفتحون اللوحة. كلمة السر لسه شغّالة كمخرج لو
            الجهاز اتغيّر.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/70">
          {keys === null ? (error ? "حصل خطأ" : "برضه يستنى…") : `${keys.length} مفتاح`}
        </span>
      </div>

      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
      {notice ? <p className="mt-3 text-xs text-emerald-200">{notice}</p> : null}

      <div className="mt-5 space-y-3">
        {keys?.length === 0 ? (
          <p className="text-sm text-white/70">مفيش مفتاح مسجّل لسه — سجّل واحد من جهازك اللي هتفتح منه.</p>
        ) : null}

        {keys?.map((row) => (
          <div key={row.enrolledAt + row.label} className="rounded-2xl border border-white/10 p-4">
            <p className="text-sm font-semibold text-white">{row.label}</p>
            <p className="mt-1 text-[11px] text-white/70">
              اتسجل يوم{" "}
              {new Date(row.enrolledAt).toLocaleDateString("ar-EG", {
                year: "numeric",
                month: "long",
                day: "numeric",
                timeZone: "Africa/Cairo",
              })}
              {" · "}
              {row.multiDevice ? "مفتاح متخزن في أكتر من جهاز" : "مفتاح في الجهاز ده بس"}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="اسم المفتاح — مثلاً: تليفوني"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/70 focus:border-[#C5A059] focus:outline-none"
          disabled={busy || !supported}
        />
        <button
          onClick={enroll}
          disabled={busy || !label.trim() || !supported}
          className="w-fit rounded-xl bg-[#C5A059] px-5 py-2 text-sm font-semibold text-black transition hover:bg-[#d7b26a] disabled:opacity-50"
        >
          {busy ? "برضه يستنى…" : "سجّل مفتاح من الجهاز ده"}
        </button>
        {!supported ? (
          <p className="text-[11px] text-amber-200">المتصفح ده ما بيعرفش مفاتيح دخول — جرّب متصفح الجهاز اللي هتفتح منه.</p>
        ) : null}
      </div>
    </section>
  );
}
