'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Loader2, CornerDownLeft } from 'lucide-react';
import {
  PALETTE_PLACEHOLDER,
  PALETTE_SECTIONS,
  filterPalette,
  paletteSectionTitle,
  type PaletteCommand,
} from '@/lib/qayyim/palette';

/**
 * Ctrl/Cmd+K over the chat: every capability the swarm really has, searchable in
 * Egyptian dialect, in the owner's language.
 *
 * The list is built from the live self-model, so a tool that left the registry
 * disappears from here on the next open. Rows that only describe a schedule are
 * rendered as such — the palette never dresses information up as a command.
 */
interface CommandPaletteProps {
  commands: PaletteCommand[];
  loading?: boolean;
  error?: string | null;
  onPick: (cmd: PaletteCommand) => void;
  onClose: () => void;
}

export function CommandPalette({ commands, loading, error, onPick, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => filterPalette(commands, query), [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => setCursor(0), [query]);

  const grouped = useMemo(
    () =>
      PALETTE_SECTIONS.map((kind) => ({
        kind,
        items: visible.filter((i) => i.kind === kind),
      })).filter((g) => g.items.length > 0),
    [visible],
  );

  const flat: PaletteCommand[] = grouped.flatMap((g) => g.items);

  const commit = (cmd: PaletteCommand | undefined) => {
    if (!cmd) return;
    onClose();
    onPick(cmd);
  };

  const move = (delta: number) => {
    setCursor((c) => {
      const next = c + delta;
      if (!flat.length) return 0;
      return (next + flat.length) % flat.length;
    });
  };

  return (
    <div
      className="absolute inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
      data-palette=""
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#111114] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <Command className="w-4 h-4 text-amber-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
              else if (e.key === 'Enter') { e.preventDefault(); commit(flat[cursor]); }
            }}
            placeholder={PALETTE_PLACEHOLDER}
            data-palette-input=""
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 focus:outline-none"
          />
          <span className="text-[10px] text-white/30 font-mono" dir="ltr">esc</span>
        </div>

        {loading && (
          <div className="px-4 py-6 flex items-center gap-2 text-white/50 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> بقرا القدرات الحيّة…
          </div>
        )}

        {!loading && error && (
          <div className="px-4 py-4 text-xs text-rose-300 bg-rose-500/10 border-b border-rose-500/20">{error}</div>
        )}

        {!loading && !error && flat.length === 0 && (
          <div className="px-4 py-6 text-xs text-white/40">
            مفيش قدرة بهذا الاسم. دي مش قائمة مقترحات عامة — دي حاجات أقدر أنفذها فعلاً.
          </div>
        )}

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-1">
          {grouped.map((group) => (
            <div key={group.kind} data-palette-group={group.kind}>
              <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-amber-400/70">
                {paletteSectionTitle(group.kind)}
              </div>
              {group.items.map((item) => {
                const index = flat.indexOf(item);
                const runnable = Boolean(item.runTool || item.href || item.kind === 'view');
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-palette-item={item.id}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => commit(item)}
                    className={`w-full text-right px-4 py-2 flex items-center justify-between gap-3 transition-colors ${
                      index === cursor ? 'bg-white/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <span className="text-[13px] text-white/90 leading-snug">{item.label}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {item.hint && (
                        <span
                          className={`text-[10px] font-mono ${/^[ا-ي]/.test(item.hint) ? 'text-white/35 font-sans' : 'text-sky-300/60'}`}
                          dir={/^[ا-ي]/.test(item.hint) ? 'rtl' : 'ltr'}
                        >
                          {item.hint}
                        </span>
                      )}
                      {runnable && index === cursor && (
                        <CornerDownLeft className="w-3 h-3 text-white/40" />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-white/30 flex items-center gap-3">
          <span>أسهم للتنقل، إنتر للتنفيذ</span>
        </div>
      </div>
    </div>
  );
}
