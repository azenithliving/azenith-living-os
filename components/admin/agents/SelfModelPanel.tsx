'use client';

import { useEffect, useRef } from 'react';
import { X, Loader2, Bot, CalendarClock, ShieldAlert, Gauge } from 'lucide-react';
import { CAPABILITY_LABELS } from '@/lib/qayyim/palette';
import type { SelfModelView } from '@/lib/qayyim/self-view';

/**
 * «اسأل عن نفسك» as a screen instead of a paragraph: the same live self-model the
 * swarm quotes at itself, drawn from the registries and the counters.
 *
 * Read-only by design. Everything here was measured on the server moments ago;
 * a failed counter is shown as a failure rather than as a zero, because a report
 * that smooths over its own blind spots is the thing P6 was started to kill.
 */
interface SelfModelPanelProps {
  open: boolean;
  model: SelfModelView | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
}

export function SelfModelPanel({ open, model, loading, error, onClose }: SelfModelPanelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // A capability only counts as offered when it has an Arabic name: the list
  // below must not claim more than the owner can actually read and press.
  const named = (model?.tools ?? []).filter((t) => Boolean(CAPABILITY_LABELS[t.name]));
  const unnamed = (model?.tools ?? []).filter((t) => !CAPABILITY_LABELS[t.name]);

  return (
    <div
      className="absolute inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[8vh] px-4"
      data-self-panel=""
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#111114] shadow-2xl overflow-hidden focus:outline-none"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
          <div>
            <div className="text-sm font-bold text-white">
              {model ? `${model.title} — ${model.brand}` : 'اسأل عن نفسك'}
            </div>
            <div className="text-[10px] text-white/35">
              {model ? `مبني من السجلات الحيّة لحظة ${new Date(model.generatedAt).toLocaleTimeString('ar-EG')}` : ' '}
            </div>
          </div>
          <button
            onClick={onClose}
            title="إغلاق"
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4">
          {loading && !model && (
            <div className="flex items-center gap-2 text-white/50 text-xs py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> بقرا عن نفسي…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
              {error}
            </div>
          )}

          {model && (
            <>
              <section>
                <SectionTitle icon={<Bot className="w-3.5 h-3.5" />} text={`الوكلاء (${model.agents.length})`} />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {model.agents.map((a) => (
                    <div key={a.key} className="rounded-xl bg-white/5 border border-white/10 px-2.5 py-2">
                      <div className="text-[12px] font-bold text-white">{a.name}</div>
                      <div className="text-[10px] text-white/35">{a.roles} أدوار</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <SectionTitle icon={<Gauge className="w-3.5 h-3.5" />} text={`أقدر أنفذ (${named.length})`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {named.map((t) => (
                    <div key={t.name} className="rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-1.5">
                      <div className="text-[11px] text-white/85">{CAPABILITY_LABELS[t.name]}</div>
                      <div className="text-[9px] text-sky-300/50 font-mono" dir="ltr">{t.name}</div>
                    </div>
                  ))}
                </div>
                {unnamed.length > 0 && (
                  <div className="mt-1.5 text-[10px] text-amber-300/70">
                    وفيه {unnamed.length} قدرة لسه ما اتكتبش اسمها بالعربي، فمش معروضة عليك — اسمها الأجنبي في قائمة الأوامر بس.
                  </div>
                )}
                {unnamed.length > 0 && (
                  <div className="text-[9px] text-white/25 font-mono leading-relaxed" dir="ltr">
                    {unnamed.map((t) => t.name).join(", ")}
                  </div>
                )}
              </section>

              {model.counters && (
                <section>
                  <SectionTitle icon={<Gauge className="w-3.5 h-3.5" />} text="العدادات دلوقتي" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {model.counters.map((c) => (
                      <div key={c.label} className="rounded-xl bg-black/30 border border-white/10 px-2.5 py-2">
                        <div className="text-lg font-black text-amber-300 font-mono">
                          {c.value === null ? '؟' : c.value}
                        </div>
                        <div className="text-[10px] text-white/40">{c.label}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {model.dataGaps && model.dataGaps.length > 0 && (
                <section>
                  <SectionTitle icon={<ShieldAlert className="w-3.5 h-3.5" />} text="لم أستطع قراءتها" />
                  <ul className="space-y-1">
                    {model.dataGaps.map((g) => (
                      <li key={g.label} className="text-[11px] text-white/70">
                        <span className="text-rose-300">• {g.label}</span>
                        <div className="text-[9px] text-white/30 font-mono" dir="ltr">{g.reason}</div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <SectionTitle icon={<CalendarClock className="w-3.5 h-3.5" />} text="بيشتغل لوحده بجدوله" />
                <ul className="space-y-1">
                  {model.organs.map((o) => (
                    <li key={o.label} className="flex items-center justify-between text-[11px]">
                      <span className="text-white/75">{o.label}</span>
                      <span className="text-white/35">{o.cadence}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <SectionTitle icon={<ShieldAlert className="w-3.5 h-3.5" />} text="حدودي" />
                <ul className="space-y-1">
                  {model.limits.map((l) => (
                    <li key={l} className="text-[11px] text-white/60">• {l}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400/80 mb-1.5">
      {icon}
      {text}
    </div>
  );
}
