"use client";

/**
 * The ruler panel — the owner's answer to «وصلت فين؟» on one screen.
 *
 * Every number is read from the door, and the door reads the ledgers; the panel invents nothing. A
 * source that did not answer is printed as «ما اتقارش» with its name, because a quiet zero on this
 * screen is exactly what made the project feel like a loop.
 */
import { useEffect, useState } from "react";

type PhaseRow = { label: string; atoms: string; moved: string; current: boolean; note: string | null };

type View = {
  line: string;
  phases: PhaseRow[];
  deadLine: string;
  refusalLine: string;
  missing: string[];
  asOf: string | null;
  gateWhen: string | null;
};

export default function RulerPanel() {
  const [view, setView] = useState<View | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/ruler")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok || !data?.success) {
          setRefusal(
            typeof data?.error === "string" && data.error
              ? data.error
              : `الباب ردّ برفض (${res.status}) — العدد ما اتقارش`,
          );
          return;
        }
        setView(data as View);
      })
      .catch((error: unknown) => {
        if (alive) setRefusal(`الباب ما ردّش: ${String(error).slice(0, 60)}`);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (refusal) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-xs text-red-300">
        {refusal}
      </p>
    );
  }
  if (!view) {
    return <p className="text-xs text-white/40">المِسطرة بتتقرا...</p>;
  }

  return (
    <div className="space-y-5">
      <p className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-4 text-sm leading-8 font-bold text-amber-200">
        {view.line}
      </p>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-xs font-black text-white">المراحل الاثنتاشر</h2>
          <p className="mt-1 text-[11px] leading-6 text-white/45">
            العدد من سجل النقل، والمشروع بيتبنى منهم اتناشر مرحلة — مفيش وكيل بيكتب خطة تانية
          </p>
        </div>
        <ol className="divide-y divide-white/[0.05]">
          {view.phases.map((phase) => (
            <li key={phase.label} className="px-4 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-xs font-bold ${phase.current ? "text-amber-300" : "text-white/80"}`}>
                  {phase.label}
                  {phase.current ? " — المرحلة الحالية" : ""}
                </p>
                {phase.note ? <p className="mt-1 text-[11px] leading-6 text-white/40">{phase.note}</p> : null}
              </div>
              <div className="shrink-0 text-left">
                <p className="text-[11px] text-white/50">{phase.atoms} ذرة</p>
                <p className="mt-0.5 text-[11px] text-emerald-300/80">{phase.moved} اتنقلت</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <h2 className="text-xs font-black text-white">خريطة الميت</h2>
        <p className="mt-2 text-[11px] leading-6 text-white/70">{view.deadLine}</p>
        <p className="mt-2 text-[11px] leading-6 text-white/40">
          ولا حاجة اتمسحت: التصنيف قرار، والمسح كلمة المالك لوحده
        </p>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
        <h2 className="text-xs font-black text-white">الرفض الصامت</h2>
        <p className="mt-2 text-[11px] leading-6 text-white/70">{view.refusalLine}</p>
        <p className="mt-2 text-[11px] leading-6 text-white/40">
          الاستعلام المرفوض بيرجّع فاضي من غير صوت — وده بيبان كصفر طمّان. العدد ده من مقارنة أسماء
          الكود بردّ المخزن نفسه
        </p>
      </div>

      {view.missing.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
          <h2 className="text-xs font-black text-white">ما اتقارش</h2>
          <p className="mt-2 text-[11px] leading-6 text-white/70">{view.missing.join("، ")}</p>
        </div>
      ) : null}

      <p className="text-[11px] leading-6 text-white/35">
        {view.asOf ? `الجرد من ${view.asOf}` : "تاريخ الجرد ما اتقارش"}
        {view.gateWhen ? ` · آخر بوابات اتقاست ${view.gateWhen}` : " · نتيجة البوابات ما اتقارش"}
      </p>
    </div>
  );
}
