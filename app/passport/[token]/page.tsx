'use client';

import { useCallback, useEffect, useState } from 'react';

import { arNum } from '@/lib/ops/metricLabels';

type Dimension = { label: string; meters: number; confirmed?: boolean };
type Sheet = {
  room: string | null;
  dimensions: Dimension[];
  openings: { kind: string; widthMeters: number | null }[];
  area_sqm: number | string | null;
  confirmed_count: number;
  ok: boolean;
  failure: string | null;
  confirmed_at: string | null;
  sealed: boolean;
  unchanged: boolean;
  customer_dimensions: number[] | null;
};

const OPENING_LABEL: Record<string, string> = { door: 'باب', window: 'شباك' };

/**
 * The customer's own sheet: what the store read from his drawing, and the numbers he
 * says are right. No account and no password — the long address is the whole login,
 * and it opens one sheet and nothing else.
 *
 * The address is read from the live path rather than a search hook so the page stays
 * prerenderable; a token that is not shaped like a token is never sent to the server.
 */
export default function PassportPage() {
  const [token, setToken] = useState('');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [typed, setTyped] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [news, setNews] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/\/passport\/([A-Za-z0-9_-]{20,32})/);
    if (!match) {
      setProblem('العنوان ده مش عنوان ورقة');
      return;
    }
    setToken(match[1]);
    fetch(`/api/passport/${match[1]}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setSheet(data.sheet);
        else setProblem(data?.error || 'الورقة ما جاتش');
      })
      .catch(() => setProblem('المتجر ما ردّش'));
  }, []);

  const confirm = useCallback(async () => {
    if (!token || busy) return;
    const numbers = typed.map((v) => Number(v.replace(',', '.'))).filter((v) => Number.isFinite(v) && v > 0);
    if (numbers.length === 0) {
      setNews('اكتب مقاس واحد على الأقل بالأرقام');
      return;
    }
    setBusy(true);
    setNews(null);
    try {
      const res = await fetch(`/api/passport/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dimensions: numbers }),
      });
      const data = await res.json();
      if (data?.success && data.sheet) setSheet(data.sheet);
      setNews(data?.message || data?.error || 'المتجر ما ردّش');
    } catch {
      setNews('المتجر ما ردّش — جرّب تاني');
    } finally {
      setBusy(false);
    }
  }, [busy, token, typed]);

  const confirmed = Boolean(sheet?.confirmed_at);

  return (
    <main dir="rtl" className="min-h-screen bg-[#0d0f12] px-5 pb-16 pt-28 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-bold tracking-wide text-amber-400">أزينث ليفينج</p>
        <h1 className="mt-1 text-xl font-black">{sheet?.room || 'ورقة مقاساتك'}</h1>

        {problem && <p className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 text-[12px] text-rose-300">{problem}</p>}

        {sheet && (
          <>
            <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="text-[12px] font-bold text-white/60">اللي قريناه من رسمتك</h2>
              <ul className="mt-2 space-y-1.5">
                {sheet.dimensions.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="truncate text-white/70">{d.label}</span>
                    <span className="shrink-0 font-black">
                      {arNum(d.meters)} متر
                      {d.confirmed && <span className="mr-2 text-[10px] font-bold text-emerald-300">متطابق</span>}
                    </span>
                  </li>
                ))}
                {sheet.dimensions.length === 0 && (
                  <li className="text-[12px] text-white/45">مفيش رقم اتأكد بعد — عشان كده مقاساتك تحت مهمة.</li>
                )}
              </ul>
              {sheet.openings.length > 0 && (
                <p className="mt-3 text-[11px] text-white/50">
                  الفتحات: {sheet.openings.map((o) => `${OPENING_LABEL[o.kind] ?? o.kind}${o.widthMeters ? ` ${arNum(o.widthMeters)}م` : ''}`).join(' · ')}
                </p>
              )}
              {sheet.area_sqm ? (
                <p className="mt-3 text-[12px] text-white/60">المساحة الحسابية: {arNum(Number(sheet.area_sqm))} متر مربع</p>
              ) : null}
              {sheet.failure && <p className="mt-3 text-[11px] leading-relaxed text-amber-300/90">{sheet.failure}</p>}
            </section>

            {confirmed ? (
              <section className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                <h2 className="text-[13px] font-black text-emerald-300">دي ورقتك المعتمدة</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/70">
                  الأرقام اللي كتبتها: {Array.isArray(sheet.customer_dimensions) ? sheet.customer_dimensions.map((v) => arNum(Number(v))).join(' · ') : '—'}
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  {sheet.unchanged
                    ? 'مختومة ومفيش حاجة اتغيرت بعدها.'
                    : 'الأرقام على الورقة اتغيرت بعد اعتمادك — كلّمنا قبل أي تنفيذ.'}
                </p>
              </section>
            ) : (
              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <h2 className="text-[12px] font-bold text-white/60">أكّد مقاساتك: اكتبها بنفسك</h2>
                <p className="mt-1 text-[11px] leading-relaxed text-white/45">
                  اللي انت بتكتبه هو اللي بنشتغل بيه. لو رقمك طابق اللي قريناه، الورقة تتقفل وتاتبعتلك على طول.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {typed.map((value, i) => (
                    <input
                      key={i}
                      inputMode="decimal"
                      value={value}
                      onChange={(e) =>
                        setTyped((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder={`مقاس ${arNum(i + 1)}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
                    />
                  ))}
                </div>
                <button
                  onClick={confirm}
                  disabled={busy}
                  className="mt-3 w-full rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-2.5 text-[13px] font-black text-amber-200 disabled:opacity-50"
                >
                  {busy ? 'بأأكد…' : 'أكّد مقاساتي'}
                </button>
                {news && <p className="mt-2 text-[11px] leading-relaxed text-white/60">{news}</p>}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
