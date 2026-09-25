import "server-only";
/**
 * نموذج عالم الدار — the store's live situation, as one small object.
 *
 * Why this exists: before P6 the swarm could describe its own tools but not
 * its own business. This module reads the commercial truth (money in, catalogue,
 * visitors, goals, open decisions, customer voice, season) so a reply can quote
 * numbers instead of prose.
 *
 * Two rules this file must never break:
 *  1. READ-ONLY. No writes, no publishing — the constitution keeps that.
 *  2. NEVER MISTAKE "could not read" FOR "zero". Every query that fails lands
 *     in `gaps` and the digest says so out loud. Likewise, `coverage` records
 *     rows whose `company_id` is missing or foreign: in this deployment the
 *     live room sections sit under the zero UUID and the single product and
 *     one order carry no company_id at all, so a strict company filter would
 *     report an empty store to the owner. Aggregates are therefore store-wide
 *     and the mismatch is disclosed rather than hidden.
 */
import { supabaseServer } from "@/lib/dal/unified-supabase";
import { currentSeason, nextSeason, type SeasonKey } from "./egypt-calendar";

export interface ItemLine {
  name: string;
  qty: number;
  amount: number;
}

export interface WorldModel {
  generatedAt: string;
  companyId: string | null;
  window: { start: string; end: string };
  revenue: { total: number; orders: number; avgOrder: number | null; byStatus: Record<string, number> } | null;
  items: { lines: ItemLine[]; emptyOrders: number } | null;
  catalog: { products: number; roomSections: number; activeSections: number; productsMissingImage?: number } | null;
  visitors: {
    events7d: number;
    sessions7d: number;
    eventsPrev7d: number;
    topPaths: Array<{ path: string; count: number }>;
    adminEventsExcluded: number;
  } | null;
  goals: { active: number; overdue: number } | null;
  openProposals: number | null;
  openSuggestions: number | null;
  customerVoice: { sessions: number; sessionsLast7d: number } | null;
  season: { currentKey?: SeasonKey; currentName?: string; nextName?: string; nextStart?: string };
  coverage: string[];
  gaps: string[];
}

const DAY = 864e5;
const WINDOW_DAYS = 90;
const TTL_MS = 10 * 60 * 1000;
const MAX_ROWS = 1000;

type Count = { count: number | null; error: { message: string } | null };
type Rows<T> = { data: T[] | null; error: { message: string } | null };

const day = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

/**
 * Merge an order's `items` jsonb into product lines.
 * Real data uses `unit_price` and, on newer rows, a bare `price`; rows without
 * a usable name or a positive price are dropped rather than guessed at.
 */
export function summariseOrderItems(raw: unknown): ItemLine[] {
  if (!Array.isArray(raw)) return [];
  const byName = new Map<string, ItemLine>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const it = entry as Record<string, unknown>;
    const name = typeof it.name === "string" ? it.name.trim() : "";
    const price = num(it.unit_price ?? it.price ?? it.unitPrice);
    if (!name || price <= 0) continue;
    const qty = Math.max(1, Math.round(num(it.quantity) || 1));
    const prev = byName.get(name);
    if (prev) {
      prev.qty += qty;
      prev.amount += qty * price;
    } else {
      byName.set(name, { name, qty, amount: qty * price });
    }
  }
  return [...byName.values()].sort((a, b) => b.amount - a.amount);
}

