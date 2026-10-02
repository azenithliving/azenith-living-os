'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, KeyRound, RefreshCw } from 'lucide-react';

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
  /** Proven by a real four-token request, not by a model list. */
  writes: number;
  /** The account answers and refuses on money. */
  unfunded: number;
  quota: number;
  refused: number;
  quarantined: number;
  unverified: number;
  lastCheck: string | null;
  verdict: string;
};

/** The address he will land on, printed under the Arabic label so he recognises it. */
function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www./, '');
  } catch {
    return '';
  }
}

type Totals = {
  keys: number;
  alive: number;
  writes: number;
  unfunded: number;
  refused: number;
  quarantined: number;
  withLiveKey: number;
  needingKey: number;
};

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
  const [picked, setPicked] = useState('groq');
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

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
          `سألنا ${arNum(data.checked)} مفتاح: كتب فعلًا ${arNum(states.writes ?? 0)} · بيرد على التحية ${arNum(states.alive ?? 0)} · سقفه خلص ${arNum(
            states.quota ?? 0
          )} · بلا رصيد ${arNum(states.unfunded ?? 0)} · مرفوض ${arNum(states.refused ?? 0)}`
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

  /**
   * He said he will bring more keys himself. So the desk takes one, and the answer he gets is
   * not «saved» — it is whether this key writes, because a saved key that cannot write is the
   * exact thing the last hour proved a desk must not pretend about.
   */
  const addKey = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    setNews(null);
    try {
      const res = await fetch('/api/admin/keys/desk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', provider: picked, key: draft }),
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || `الخادم ردّ بـ ${res.status}`);
      setNews(data.message);
      setDraft('');
      if (Array.isArray(data.providers)) setRows(data.providers);
    } catch (error) {
      setNews(String((error as Error)?.message ?? error));
    } finally {
      setAdding(false);
    }
  }, [adding, draft, picked]);

  return (
    <div className="min-h-[70vh] p-4 pt-16 sm:p-6 sm:pt-8" dir="rtl">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-lg font-black text-white">
          <KeyRound className="h-5 w-5 text-amber-400" />
          مكتب المفاتيح
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          كل نموذج مجاني المتجر يقدر يشغل عليه، وعدادان مش واحد: اللي بيرد على التحية، واللي كتب رد فعليًا. الأرقام من ردّ المزود نفسه، مش من ورقة.
        </p>
        {totals && (
          <p className="mt-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] text-white/60" data-key-totals>
            {arNum(totals.keys)} مفتاح عندنا · كتب فعلًا {arNum(totals.writes)} · بيرد على التحية {arNum(totals.alive)} · حسابه بلا رصيد {arNum(totals.unfunded)} · مرفوض {arNum(totals.refused)}
            {totals.quarantined ? ` · معزول ${arNum(totals.quarantined)}` : ''}
            {` · ${arNum(totals.withLiveKey)} من ${arNum(rows?.length ?? 0)} مزودات ليها رد حي · ${arNum(totals.needingKey)} محتاج مفتاح`}
          </p>
        )}
        {problem && <p className="mt-2 text-[11px] text-rose-300">{problem}</p>}
        {news && <p className="mt-2 text-[11px] text-emerald-300" data-key-news>{news}</p>}
      </header>

      {/* He said he will keep bringing keys himself. This is where he hands one over, and the
          line that comes back is the provider's answer, not a «saved» that hides it. */}
      <section className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-3" data-key-add>
        <h2 className="text-[12px] font-black text-amber-200">أضف مفتاح جبتّه دلوقتي</h2>
        <p className="mt-1 text-[10px] leading-relaxed text-white/45">
          المتجر بيسأل المفتاح سؤالين: المزود بيعرفك؟ وبتكتب رد فعليًا؟ التاني هو اللي بيحدّد لو هيتستخدم.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-2.5 py-2 text-[12px] text-white focus:border-amber-500/40 focus:outline-none"
            data-key-provider
          >
            {(rows ?? []).map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="الصق المفتاح"
            dir="ltr"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-right text-[12px] text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
            data-key-input
          />
          <button
            onClick={addKey}
            disabled={adding || draft.trim().length < 12 || !picked}
            className="rounded-xl border border-amber-500/30 bg-amber-500/20 px-3 py-2 text-[12px] font-black text-amber-200 disabled:opacity-40"
            data-key-add-submit
          >
            {adding ? 'بأسأل المزود…' : 'أضف وتحقّق'}
          </button>
        </div>
      </section>

      {!rows && !problem && <p className="text-[12px] text-white/45">بجيب قايمة المزودات…</p>}

      <ul className="space-y-3">
        {(rows ?? []).map((row) => {
          // The colour follows the verdict that matters: a key that wrote. «Answers a hello»
          // is not green — that is the number that fooled us tonight.
          const tone =
            row.writes > 0
              ? 'bg-emerald-600/20 text-emerald-300'
              : row.quota > 0
                ? 'bg-amber-500/20 text-amber-300'
                : row.rows === 0
                  ? 'bg-white/[0.06] text-white/45'
                  : 'bg-rose-600/20 text-rose-300';
          return (
            <li key={row.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4" data-key-card={row.id}>
              {/* Stacked on a phone: the verdict line is long, and beside the description it
                  squeezed the Arabic into a narrow column. */}
              <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-[13px] font-black text-white">{row.label}</h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">{row.good}</p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${tone}`} data-key-verdict={row.id}>
                  {row.verdict}
                </span>
              </div>

              <p className="mt-2 text-[11px] text-white/55">
                {arNum(row.rows)} مفتاح · كتب {arNum(row.writes)}
                {row.alive ? ` · تحية بس ${arNum(row.alive)}` : ''}
                {row.unfunded ? ` · بلا رصيد ${arNum(row.unfunded)}` : ''}
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
                {/* The address is always shown, not only when the provider is empty: the
                    owner asked to see where a key comes from before he needs one, and a link
                    that appears only after the failure is a link he never learns exists. */}
                <a
                  href={row.keysUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-200"
                  data-key-get={row.id}
                >
                  <ExternalLink className="h-3 w-3" />
                  جيب مفتاح · {hostOf(row.keysUrl)}
                </a>
              </div>

              <p className="mt-2 text-[10px] leading-relaxed text-white/40">{row.steps}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
