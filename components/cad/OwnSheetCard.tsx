"use client";

import { useRef, useState } from "react";
import { Check, LoaderCircle, PenLine } from "lucide-react";
import { arDigits } from "@/lib/ops/metricLabels";

/**
 * The customer's own door to his sheet.
 *
 * Until 2026-10-07 the store's private sheet address could only be minted by the owner's desk, so
 * a customer could never start the journey himself. This card files his paper photograph and hands
 * him the address — nothing is claimed about reading it: he types his own numbers on the sheet, and
 * that is the witness that always answers.
 */
export function OwnSheetCard({ phone, isRTL }: { phone: string; isRTL: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [number, setNumber] = useState(phone || "");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(isRTL ? "اختار صورة الورقة الأول" : "Choose the paper photo first");
      return;
    }
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read-failed"));
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl, phone: number }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError(data?.error || (isRTL ? "الورقة ما اتسجلتش — جرب تاني" : "The paper was not saved"));
      } else {
        setLink(`${window.location.origin}${data.passport_path}`);
      }
    } catch {
      setError(isRTL ? "الورقة ما اتسجلتش — جرب تاني" : "The paper was not saved");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-own-sheet-card="" className="rounded-3xl border border-[#C5A059]/30 bg-[#C5A059]/[0.04] p-6">
      <div className="flex items-center gap-3">
        <PenLine className="h-5 w-5 text-[#C5A059]" />
        <h3 className="text-base font-semibold text-white">
          {isRTL ? "ورقة مقاساتك على النت" : "Your measurement sheet online"}
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/60">
        {isRTL
          ? "صوّر الرسمة اللي عندك، وهيوصلك رابطك الخاص تكتب فيه مقاساتك ويشاركه أهلك يصوّتوا."
          : "Photograph your sketch and we will send you a private link to write your measurements on."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* His own number, in this card: the door below belongs to the customer, not to the form above it. */}
        <input
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          inputMode="tel"
          placeholder={isRTL ? "رقم موبايلك" : "Your mobile number"}
          data-own-sheet-phone=""
          className="w-44 rounded-full border border-white/15 bg-[#111112] px-4 py-2.5 text-sm text-white outline-none focus:border-[#C5A059]"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          data-own-sheet-file=""
          className="text-sm text-white/60 file:me-3 file:rounded-full file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-white"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy}
          data-own-sheet-send=""
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#C5A059] px-6 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#d8b56d] disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {isRTL ? "ابعت الورقة" : "Send the paper"}
        </button>
      </div>

      {error && (
        <p data-own-sheet-error="" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {link && (
        <div data-own-sheet-link="" className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Check className="h-4 w-4" />
            {isRTL ? "ورقتك جاهزة على العنوان ده" : "Your sheet is ready at this address"}
          </p>
          <a href={link} dir="ltr" className="mt-2 block break-all text-sm text-sky-300 underline">
            {link}
          </a>
          <p className="mt-2 text-xs text-white/45">
            {isRTL
              ? `حجم الصورة المحفوظة: ${arDigits(Math.round((fileRef.current?.files?.[0]?.size ?? 0) / 1024))} كيلوبايت`
              : `Stored image: ${arDigits(Math.round((fileRef.current?.files?.[0]?.size ?? 0) / 1024))} KB`}
          </p>
        </div>
      )}
    </div>
  );
}