async function readWorld(companyId: string, now: Date): Promise<Pick<WorldModel, "revenue" | "items" | "catalog" | "visitors" | "goals" | "openProposals" | "openSuggestions" | "customerVoice" | "coverage" | "gaps">> {
  const gaps: string[] = [];
  const coverage: string[] = [];
  const sb = supabaseServer;
  const winStart = new Date(now.getTime() - WINDOW_DAYS * DAY).toISOString();
  const d7 = new Date(now.getTime() - 7 * DAY).toISOString();
  const d14 = new Date(now.getTime() - 14 * DAY).toISOString();

  const ask = async <T>(label: string, run: () => PromiseLike<T | { data?: unknown; error?: unknown }>): Promise<T | null> => {
    try {
      const r = (await run()) as { data?: unknown; error?: { message: string } | null };
      if (r && r.error) {
        gaps.push(`${label} (${r.error.message})`);
        return null;
      }
      return r as T;
    } catch (e) {
      gaps.push(`${label} (${e instanceof Error ? e.message : "خطأ غير معروف"})`);
      return null;
    }
  };

  const [ordersRes, prodRes, prodImgRes, sectionsRes, sectionsOnRes, goalsRes, overdueRes, propRes, sugRes, vsRes, vs7Res, telRes, telPrevRes] = await Promise.all([
    ask<Rows<Record<string, unknown>>>("المبيعات", () =>
      sb.from("sales_orders").select("total_amount,status,items,company_id,created_at").gte("created_at", winStart).limit(MAX_ROWS)),
    ask<Count>("المنتجات", () => sb.from("products").select("id", { count: "exact", head: true })),
    ask<Count>("صور المنتجات", () => sb.from("products").select("id", { count: "exact", head: true }).is("featured_image_url", null)),
    ask<Count>("أقسام الغرف", () => sb.from("room_sections").select("id", { count: "exact", head: true })),
    ask<Count>("أقسام الغرف النشطة", () => sb.from("room_sections").select("id", { count: "exact", head: true }).eq("is_active", true)),
    ask<Count>("الأهداف النشطة", () => sb.from("qayyim_goals").select("id", { count: "exact", head: true }).eq("status", "active")),
    ask<Count>("أهداف تجاوزت موعدها", () => sb.from("qayyim_goals").select("id", { count: "exact", head: true }).eq("status", "active").lt("deadline", now.toISOString())),
    ask<Count>("أذونات بانتظار القرار", () => sb.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),
    ask<Count>("اقتراحات بانتظار القرار", () => sb.from("qayyim_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending")),
    ask<Count>("جلسات المستشار", () => sb.from("consultant_sessions").select("id", { count: "exact", head: true })),
    ask<Count>("جلسات المستشار (7 أيام)", () => sb.from("consultant_sessions").select("id", { count: "exact", head: true }).gte("updated_at", d7)),
    ask<Rows<Record<string, unknown>>>("حركة الزوار", () =>
      sb.from("visitor_telemetry").select("current_path,session_id,created_at").gte("created_at", d14).limit(MAX_ROWS)),
    ask<Count>("أحداث الأمس", () => sb.from("visitor_telemetry").select("id", { count: "exact", head: true }).gte("created_at", d14).lt("created_at", d7)),
  ]);

  let revenue: WorldModel["revenue"] = null;
  let items: WorldModel["items"] = null;
  if (ordersRes?.data) {
    const rows = ordersRes.data;
    const byStatus: Record<string, number> = {};
    let total = 0;
    let foreign = 0;
    let emptyOrders = 0;
    const lines: ItemLine[] = [];
    for (const r of rows) {
      total += num(r.total_amount);
      const st = typeof r.status === "string" ? r.status : "غير محدد";
      byStatus[st] = (byStatus[st] || 0) + 1;
      if (r.company_id !== companyId) foreign++;
      const orderLines = summariseOrderItems(r.items);
      if (!orderLines.length) emptyOrders++;
      lines.push(...orderLines);
    }
    const merged = summariseOrderItems(
      lines.map((l) => ({ name: l.name, quantity: l.qty, unit_price: l.amount / (l.qty || 1) }))
    );
    revenue = { total: Math.round(total), orders: rows.length, avgOrder: rows.length ? Math.round(total / rows.length) : null, byStatus };
    items = { lines: merged, emptyOrders };
    if (foreign) coverage.push(`${foreign} طلب من آخر ${WINDOW_DAYS} يوم بلا company_id مطابق — احتسبته لأن الدار واحدة`);
    if (rows.length >= MAX_ROWS) coverage.push(`اقتطعت عند ${MAX_ROWS} طلبًا — الأرقام أدنى من الحقيقة`);
  }

  let visitors: WorldModel["visitors"] = null;
  if (telRes?.data) {
    const publicRows = telRes.data.filter((r) => typeof r.current_path === "string" && !r.current_path.startsWith("/admin"));
    const adminEventsExcluded = telRes.data.length - publicRows.length;
    const in7 = publicRows.filter((r) => String(r.created_at) >= d7);
    const paths = new Map<string, number>();
    for (const r of in7) {
      const p = String(r.current_path);
      paths.set(p, (paths.get(p) || 0) + 1);
    }
    visitors = {
      events7d: in7.length,
      sessions7d: new Set(in7.map((r) => r.session_id).filter(Boolean)).size,
      eventsPrev7d: telPrevRes?.count ?? 0,
      topPaths: [...paths.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([path, count]) => ({ path, count })),
      adminEventsExcluded,
    };
    if (adminEventsExcluded) coverage.push(`${adminEventsExcluded} حدث خلال 14 يومًا من صفحات الإدارة — مستثنى من عدّاد الزوار`);
  }

  const catalog: WorldModel["catalog"] =
    prodRes && sectionsRes
      ? {
          products: prodRes.count ?? 0,
          roomSections: sectionsRes.count ?? 0,
          activeSections: sectionsOnRes?.count ?? 0,
          productsMissingImage: prodImgRes?.count ?? undefined,
        }
      : null;

  return {
    revenue,
    items,
    catalog,
    visitors,
    goals: goalsRes ? { active: goalsRes.count ?? 0, overdue: overdueRes?.count ?? 0 } : null,
    openProposals: propRes ? propRes.count ?? 0 : null,
    openSuggestions: sugRes ? sugRes.count ?? 0 : null,
    customerVoice: vsRes ? { sessions: vsRes.count ?? 0, sessionsLast7d: vs7Res?.count ?? 0 } : null,
    coverage,
    gaps,
  };
}

