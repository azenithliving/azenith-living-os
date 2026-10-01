'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';

import Link from 'next/link';

import { arNum } from '@/lib/ops/metricLabels';
import SketchOwner, { type RollLine } from '@/components/admin/sketches/SketchOwner';

type Dimension = { label: string; meters: number; confirmed: boolean };
type Opening = { kind: 'door' | 'window'; widthMeters: number | null };

type Reading = {
  ok: boolean;
  failure: string | null;
  room: string | null;
  dimensions: Dimension[];
  openings: Opening[];
  areaSqm: number | null;
  confirmedCount: number;
  ocr: { ran: boolean; text: string; confidence: number | null; ms: number; error: string | null };
  notes: string | null;
};

type Row = {
  id: number;
  token: string | null;
  room: string | null;
  dimensions: Dimension[];
  openings: Opening[];
  area_sqm: number | string | null;
  confirmed_count: number;
  ok: boolean;
  failure: string | null;
  created_at: string;
  customer_key: string | null;
  witnesses?: { offline?: { ran?: boolean; ms?: number; confidence?: number | null } };
};

const OPENING_LABEL: Record<Opening['kind'], string> = { door: 'باب', window: 'شباك' };

function when(iso: string): string {
  return new Date(iso).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * The paper desk: the owner (or his sales manager) photographs a room drawn by hand on
 * paper, and the store reads it with two witnesses and shows what each of them saw.
 *
 * A refused reading stays on the screen with its reason. That is the point of the page:
 * the owner is allowed to see the machine say «مش متأكد» instead of being handed a tidy
 * number nobody can check.
 */
export default function V2SketchesPage() {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [passportPath, setPassportPath] = useState<string | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [stored, setStored] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [roll, setRoll] = useState<RollLine[] | null>(null);
  const [readingId, setReadingId] = useState<number | null>(null);
  const [readingOwner, setReadingOwner] = useState<string | null>(null);
  /** Show one customer's papers only — the question «his number just called». */
  const [only, setOnly] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const readList = useCallback(async (onlyKey: string | null) => {
    try {
      const res = await fetch(onlyKey ? `/api/admin/ops/sketch?customer_key=${encodeURIComponent(onlyKey)}` : '/api/admin/ops/sketch');
      const data = await res.json();
      if (data?.success) setRows(Array.isArray(data.sketches) ? data.sketches : []);
    } catch {
      // No list is not an empty list; the counter below simply stays as it was.
    }
  }, []);

  const setOwner = useCallback(
    (sketchId: number, customerKey: string | null) => {
      setRows((prev) => prev.map((row) => (row.id === sketchId ? { ...row, customer_key: customerKey } : row)));
      // Re-read rather than trust the local patch: when a filter is open the row may no
      // longer belong on the screen at all, and a stale row is a lie by then.
      void readList(only);
    },
    [only, readList]
  );

  useEffect(() => {
    readList(only);
    // The names come from the customers door — the same reading the customers screen uses,
    // so a paper can never be filed under a name the roll does not carry.
    fetch('/api/admin/customers')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.customers)) setRoll(data.customers as RollLine[]);
      })
      .catch(() => setRoll(null));
  }, [only, readList]);

  const onPick = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return;
      setBusy(true);
      setProblem(null);
      setReading(null);
      setReadingId(null);
      setReadingOwner(null);
      setStored(null);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('الملف ما قريتش'));
          reader.readAsDataURL(file);
        });

        // The pixel witness runs on the store's own server, next to the letter-tables
        // it needs. The browser was tried first and the site's own guard rails refuse
        // a worker from outside this origin — which is the policy working, not failing.
        setStage('بقرا الورقة وأسجّل القراءة…');
        const res = await fetch('/api/admin/ops/sketch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64 }),
        });
        const data = await res.json();
        if (!res.ok || data?.success === false) throw new Error(data?.error || `الخادم ردّ بـ ${res.status}`);
        setReading(data.reading as Reading);
        setStored(Boolean(data.stored));
        setReadingId(typeof data.id === 'number' ? data.id : null);
        setReadingOwner(typeof data.customer_key === 'string' ? data.customer_key : null);
        setPassportPath(typeof data.passport_path === 'string' ? data.passport_path : null);
        // A new paper belongs on the desk, whatever filter was open when it was photographed.
        setOnly(null);
        await readList(null);
      } catch (error) {
        setProblem(String((error as Error)?.message ?? error));
      } finally {
        setBusy(false);
        setStage('');
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [busy, only, readList]
  );

  return (
    <div className="min-h-[70vh] p-4 pt-16 sm:p-6 sm:pt-8" dir="rtl">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-lg font-black text-white">
          <ScanLine className="w-5 h-5 text-amber-400" />
          ورق المقاسات
        </h1>
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          صوّر الورقة اللي العميل رسمها بالقلم، والمتجر يقرأ الأرقام بشاهدين: محرك محلي بيقرا البيكسلات، وقارئ ذكي بيحدد الضلع والباب.
        </p>
      </header>

      <div className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => onPick(e.target.files?.[0])}
          className="block w-full text-[12px] text-white/60 file:ml-3 file:rounded-xl file:border-0 file:bg-amber-500/20 file:px-4 file:py-2 file:text-[12px] file:font-bold file:text-amber-200"
        />
        {busy && <p className="mt-3 text-[11px] text-white/45">{stage || 'بقرا الورقة…'}</p>}
        {problem && <p className="mt-3 text-[11px] text-rose-300">{problem}</p>}
        {stored === false && (
          <p className="mt-3 text-[11px] text-amber-300">القراءة تمت، بس الخزانة ما قبلتش الصورة — هتلاقي السبب تحت.</p>
        )}
      </div>

      {reading && (
        <section className="mb-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-black text-white">{reading.room || 'مكان من غير اسم'}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                reading.ok ? 'bg-emerald-600/25 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {reading.ok ? 'مؤكدة بالشاهدين' : 'مش مؤكدة'}
            </span>
          </div>

          {reading.failure && <p className="mt-2 text-[11px] leading-relaxed text-rose-300">{reading.failure}</p>}

          <div className="mt-3 grid grid-cols-2 gap-2">
            {reading.dimensions.map((dimension, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
                <div className="truncate text-[10px] text-white/40">{dimension.label}</div>
                <div className="text-sm font-black text-white">
                  {arNum(dimension.meters)} متر
                  <span className={`mr-2 text-[10px] font-bold ${dimension.confirmed ? 'text-emerald-300' : 'text-white/30'}`}>
                    {dimension.confirmed ? 'البيكسلات شافته' : 'شاهد واحد'}
                  </span>
                </div>
              </div>
            ))}
            {reading.dimensions.length === 0 && (
              <p className="col-span-2 text-[11px] text-white/40">مفيش رقم اتأكد — الورقة ممكن تكون بايخة أو الأرقام مش مكتوبة.</p>
            )}
          </div>

          {reading.openings.length > 0 && (
            <p className="mt-3 text-[11px] text-white/55">
              الفتحات: {reading.openings.map((o) => `${OPENING_LABEL[o.kind]}${o.widthMeters ? ` ${arNum(o.widthMeters)}م` : ''}`).join(' · ')}
            </p>
          )}

          <p className="mt-3 text-[11px] text-white/55">
            المساحة: {reading.areaSqm ? `${arNum(reading.areaSqm)} متر مربع` : 'متحسبتش — محتاجة ضلعين مؤكدين'}
            {' · '}
            قارئ البيكسلات: {reading.ocr.ran ? `${arNum(Math.round(reading.ocr.ms))} ملي ثانية بثقة ${arNum(Math.round(reading.ocr.confidence ?? 0))}٪` : `ما كملش${reading.ocr.error ? ` — ${reading.ocr.error}` : ''}`}
          </p>
          {reading.notes && <p className="mt-1 text-[11px] text-white/40">ملاحظة على الورقة: {reading.notes}</p>}

          {readingId !== null && (
            <SketchOwner
              sketchId={readingId}
              customerKey={readingOwner}
              roll={roll}
              onLinked={(_id, key) => setReadingOwner(key)}
            />
          )}

          {passportPath && (
            <Link
              href={passportPath}
              className="mt-3 block rounded-xl border border-emerald-500/25 bg-emerald-600/10 px-3 py-2 text-center text-[12px] font-black text-emerald-200"
            >
              ورقة العميل — افتحها أو ابعته إياها
            </Link>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-[12px] font-bold text-white/55">
          {only ? 'ورق عميل واحد' : 'آخر الورقات'}
          {only && (
            <button onClick={() => setOnly(null)} className="rounded-lg border border-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
              كل الورق
            </button>
          )}
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-[11px] text-white/40">
            {only ? 'المتجر ما لقاش ورقة متربطة بالعميل ده.' : 'لسه مفيش ورقة اتقريت.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-bold text-white">{row.room || 'مكان من غير اسم'}</span>
                  <span className="shrink-0 text-[10px] text-white/35">{when(row.created_at)}</span>
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  {row.dimensions.slice(0, 4).map((d) => `${d.label} ${arNum(d.meters)}م`).join(' · ') || 'مفيش أرقام'}
                  {row.area_sqm ? ` · ${arNum(Number(row.area_sqm))} م²` : ''}
                  {` · ${arNum(row.confirmed_count)} مؤكد`}
                </div>
                {!row.ok && row.failure && <p className="mt-1 text-[10px] text-rose-300/80">{row.failure}</p>}
                <SketchOwner sketchId={row.id} customerKey={row.customer_key} roll={roll} onLinked={setOwner} />
                {row.customer_key && (
                  <button
                    onClick={() => setOnly(only === row.customer_key ? null : row.customer_key)}
                    className="mt-1 block rounded-lg border border-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60"
                    data-sketch-only={row.customer_key}
                  >
                    كل ورقه
                  </button>
                )}
                {row.token && (
                  <Link href={`/passport/${row.token}`} className="mt-1.5 inline-block text-[10px] font-bold text-emerald-300">
                    ورقة العميل
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
