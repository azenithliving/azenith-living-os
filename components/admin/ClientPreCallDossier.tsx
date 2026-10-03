'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, Search } from 'lucide-react';

import { matchRoll, rollLineLabel } from '@/lib/customers/match';
import { arNum } from '@/lib/ops/metricLabels';
import type { DossierSection } from '@/lib/cad/dossier';
import type { Plan } from '@/lib/cad/plan';
import RoomPlan from '@/components/cad/RoomPlan';

type RollLine = { key: string; name: string | null; phone: string | null; email?: string | null };
type Paper = { id: number; created_at: string; sheet_path: string | null; photo_url: string | null };
type DossierFile = {
  headline: string;
  sections: DossierSection[];
  papers: Paper[];
  /** The room the store walked from his numbers — the same picture his own sheet shows. */
  plan?: Plan | null;
  plan_question?: string | null;
};

/**
 * «الملف الذهبي قبل المكالمة» — the one screen the owner opens between «his number is on the
 * phone» and «I dial».
 *
 * It is assembled by the store, not by a model: the roll's own line, the papers already linked
 * to him, the numbers on the newest one, and the colours the image bank measured off the
 * pictures that fit his room. Two of the five things the plan asked for — his area and the
 * pieces he kept looking at — have no source in this store, and the file prints them as unknown
 * in the same voice as the rest. A dossier that fills a gap with a guess is worse than none,
 * because he walks into the call trusting it.
 *
 * The search runs over the roll the customers door returns, so this screen cannot grow a second
 * list of people that disagrees with the desk.
 */
