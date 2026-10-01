'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';

import { arNum } from '@/lib/ops/metricLabels';

type DeskRow = {
  id: string;
  label: string;
  good: string;
  keysUrl: string;
  steps: string;
  rows: number;
  active: number;
  alive: number;
  quota: number;
  refused: number;
  quarantined: number;
  unverified: number;
  lastCheck: string | null;
  verdict: string;
};

type Totals = { keys: number; alive: number; refused: number; quarantined: number; withLiveKey: number; needingKey: number };

/**
 * The key desk: every free model the store can run on, how many of his keys answer right
 * now, and the two steps that get him a key where the answer is none.
 *
 * The counts are the pool's, and «answers right now» is a provider that replied to a real
 * request — not a number remembered from a document. A press verifies a bounded batch (the
 * store's own ceiling on one call) so checking never becomes the thing that spends the
 * quota it is measuring.
 */
export default function V2KeysDeskPage() {
  const [rows, setRows] = useState<DeskRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [news, setNews] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/keys/desk', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || `الخادم ردّ بـ ${res.status}`);
      setRows(Array.isArray(data.providers) ? data.providers : []);
      setTotals(data.totals ?? null);
      setProblem(null);
    } catch (error) {
      // No list is not an empty list: the screen says the door did not answer.
      setProblem(String((error as Error)?.message ?? error));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const verify = useCallback(
    async (provider: string) => {
      setChecking(provider);
      setNews(null);
      try {
        const res = await fetch('/api/admin/keys/desk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, limit: 12 }),
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) throw new Error(data?.error || `الخادم ردّ بـ ${res.status}`);
        const states = data.states ?? {};
        setNews(
          `سألنا ${arNum(data.checked)} مفتاح: بيجاوب ${arNum(states.alive ?? 0)} · سقفه خلص ${arNum(states.quota ?? 0)} · مرفوض ${arNum(
            states.refused ?? 0
          )} · ما ردّش ${arNum(states.unreachable ?? 0)}`
        );
        if (Array.isArray(data.providers)) setRows(data.providers);
      } catch (error) {
        setNews(String((error as Error)?.message ?? error));
      } finally {
        setChecking(null);
      }
    },
    []
  );

  return (
    <div className="min-h-[70vh] p-4 pt-16 sm:p-6 sm:pt-8" dir="rtl">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-lg font-black text-white">
          <KeyRound className="h-5 w-5 text-amber-400" />
          مكتب المفاتيح
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          كل نموذج مجاني المتجر يقدر يشغل عليه، وعدد مفاتيحك اللي بيجاوب فعلًا دلوقتي. الأرقام من ردّ المزود نفسه، مش من ورقة.
        </p>
        {totals && (
          <p className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] text-white/60" data-key-totals>
            {arNum(totals.keys)} مفتاح عندنا · بيجاوب دلوقتي {arNum(totals.alive)} · مرفوض {arNum(totals.refused)}
            {totals.quarantined ? ` · معزول ${arNum(totals.quarantined)}` : ''}
            {` · ${arNum(totals.withLiveKey)} من ${arNum(rows?.length ?? 0)} مزودات ليها رد حي · ${arNum(totals.needingKey)} محتاج مفتاح`}
          </p>
        )}
        {problem && <p className="mt-2 text-[11px] text-rose-300">{problem}</p>}
        {news && <p className="mt-2 text-[11px] text-emerald-300" data-key-news>{news}</p>}
      </header>

      {!rows && !problem && <p className="text-[12px] text-white/45">بجيب قايمة المزودات…</p>}

      <ul className="space-y-3">
        {(rows ?? []).map((row) => {
          const tone =
            row.alive > 0 ? 'bg-emerald-600/20 text-emerald-300' : row.quota > 0 ? 'bg-amber-500/20 text-amber-300' : row.rows === 0 ? 'bg-white/[0.06] text-white/45' : 'bg-rose-600/20 text-rose-300';
          return (
            <li key={row.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4" data-key-provider={row.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[13px] font-black text-white">{row.label}</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{row.good}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${tone}`} data-key-verdict={row.id}>
                  {row.verdict}
                </span>
              </div>

              <p className="mt-2 text-[11px] text-white/55">
                {arNum(row.rows)} مفتاح · بيجاوب {arNum(row.alive)}
                {row.quota ? ` · سقفه خلص ${arNum(row.quota)}` : ''}
                {row.refused ? ` · مرفوض ${arNum(row.refused)}` : ''}
                {row.unverified ? ` · متأكدش عنه ${arNum(row.unverified)}` : ''}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => verify(row.id)}
                  disabled={checking !== null || row.rows === 0}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white/65 disabled:opacity-40"
                  data-key-check={row.id}
                >
                  <RefreshCw className="h-3 w-3" />
                  {checking === row.id ? 'باسأل المزود…' : 'تحقّق دلوقتي'}
                </button>
                {row.alive === 0 && (
                  <a
                    href={row.keysUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-200"
                    data-key-get={row.id}
                  >
                    جيب مفتاح
                  </a>
                )}
              </div>

              {row.alive === 0 && <p className="mt-2 text-[10px] leading-relaxed text-white/40">{row.steps}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
