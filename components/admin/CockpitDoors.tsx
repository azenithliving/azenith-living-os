"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldAlert, Inbox } from "lucide-react";

import { arNum } from "@/lib/ops/metricLabels";

/**
 * The two doors the owner reaches for before anything else, kept in the sidebar so
 * they exist wherever he is in the house.
 *
 * The decision count is read from the same queue the chat's vault reads — one rule,
 * one number, no second counter that can disagree with the first. The stop button is
 * the store's existing safety door and keeps its two-press shape: one press arms it,
 * the second inside three seconds actually stops anything.
 */
export function CockpitDoors() {
  const [waiting, setWaiting] = useState<number | null>(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [news, setNews] = useState("");

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const res = await fetch("/api/admin/agents/approval-queue");
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.approvals)) setWaiting(data.approvals.length);
      } catch {
        // No answer is not zero. The badge stays silent rather than lying.
      }
    };
    read();
    const iv = setInterval(read, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  async function stop() {
    if (!armed) {
      setArmed(true);
      setNews("اضغط تاني مرة خلال ثلاث ثواني تقفل كل حاجة");
      setTimeout(() => {
        setArmed(false);
        setNews("");
      }, 3000);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/owner/emergency-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger", reason: "من كابينة القيادة" }),
      });
      const data = await res.json().catch(() => null);
      setNews(data?.success ? "الإيقاف الطارئ مفعل دلوقتي" : data?.error || "السيرفر ما ردّش");
    } catch {
      setNews("فشل الاتصال بخادم الأمان");
    } finally {
      setArmed(false);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Link
        href="/admin/v2/agents/ops?agent=ops-lead&decisions=1"
        className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-white/60 transition hover:border-[#C5A059]/40 hover:text-white"
      >
        <Inbox className="h-4 w-4 shrink-0 text-[#C5A059]" />
        <span className="text-xs leading-tight">قرارات مستنية كلمتك</span>
        {waiting !== null && waiting > 0 && (
          <span className="mr-auto shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {arNum(waiting)}
          </span>
        )}
      </Link>

      <button
        onClick={stop}
        disabled={busy}
        className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-right transition ${
          armed
            ? "border-rose-500/60 bg-rose-600 text-white animate-pulse"
            : "border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
        }`}
      >
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="text-xs leading-tight">
          {busy ? "بأقفي…" : armed ? "اضغط تاني للتأكيد" : "إيقاف فوري"}
        </span>
      </button>

      {news && <p className="text-[10px] leading-relaxed text-white/45">{news}</p>}
    </div>
  );
}