export default function ClientPreCallDossier() {
  const [roll, setRoll] = useState<RollLine[] | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<RollLine | null>(null);
  const [file, setFile] = useState<DossierFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/customers', { cache: 'no-store', signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => setRoll((data.customers ?? []) as RollLine[]))
      .catch(() => setRoll(null));
    return () => controller.abort();
  }, []);

  const open = useCallback(async (line: RollLine) => {
    setPicked(line);
    setFile(null);
    setProblem(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers/dossier?customer_key=${encodeURIComponent(line.key)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) throw new Error(data?.error || `السجل ردّ بـ ${res.status}`);
      setFile({
        headline: String(data.headline ?? ''),
        sections: (data.sections ?? []) as DossierSection[],
        papers: (data.papers ?? []) as Paper[],
        plan: (data.plan ?? null) as Plan | null,
        plan_question: data.plan_question ? String(data.plan_question) : null,
      });
    } catch (error) {
      setProblem(String((error as Error)?.message ?? error));
    } finally {
      setBusy(false);
    }
  }, []);

  const matches = useMemo(() => (roll ? matchRoll(roll, query) : []), [roll, query]);
  const newest = file?.papers[0] ?? null;
  const digits = picked?.phone ?? null;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      data-dossier-panel
    >
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-amber-300" />
        <h2 className="text-base font-black text-white">الملف الذهبي قبل المكالمة</h2>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-white/45">
        اكتب آخر رقم في الموبايل أو أول الاسم، وهو يطلّع لك رسمته ومقاساته والألوان اللي لمكانه —
        واللي ماعرفوش عنك يقولهالك صراحة.
      </p>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="آخر أربع أرقام أو أول اسم"
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-amber-500/40 focus:outline-none"
        data-dossier-search
      />

      {roll === null && (
        <p className="mt-2 text-[11px] text-amber-300">الدفتر ما ردّش — مش معناه إن مفيش عملاء.</p>
      )}
      {roll !== null && query.trim() && matches.length === 0 && (
        <p className="mt-2 text-[11px] text-white/45">مفيش حد في الدفتر بهالحرف.</p>
      )}

      {!picked && matches.length > 0 && (
        <ul className="mt-2 space-y-1" data-dossier-candidates>
          {matches.map(({ line, why }) => (
            <li key={line.key}>
              <button
                onClick={() => open(line)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-right text-[13px] text-white"
                data-dossier-pick={line.key}
              >
                <span className="truncate">{rollLineLabel(line)}</span>
                <span className="shrink-0 text-[10px] text-white/35">{why}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <div className="mt-3 space-y-3" data-dossier-file>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-white" data-dossier-headline>{file?.headline ?? picked.name ?? 'عميل من غير اسم'}</p>
            <div className="flex items-center gap-2">
              {digits && (
                <a
                  href={`tel:+20${digits}`}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300"
                  data-dossier-call
                >
                  <Phone className="w-3.5 h-3.5" />
                  اتصل بيه
                </a>
              )}
              {digits && (
                <a
                  href={`https://wa.me/20${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300"
                  data-dossier-whatsapp
                >
                  واتساب
                </a>
              )}
              {!digits && (
                <p className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] text-white/45">
                  مفيش رقم مسجل عنده
                </p>
              )}
              <button
                onClick={() => {
                  setPicked(null);
                  setFile(null);
                  setProblem(null);
                  setQuery('');
                }}
                className="text-[11px] text-white/40"
                data-dossier-back
              >
                غير العميل
              </button>
            </div>
          </div>

          {busy && <p className="text-[11px] text-white/45">قرايم الدفتر والورقات...</p>}
          {problem && <p className="text-[11px] text-rose-300" data-dossier-problem>{problem}</p>}

          {file && newest?.photo_url && (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40" data-dossier-paper>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={newest.photo_url} alt="الورقة اللي رسمها" className="max-h-72 w-full object-contain" />
              {newest.sheet_path && (
                <div className="border-t border-white/5 p-2.5">
                  <a
                    href={newest.sheet_path}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-bold text-amber-300"
                    data-dossier-sheet
                  >
                    صفحة ورقته — يأكد عليها مقاساته
                  </a>
                </div>
              )}
            </div>
          )}

          {file && (file.plan || file.plan_question) && (
            // The same component his sheet runs: what the owner sees is what the customer signed,
            // down to which wall is drawn dashed.
            <div className="rounded-xl border border-white/[0.07] bg-black/25 p-3" data-dossier-plan>
              <p className="text-[12px] font-black text-amber-300/90">رسمته زي ما بنشتغل بيها</p>
              <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.02] p-2">
                <RoomPlan plan={file.plan ?? null} question={file.plan_question} />
              </div>
              {file.plan?.conflicts.length ? (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-200/85" data-dossier-plan-question>
                  الرسم بيسألك — السطور تحت الرسم دي اللي هتحددوها في المكالمة.
                </p>
              ) : null}
            </div>
          )}

          {file?.sections.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-white/[0.07] bg-black/25 p-3"
              data-dossier-section={section.id}
            >
              <p className="text-[12px] font-black text-amber-300/90">{section.title}</p>

              {section.facts.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {section.facts.map((fact) => (
                    <li key={fact.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                      <span className="shrink-0 text-[10px] text-white/40">{fact.label}</span>
                      <span className="text-[12px] leading-relaxed text-white/85 sm:text-left">{fact.value}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.swatches && section.swatches.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" data-dossier-swatches>
                  {section.swatches.map((hex) => (
                    // The code behind the square is a machine value, so it is not printed:
                    // what he reads is the colour itself.
                    <span
                      key={hex}
                      className="h-7 w-7 rounded-lg border border-white/15"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              )}

              {section.picks && section.picks.length > 0 && (
                // The picture, not a description of it: on the phone he points at the one they
                // sent and says «دي اللي اختارتوها».
                <div className="mt-2 grid grid-cols-3 gap-2" data-dossier-picks>
                  {section.picks.map((pick) => (
                    <figure key={pick.url} className="m-0" data-dossier-picked-picture={pick.url}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={pick.url}
                        alt="القطعة اللي وقفت عليها العائلة"
                        loading="lazy"
                        className="h-20 w-full rounded-lg border border-white/10 object-cover"
                      />
                      <figcaption className="mt-1 text-[10px] leading-tight text-white/55">
                        {arNum(pick.likes)} صوت: {pick.voters.join("، ")}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}

              {section.chosen && section.chosen.length > 0 && (
                // His own words, in colour: what he stopped on is not the bank's palette and must
                // not be shown as if it were.
                <div className="mt-2" data-dossier-colours>
                  <p className="text-[10px] text-white/45">ألوانه اللي اختارها</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {section.chosen.map((colour) => (
                      <span
                        key={colour.hex}
                        data-dossier-chosen-colour={colour.hex}
                        className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-2 py-1 text-[10px] text-amber-100"
                      >
                        <span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: colour.hex }} />
                        {colour.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {section.missing?.length ? (
                <ul className="mt-2 space-y-1">
                  {section.missing.map((line) => (
                    <li
                      key={line}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200/85"
                      data-dossier-missing
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
