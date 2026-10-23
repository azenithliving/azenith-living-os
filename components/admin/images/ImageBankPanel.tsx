"use client";

/**
 * ImageBankPanel — what the store actually holds, read from the record that owns it.
 *
 * The old screen printed the harvest log's machine status in English and un-translated counts. This
 * panel reads the same guarded door the old screen used (one owner for the count) and says the numbers
 * in the owner's digits, with the room names from the store's own namer.
 *
 * It shows nothing it cannot read: no bucket listing, no target it does not own, and no picture grid
 * until the door behind it is moved too.
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Images, Loader2, RefreshCw } from "lucide-react";
import { arNum } from "@/lib/ops/metricLabels";
import { roomLabel } from "@/lib/cad/room-names";

interface Entry {
  room_type: string;
  style: string;
  active_count: number;
}
interface Refresh {
  id: number;
  status: string;
  duration_minutes?: number | null;
  images_before?: number | null;
  images_after?: number | null;
  created_at?: string;
}
interface Stats {
  total: number;
  distribution: Entry[];
}

// The status words are the record's own column values (a database constraint); only their reading is here.
const STATUS_AR: Record<string, string> = {
  success: "نجح",
  failed: "وقف",
  running: "شغال دلوقتي",
};

export function ImageBankPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshes, setRefreshes] = useState<Refresh[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/images/stats", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: string; stats?: Stats; recentRefreshes?: Refresh[]; warnings?: string[] }
        | null;
      if (!res.ok || !body?.success) {
        const given = typeof body?.error === "string" && /[\u0600-\u06FF]/.test(body.error) ? body.error : null;
        setError(given ?? `باب إحصاء الصور ردّ بحالة ${res.status} من غير ما يوصّل سبب بالعربي`);
        return;
      }
      setStats(body.stats ?? { total: 0, distribution: [] });
      setRefreshes(body.recentRefreshes ?? []);
      setWarnings(body.warnings ?? []);
    } catch {
      setError("باب إحصاء الصور ما وصلش أصلًا — الأرقام دي مش من البنك.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rooms = stats?.distribution ?? [];
  // The door returns room+style pairs. Summing a slice of them would print a room's fraction and
  // call it its total, and grouping by the raw key would show one room twice — the store's own namer
  // maps `living-room` and `lounge` to the same Arabic name. So: sum every pair, by its name.
  const byRoom = new Map<string, number>();
  for (const row of rooms) {
    const name = roomLabel(row.room_type) ?? "غير مصنف";
    byRoom.set(name, (byRoom.get(name) ?? 0) + row.active_count);
  }
  const topRooms = [...byRoom.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <section className="rounded-3xl border border-white/[0.06] bg-white/[0.015] p-4 sm:p-5 space-y-4" aria-labelledby="image-bank-title">
      <header className="flex flex-wrap items-center gap-2">
        <Images className="w-4 h-4 text-amber-300" aria-hidden="true" />
        <h2 id="image-bank-title" className="text-sm font-black text-white">بنك الصور</h2>
        <span className="text-[10px] text-white/70">اللي في السجل فعلاً، بالعدد اللي بيشوفه العميل</span>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="mr-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/70 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-3 h-3" aria-hidden="true" />}
          حدّث
        </button>
      </header>

      {error ? (
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-rose-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {stats ? (
        <p className="text-xs leading-relaxed text-white/85">
          الصور المحفوظة عند الدار: <span className="font-black text-amber-300">{arNum(stats.total)}</span>
        </p>
      ) : null}

      {topRooms.length ? (
        <ul className="grid grid-cols-2 gap-2">
          {topRooms.map(([room, count]) => (
            <li key={room} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <p className="text-[11px] font-bold text-white">{roomLabel(room) ?? "غير مصنف"}</p>
              <p className="text-[10px] text-white/70">{arNum(count)} صورة</p>
            </li>
          ))}
        </ul>
      ) : stats ? (
        <p className="text-[11px] text-white/70">السجل فاضي — مفيش صورة واحدة مصنّفة.</p>
      ) : null}

      {warnings.length ? (
        <ul className="space-y-1">
          {warnings.map((w) => (
            <li key={w} className="text-[11px] leading-relaxed text-amber-200/90">{w}</li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <h3 className="text-[11px] font-black text-white/85">آخر عمليات التحديث</h3>
        {refreshes.length === 0 ? (
          <p className="text-[11px] text-white/70">مفيش سجل تحديث — الباب ما لقاش عملية واحدة متسجلة.</p>
        ) : (
          <ul className="space-y-1">
            {refreshes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-[11px] text-white/85">
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[10px]">
                  {STATUS_AR[r.status] ?? "حالة ما اتعرفتش"}
                </span>
                {typeof r.images_before === "number" && typeof r.images_after === "number" ? (
                  <span>{arNum(r.images_before)} ← {arNum(r.images_after)}</span>
                ) : null}
                {typeof r.duration_minutes === "number" ? <span className="text-white/70">في {arNum(r.duration_minutes)} دقيقة</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default ImageBankPanel;
