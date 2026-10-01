'use client';

import { useCallback, useMemo, useState } from 'react';

import { matchRoll, rollLineLabel } from '@/lib/customers/match';
import { arDigits } from '@/lib/ops/metricLabels';
import { parseSketchLink, UNLINKED_LABEL } from '@/lib/cad/sketch-link';

export type RollLine = { key: string; name: string | null; phone: string | null; email?: string | null };

type Props = {
  sketchId: number;
  /** What the reading carries today: the roll's key, or null for «no owner on it yet». */
  customerKey: string | null;
  /** The whole roll, read once by the page from the customers door. Null means it did not answer. */
  roll: RollLine[] | null;
  onLinked: (sketchId: number, customerKey: string | null) => void;
};

/**
 * «Whose paper is this?» on the desk — one press, then a search over the real roll.
 *
 * The list of names comes from the same door the customers screen reads, and the value
 * that gets stored is that door's key, so this control cannot grow a second list of people
 * that disagrees with the first. When a number is on the paper but not in the roll — the
 * customer typed it himself on his sheet — that is said out loud instead of being shown as
 * a blank or a guess.
 */
export default function SketchOwner({ sketchId, customerKey, roll, onLinked }: Props) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const link = parseSketchLink(customerKey);
  const line = useMemo(() => (roll && link ? roll.find((row) => row.key === link.key) ?? null : null), [roll, link]);
  const matches = useMemo(() => (roll ? matchRoll(roll, query) : []), [query, roll]);

  const write = useCallback(
    async (key: string | null) => {
      setBusy(true);
      setProblem(null);
      try {
        const res = await fetch('/api/admin/ops/sketch', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: sketchId, customer_key: key }),
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) throw new Error(data?.error || `الخادم ردّ بـ ${res.status}`);
        onLinked(sketchId, data.customer_key ?? key);
        setPicking(false);
        setQuery('');
      } catch (error) {
        setProblem(String((error as Error)?.message ?? error));
      } finally {
        setBusy(false);
      }
    },
    [onLinked, sketchId]
  );

  if (picking) {
    return (
      <div className="mt-2 rounded-xl border border-amber-500/25 bg-black/30 p-2.5" data-sketch-picker={sketchId}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اسم أو آخر رقم في الموبايل"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[12px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
        />
        {roll === null && <p className="mt-1.5 text-[10px] text-amber-300">الدفتر ما ردّش — مش معناه إن مفيش عملاء.</p>}
        {roll !== null && query.trim() && matches.length === 0 && (
          <p className="mt-1.5 text-[10px] text-white/45">مفيش حد في الدفتر بهالحرف. لو ده عميل جديد، سجله من باب العملاء الأول.</p>
        )}
        <ul className="mt-1.5 space-y-1">
          {matches.map(({ line: candidate, why }) => (
            <li key={candidate.key}>
              <button
                onClick={() => write(candidate.key)}
                disabled={busy}
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5 text-right text-[12px] text-white disabled:opacity-50"
              >
                <span className="truncate">{rollLineLabel(candidate)}</span>
                <span className="shrink-0 text-[9px] text-white/35">{why}</span>
              </button>
            </li>
          ))}
        </ul>
        {problem && <p className="mt-1 text-[10px] text-rose-300">{problem}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <button onClick={() => setPicking(false)} className="text-[10px] text-white/40">
            إلغاء
          </button>
          {customerKey && (
            <button onClick={() => write(null)} disabled={busy} className="text-[10px] text-rose-300/80">
              شيل الاسم
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
      {link ? (
        <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 font-bold text-emerald-300" data-sketch-owner={sketchId}>
          {line ? rollLineLabel(line) : link.kind === 'phone' ? `مش في الدفتر · ${arDigits(link.value)}` : link.value}
        </span>
      ) : (
        <span className="text-white/35" data-sketch-owner={sketchId}>
          {UNLINKED_LABEL}
        </span>
      )}
      <button
        onClick={() => setPicking(true)}
        className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60"
        data-sketch-link={sketchId}
      >
        {link ? 'غير' : 'مين صاحب الورقة؟'}
      </button>
    </div>
  );
}