let cache: { key: string; at: number; promise: Promise<WorldModel> } | null = null;

export async function buildWorldModel(companyId: string | null, now: Date = new Date()): Promise<WorldModel> {
  const cur = currentSeason(now);
  const nxt = nextSeason(now);
  const base: WorldModel = {
    generatedAt: now.toISOString(),
    companyId,
    window: { start: day(new Date(now.getTime() - WINDOW_DAYS * DAY)), end: day(now) },
    revenue: null,
    items: null,
    catalog: null,
    visitors: null,
    goals: null,
    openProposals: null,
    openSuggestions: null,
    customerVoice: null,
    season: {
      currentKey: cur?.key as SeasonKey | undefined,
      currentName: cur?.name,
      nextName: nxt?.name,
      nextStart: nxt?.start,
    },
    coverage: [],
    gaps: [],
  };

  if (!companyId || !supabaseServer) {
    return { ...base, gaps: ["لم تُحدَّد شركة للجلسة (no company context) — أرقام الدار غير متاحة"] };
  }

  const key = companyId;
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.promise;
  const promise = readWorld(companyId, now).then((live) => ({ ...base, ...live }));
  cache = { key, at: Date.now(), promise };
  promise.catch(() => { if (cache?.key === key) cache = null; });
  return promise;
}

const money = (v: number) => `${v} ج.م`;

/** Compact Arabic brief that gets injected into the commander's prompt. */
export function renderWorldDigest(m: WorldModel): string {
  const L: string[] = [];
  L.push(`**عالم الدار الآن** — نافذة ${m.window.start} → ${m.window.end}`);
  if (m.revenue) {
    const st = Object.entries(m.revenue.byStatus).map(([k, v]) => `${k} ${v}`).join(" · ");
    L.push(`• المبيعات: ${money(m.revenue.total)} من ${m.revenue.orders} طلب${m.revenue.avgOrder ? ` (متوسط ${money(m.revenue.avgOrder)})` : ""}${st ? ` — الحالات: ${st}` : ""}`);
  }
  if (m.items) {
    const top = m.items.lines.slice(0, 3).map((l) => `${l.name} (${l.qty}× = ${money(l.amount)})`).join("؛ ");
    L.push(`• الأكثر مبيعًا: ${top || "لا أصناف مسجّلة داخل النافذة"}${m.items.emptyOrders ? ` — ${m.items.emptyOrders} طلب بلا أصناف مفصّلة` : ""}`);
    const worst = m.items.lines[m.items.lines.length - 1];
    if (m.items.lines.length > 2 && worst) L.push(`• الأضعف: ${worst.name} (${money(worst.amount)})`);
  }
  if (m.catalog) {
    const img = m.catalog.productsMissingImage ? `، ${m.catalog.productsMissingImage} بلا صورة رئيسية` : "";
    L.push(`• الكتالوج: ${m.catalog.products} منتج · ${m.catalog.roomSections} قسم غرفة (${m.catalog.activeSections} نشط)${img}`);
  }
  if (m.visitors) {
    const p = m.visitors.topPaths.map((x) => `${x.path} (${x.count})`).join("، ");
    L.push(`• الزوار (7 أيام): ${m.visitors.events7d} حدث من ${m.visitors.sessions7d} جلسة (كان ${m.visitors.eventsPrev7d} في الـ7 السابقة) — الأكثر: ${p || "لا بيانات"}`);
  }
  if (m.goals) L.push(`• الأهداف: ${m.goals.active} نشط${m.goals.overdue ? `، ${m.goals.overdue} تجاوز موعده` : ""}`);
  const waits = [m.openProposals, m.openSuggestions].filter((v): v is number => v !== null);
  if (waits.length) L.push(`• بانتظار قرارك: ${waits.reduce((a, b) => a + b, 0)} (أذونات ${m.openProposals} · اقتراحات ${m.openSuggestions})`);
  if (m.customerVoice) L.push(`• صوت العملاء: ${m.customerVoice.sessions} جلسة مستشار (${m.customerVoice.sessionsLast7d} آخر 7 أيام)`);
  L.push(
    `• الموسم: ${m.season.currentName ? `الآن ${m.season.currentName}` : "لا موسم تجزئة الآن"}${m.season.nextName ? ` · القادم: ${m.season.nextName} يبدأ ${m.season.nextStart}` : ""}`
  );
  if (m.coverage.length) L.push(`• دقة بياناتي: ${m.coverage.join("؛ ")}`);
  if (m.gaps.length) L.push(`• لم أستطع قراءة: ${m.gaps.join("؛ ")} — لا تعتبرها صفرًا.`);
  const out = L.filter(Boolean).join("\n");
  return out.length > 1200 ? `${out.slice(0, 1197)}…` : out;
}
