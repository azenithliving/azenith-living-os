'use client';

/**
 * RoomPlan — the paper's numbers drawn as a room, on a phone.
 *
 * Solid walls are the ones a witness agreed, dashed ones are what the reader proposed and nobody
 * has confirmed yet; the sheet says so under the drawing rather than letting a guess look like a
 * measurement. A door or a window can be dragged along the wall it sits on — that is a place, not
 * a number, so it never touches the seal the customer signed.
 *
 * The component owns no measurement and no storing: it asks `onMove` and `onShape`, and the store's
 * own builder re-walks the room before anything is kept.
 */

import { useEffect, useRef, useState } from 'react';

import { arNum } from '@/lib/ops/metricLabels';
import { SHAPE_LABELS, type Plan, type PlanOpening, type PlanShape } from '@/lib/cad/plan';
import { clampOpening, openingSpan, planViewBox, pointerToMetres, projectPointerOnWall, toScreenY } from '@/lib/cad/plan-view';

const OPENING_WORDS: Record<string, string> = { door: 'باب', window: 'شباك' };

type Props = {
  plan: Plan | null;
  /** What the drawing still needs from him — shown instead of an empty frame. */
  question?: string | null;
  interactive?: boolean;
  /** The shapes the store can walk, offered only when he has to pick one. */
  shapes?: PlanShape[];
  onShape?: (shape: PlanShape) => void;
  onMove?: (openings: PlanOpening[]) => void;
};

