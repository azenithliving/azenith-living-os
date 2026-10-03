'use client';

/**
 * ColourMatrix — the colours his own room can back, as buttons a thumb can press.
 *
 * Every swatch is a colour stored on a real picture of his room type, and the number under it says
 * how many of the pictures below carry it. He may stop on up to three; the sheet then re-orders his
 * pictures by what he chose. Nothing here invents a colour, and nothing here stores one — the store
 * re-checks each pick against the bank before it keeps it.
 */

import { arNum } from '@/lib/ops/metricLabels';

export type MatrixEntry = { family: string; label: string; hex: string; count: number };
export type Pick = { family: string; hex: string };

const MAX_PICKS = 3;

export default function ColourMatrix({
  matrix,
  picks,
  onChange,
  busy = false,
}: {
  matrix: MatrixEntry[];
  picks: Pick[];
  onChange: (next: Pick[]) => void;
  busy?: boolean;
}) {
  const chosen = new Set(picks.map((pick) => pick.hex.toLowerCase()));

  if (!matrix.length) {
    return (
      <p className="text-[11px] leading-relaxed text-white/45" data-colour-empty>
        صور مكانك لسه ما كفايش تتعمل منها مصفوفة ألوان — الصور اللي تحت هي اللي عندنا له.
      </p>
    );
  }

  const toggle = (entry: MatrixEntry) => {
    if (chosen.has(entry.hex.toLowerCase())) {
      onChange(picks.filter((pick) => pick.hex.toLowerCase() !== entry.hex.toLowerCase()));
      return;
    }
    if (picks.length >= MAX_PICKS) return;
    onChange([...picks, { family: entry.family, hex: entry.hex }]);
  };

  // A fourth tap is not swallowed: the grid says it is full, and says how to make room.
  const full = picks.length >= MAX_PICKS;

  return (
    <div data-colour-matrix data-colour-full={full ? "1" : "0"}>
      <div className="grid grid-cols-4 gap-2">
        {matrix.map((entry) => {
          const on = chosen.has(entry.hex.toLowerCase());
          return (
            <button
              key={entry.hex}
              type="button"
              onClick={() => toggle(entry)}
              onPointerDown={(event) => event.preventDefault()}
              disabled={busy || (full && !on)}
              aria-pressed={on}
              data-colour-swatch={entry.hex}
              data-colour-selected={on ? '1' : '0'}
              className={`rounded-xl border p-1.5 text-right transition-colors disabled:opacity-50 ${
                on ? 'border-amber-500/60 bg-amber-500/10' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <span className="block h-9 w-full rounded-lg border border-white/15" style={{ backgroundColor: entry.hex }} />
              <span className="mt-1 block text-[10px] leading-tight text-white/80">{entry.label}</span>
              <span className="block text-[9px] leading-tight text-white/40">{arNum(entry.count)} من الصور دي</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/45" data-colour-hint>
        {full ? 'اخدت تلاتة — دوس على لون عشان تشيله وتختار غيره.' : 'اختار لحد تلاتة — الصور اللي تحت هترتّب على اللي وقفت عليه.'}
      </p>
    </div>
  );
}