export default function RoomPlan({ plan, question, interactive = false, shapes = [], onShape, onMove }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draft, setDraft] = useState<PlanOpening[] | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  // Where inside the opening the thumb landed. Without it a door grabbed by its middle jumps half
  // its own width the moment the finger moves.
  const grabRef = useRef(0);

  // A new answer from the store replaces the finger's temporary place, so a refused write cannot
  // leave a door sitting where the table never put it.
  useEffect(() => setDraft(null), [plan]);

  const openings = draft ?? plan?.openings ?? [];
  const box = plan ? planViewBox(plan.walls, 0.45) : null;

  const startDrag = (index: number) => (event: React.PointerEvent<SVGGElement>) => {
    if (!interactive || !plan) return;
    const opening = openings[index];
    const wall = plan.walls[opening?.wallIndex];
    if (!wall) return;
    event.stopPropagation();
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    const rect = svgRef.current?.getBoundingClientRect();
    const metres = rect ? pointerToMetres(box, rect, { x: event.clientX, y: event.clientY }) : null;
    const under = metres ? projectPointerOnWall(wall, metres, null).offsetMeters : opening.offsetMeters;
    grabRef.current = Math.max(0, under - opening.offsetMeters);
    setDragging(index);
  };

  const moveDrag = (index: number) => (event: React.PointerEvent<SVGGElement>) => {
    if (!interactive || !plan || dragging !== index || !svgRef.current) return;
    const opening = openings[index];
    const wall = plan.walls[opening?.wallIndex ?? 0];
    if (!wall) return;
    const metres = pointerToMetres(box, svgRef.current.getBoundingClientRect(), { x: event.clientX, y: event.clientY });
    if (!metres) return;
    const under = projectPointerOnWall(wall, metres, null).offsetMeters - grabRef.current;
    const offsetMeters = clampOpening(wall, opening.widthMeters, under);
    if (offsetMeters === opening.offsetMeters) return;
    setDraft(openings.map((o, i) => (i === index ? { ...o, offsetMeters } : o)));
  };

  const endDrag = (index: number) => (event: React.PointerEvent<SVGGElement>) => {
    if (!interactive || dragging !== index) return;
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    setDragging(null);
    if (draft) onMove?.(draft);
  };

  /** Keys, because a thumb is not the only way to place a door — and ١٠ سم at a time is honest precision. */
  const nudge = (index: number) => (event: React.KeyboardEvent<SVGGElement>) => {
    if (!interactive || !plan) return;
    const step =
      event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -0.1 : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 0.1 : null;
    if (step === null) return;
    event.preventDefault();
    const opening = openings[index];
    const wall = plan.walls[opening?.wallIndex];
    if (!wall) return;
    const next = openings.map((o, i) =>
      i === index ? { ...o, offsetMeters: clampOpening(wall, o.widthMeters, o.offsetMeters + step) } : o
    );
    setDraft(next);
    onMove?.(next);
  };

  if (!plan || !box) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4" data-plan-missing>
        <p className="text-[12px] leading-relaxed text-amber-100">{question || 'الرسم لسه ما كملش — المقاسات على الورقة ما بيقولش شكل المكان.'}</p>
        {interactive && shapes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shapes.map((shape) => (
              <button
                key={shape}
                type="button"
                onClick={() => onShape?.(shape)}
                data-plan-shape={shape}
                className="rounded-full border border-amber-500/40 bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-100"
              >
                {SHAPE_LABELS[shape]}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-plan={plan.shape}>
      <svg
        ref={svgRef}
        viewBox={box}
        data-plan-sheet
        role={interactive ? 'application' : 'img'}
        aria-label={`رسم ${SHAPE_LABELS[plan.shape]} — ${arNum(plan.walls.length)} ضلع`}
        className="block h-auto w-full touch-none select-none"
      >
        {plan.walls.map((wall, i) => (
          <line
            key={i}
            data-plan-wall={i}
            data-plan-wall-confirmed={wall.confirmed ? '1' : '0'}
            x1={wall.x1}
            y1={toScreenY(wall.y1)}
            x2={wall.x2}
            y2={toScreenY(wall.y2)}
            stroke={wall.confirmed ? '#f5c869' : '#8c92a0'}
            strokeWidth={wall.confirmed ? 0.07 : 0.045}
            strokeLinecap="round"
            strokeDasharray={wall.confirmed ? undefined : '0.22 0.14'}
          />
        ))}

        {plan.walls.map((wall, i) => {
          const length = wall.meters || 0.001;
          const midX = (wall.x1 + wall.x2) / 2;
          const midY = (wall.y1 + wall.y2) / 2;
          // Labels stand off the wall on the outside of the room, never on top of it.
          const nx = -(wall.y2 - wall.y1) / length;
          const ny = (wall.x2 - wall.x1) / length;
          const isVertical = Math.abs(wall.x2 - wall.x1) < Math.abs(wall.y2 - wall.y1);
          return (
            <text
              key={`l${i}`}
              data-plan-wall-label={i}
              x={midX + nx * 0.28}
              y={toScreenY(midY + ny * 0.28) + (isVertical ? 0 : 0.09)}
              textAnchor="middle"
              fontSize={0.24}
              fontWeight="700"
              fill={wall.confirmed ? '#f5c869' : '#8c92a0'}
            >
              {arNum(wall.meters)}
            </text>
          );
        })}

        {openings.map((opening, i) => {
          const wall = plan.walls[opening.wallIndex];
          if (!wall) return null;
          const span = openingSpan(wall, opening);
          const length = wall.meters || 0.001;
          const ux = (wall.x2 - wall.x1) / length;
          const uy = (wall.y2 - wall.y1) / length;
          const isVertical = Math.abs(wall.x2 - wall.x1) < Math.abs(wall.y2 - wall.y1);
          const words = OPENING_WORDS[opening.kind] ?? opening.kind;
          return (
            <g
              key={`o${i}`}
              data-plan-opening={`${opening.kind}-${i}`}
              data-plan-opening-wall={opening.wallIndex}
              data-plan-opening-offset={opening.offsetMeters}
              role={interactive ? 'slider' : undefined}
              aria-label={`${words} على الضلع ${arNum(opening.wallIndex + 1)}`}
              aria-valuenow={interactive ? opening.offsetMeters : undefined}
              aria-valuemin={interactive ? 0 : undefined}
              aria-valuemax={interactive ? Math.max(0, wall.meters - (opening.widthMeters ?? 0)) : undefined}
              tabIndex={interactive ? 0 : undefined}
              className={interactive ? 'cursor-grab touch-none outline-none' : undefined}
              onPointerDown={startDrag(i)}
              onPointerMove={moveDrag(i)}
              onPointerUp={endDrag(i)}
              onPointerCancel={endDrag(i)}
              onKeyDown={nudge(i)}
            >
              {/* A thumb is not a stylus: the grab band is wider than the door it moves. */}
              <line
                x1={span.x1}
                y1={toScreenY(span.y1)}
                x2={span.x2}
                y2={toScreenY(span.y2)}
                stroke="transparent"
                strokeWidth={0.6}
              />
              {/* the wall's own line is broken where the opening is */}
              <line x1={span.x1} y1={toScreenY(span.y1)} x2={span.x2} y2={toScreenY(span.y2)} stroke="#0d0f12" strokeWidth={0.16} />
              {opening.kind === 'window' ? (
                <>
                  <line x1={span.x1} y1={toScreenY(span.y1)} x2={span.x2} y2={toScreenY(span.y2)} stroke="#7dd3fc" strokeWidth={0.05} />
                  {/* the second line is the glazing: a window is two lines in a wall, a door is a swing */}
                  <line
                    x1={span.x1 - uy * 0.06}
                    y1={toScreenY(span.y1 + ux * 0.06)}
                    x2={span.x2 - uy * 0.06}
                    y2={toScreenY(span.y2 + ux * 0.06)}
                    stroke="#7dd3fc"
                    strokeWidth={0.03}
                    opacity="0.75"
                  />
                </>
              ) : (
                <>
                  <line x1={span.x1} y1={toScreenY(span.y1)} x2={span.x2} y2={toScreenY(span.y2)} stroke="#f5c869" strokeWidth={0.05} />
                  {/* the swing, so a door reads as a door and not as a gap */}
                  <path
                    d={`M ${span.x2} ${toScreenY(span.y2)} A ${opening.widthMeters || 0.6} ${opening.widthMeters || 0.6} 0 0 ${isVertical ? 1 : 0} ${span.x2 - ux * (opening.widthMeters || 0.6)} ${toScreenY(span.y2 - uy * (opening.widthMeters || 0.6))}`}
                    fill="none"
                    stroke="#f5c869"
                    strokeWidth={0.025}
                    opacity="0.8"
                  />
                </>
              )}
              {interactive && (
                <circle
                  data-plan-handle={i}
                  cx={(span.x1 + span.x2) / 2}
                  cy={toScreenY((span.y1 + span.y2) / 2)}
                  r={0.18}
                  fill="#f5c869"
                  opacity={dragging === i ? 1 : 0.6}
                />
              )}
            </g>
          );
        })}
      </svg>

      <p className="mt-2 text-[10px] leading-relaxed text-white/45" data-plan-legend>
        {plan.walls.some((w) => !w.confirmed) ? 'الخط المتصل: ضلع اتفق عليه. المتقطع: مقترح لسه ما اتأكدش.' : 'كل ضلع على الرسم اتفقنا عليه.'}
      </p>

      {(plan.sidesOnPaper ?? plan.walls.length) < plan.walls.length && (
        // Two numbers on a sheet are the room's length and width; the drawing says where the other
        // two walls came from rather than letting them look measured.
        <p className="mt-1 text-[10px] leading-relaxed text-white/40" data-plan-implied>
          الضلع ومقابلته بنفس القياس — ورقته فيها {arNum(plan.sidesOnPaper ?? 0)} رقم ورسمناها {arNum(plan.walls.length)} أضلاع.
        </p>
      )}

      {plan.conflicts.length > 0 && (
        <ul className="mt-2 space-y-1">
          {plan.conflicts.map((line, i) => (
            <li key={i} className="text-[11px] leading-relaxed text-amber-300/90" data-plan-question>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
