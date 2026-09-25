/**
 * P6-M3 — the forecast. «جيب الشهر الجاي بكم؟» answered with Holt-Winters over
 * the shop's real order history, together with the error that model actually
 * makes on that history.
 *
 * Split so the arithmetic and the Arabic sentence are testable without a
 * database: `dailyRevenueSeries` → `forecastFromSeries` → `renderForecast` are
 * pure, and only `runRevenueForecast` reads `sales_orders`.
 *
 * A forecast that cannot be wrong is not worth reading, so every result carries
 * its MAPE and a caveat line, and a flat empty history is refused outright
 * instead of being extrapolated into a confident number.
 */
import "server-only";

import { supabaseServer } from "@/lib/dal/unified-supabase";
import { storeIdFilter } from "@/lib/company-scope";
import { holtWinters, meanAbsolutePercentageError, type ForecastMethod } from "./stats";

export interface OrderRow {
  created_at: string;
  total_amount: number | null;
}

export interface ForecastPoint {
  date: string;
  value: number;
}

export interface ForecastSummary {
  refused: boolean;
  /** Why no number was produced — populated only when `refused`. */
  reason: string | null;
  method: ForecastMethod;
  seasonLength: number;
  points: ForecastPoint[];
  total: number;
  /** Mean absolute percentage error of one-step fits on the history. */
  mape: number | null;
  /** Honest self-score: fit on the earlier days, then predict the last few and
   * compare with what actually happened. Null when the history is too short to
   * spare any days — an in-sample error flatters the model that produced it. */
  backtest: { days: number; mape: number | null } | null;
  caveats: string[];
  /** Days in the window that actually had a sale. */
  activeDays: number;
  history: { days: number; total: number; from: string; to: string };
  horizonDays: number;
  currency: string;
}

const DAY_MS = 86_400_000;

/** Selling days a window needs before a "pattern" exists to extrapolate.
 * Anything looser and a seasonal model just repeats one good day forever. */
const MIN_SELLING_DAYS = 6;

function dateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function startOfDayUtc(key: string): number {
  return Date.parse(`${key}T00:00:00.000Z`);
}

const num = (x: number) => Math.round(x).toLocaleString("en-US");

/**
 * Daily revenue over a fixed window, with empty days present as 0.
 *
 * The zero-fill matters: a model fed only the days that had orders learns a
 * three-day week and forecasts a month from it.
 */
export function dailyRevenueSeries(
  rows: OrderRow[],
  opts: { days: number; endDate: Date },
): { dates: string[]; values: number[] } {
  const days = Math.max(1, Math.floor(opts.days));
  const lastDay = startOfDayUtc(dateKey(opts.endDate.getTime()));
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(dateKey(lastDay - i * DAY_MS));

  const totals = new Map<string, number>(dates.map((d) => [d, 0]));
  for (const row of rows) {
    const at = Date.parse(row.created_at);
    if (!Number.isFinite(at)) continue;
    const key = dateKey(at);
    if (!totals.has(key)) continue;
    const amount = Number.isFinite(row.total_amount ?? NaN) ? (row.total_amount as number) : 0;
    totals.set(key, (totals.get(key) as number) + amount);
  }

  return { dates, values: dates.map((d) => totals.get(d) as number) };
}

/**
 * Holt-Winters with a weekly shape, falling back to whatever `stats.ts` can
 * honestly do with the history it was given.
 */
export function forecastFromSeries(
  values: number[],
  opts: { horizon: number; endDate: Date; seasonLength?: number },
): ForecastSummary {
  const seasonLength = opts.seasonLength ?? 7;
  const horizon = Math.max(1, Math.floor(opts.horizon));
  const historyTotal = values.reduce((a, b) => a + b, 0);
  const activeDays = values.filter((v) => v > 0).length;
  const fromKey = dateKey(opts.endDate.getTime() - (values.length - 1) * DAY_MS);
  const base: ForecastSummary = {
    refused: false,
    reason: null,
    method: "insufficient-data",
    seasonLength: 1,
    points: [],
    total: 0,
    mape: null,
    backtest: null,
    caveats: [],
    activeDays,
    history: { days: values.length, total: historyTotal, from: fromKey, to: dateKey(opts.endDate.getTime()) },
    horizonDays: horizon,
    currency: "ج.م",
  };

  if (values.length < 2) {
    return { ...base, refused: true, reason: "المبيعات المسجلة أقل من يومين، فمفيش مسار يتبني عليه توقع." };
  }
  if (historyTotal <= 0) {
    return { ...base, refused: true, reason: "مفيش أي مبيعات مسجلة في المدة دي — الرقم اللي يطلع يكون اختراع." };
  }

  // A seasonal model repeats what it learns. Teach it a window where two days
  // out of ninety sold, and it will cheerfully forecast those two days every
  // week and hand back a month inflated by an order of magnitude — which is the
  // exact way a confident wrong number reaches an owner. Below this many selling
  // days there is no shape to learn, so it says so.
  if (activeDays < MIN_SELLING_DAYS) {
    return {
      ...base,
      refused: true,
      reason: `السجل فيه ${activeDays} يوم بيع بس من أصل ${values.length} — أقل من ${MIN_SELLING_DAYS} يوم، والنمط اللي يتبني عليه توقع مش موجود.`,
    };
  }

  // The horizon arrives from a tool call, i.e. from a model that can ask for
  // anything. A year projected out of a quarter is a slope compounded 365 times.
  if (horizon > values.length) {
    return {
      ...base,
      refused: true,
      reason: `توقع ${horizon} يوم محتاج تاريخ أطول منه، والمسجل ${values.length} يوم. اطلب مدة أقصر أو استنى سجل أكتر.`,
    };
  }

  const f = holtWinters(values, { seasonLength, horizon });
  const start = startOfDayUtc(base.history.to);
  const points: ForecastPoint[] = f.forecast.map((value, i) => ({
    date: dateKey(start + (i + 1) * DAY_MS),
    // Revenue cannot be negative; a model drifting below zero says the history
    // was too short or too jagged to trust, which the caveats already say.
    value: Math.max(0, value),
  }));

  const caveats: string[] = [`الحساب مبني على ${values.length} يوم من الطلبات الفعلية (من ${base.history.from} إلى ${base.history.to}).`];
  if (f.method === "double-exponential") {
    caveats.push("الماضي أقصر من أسبوعين كاملين — الحساب غير موسمي (اتجاه وبس).");
  }

  // Self-score the honest way: hide the last week, predict it from what came
  // before, and compare. The in-sample error below is reported only as a
  // fallback, because a model graded on the days it was fitted to always looks
  // better than it is.
  const holdDays = Math.min(seasonLength, Math.floor(values.length / 3));
  const backtest: ForecastSummary["backtest"] =
    holdDays >= 4 && values.length - holdDays >= 2 * seasonLength
      ? {
          days: holdDays,
          mape: meanAbsolutePercentageError(
            values.slice(values.length - holdDays),
            holtWinters(values.slice(0, values.length - holdDays), { seasonLength, horizon: holdDays }).forecast,
          ),
        }
      : null;

  if (backtest && backtest.mape !== null) {
    caveats.push(`اختبار حقيقي: توقعنا آخر ${backtest.days} يوم من اللي قبلهم، والخطأ المتوسط ${Math.round(backtest.mape * 10) / 10}%.`);
  } else if (f.mape === null) {
    caveats.push("دقة النموذج على الماضي مش مقاسة — أيام المدة كانت صفر أغلبها.");
  } else if (f.mape > 25) {
    caveats.push(`دقة النموذج على الماضي ضعيفة (خطأ متوسط ${Math.round(f.mape)}%) — الرقم للتقدير مش للتعهد.`);
  } else {
    caveats.push(`خطأ النموذج على الماضي: متوسط ${Math.round(f.mape * 10) / 10}%.`);
  }

  return {
    ...base,
    method: f.method,
    seasonLength: f.seasonLength,
    points,
    total: points.reduce((a, p) => a + p.value, 0),
    mape: f.mape,
    backtest,
    caveats,
  };
}

/** The Arabic answer. Dates stay ISO so they can be copied into a sheet. */
export function renderForecast(f: ForecastSummary): string {
  if (f.refused) {
    return `مش قادر أديك رقم: ${f.reason}\nالسبب ده بيتحل لما تتسجل طلبات فعلية في الدفتر.`;
  }

  const lines: string[] = [];
  lines.push(`توقع ${f.horizonDays} يوم (من ${f.points[0].date} إلى ${f.points[f.points.length - 1].date}):`);
  lines.push(`• الإجمالي المتوقع: ${num(f.total)} ${f.currency}`);
  lines.push(`• متوسط اليوم: ${num(f.total / f.points.length)} ${f.currency}`);

  const peak = f.points.reduce((best, p) => (p.value > best.value ? p : best), f.points[0]);
  lines.push(`• أعلى يوم متوقع: ${peak.date} بـ ${num(peak.value)} ${f.currency}`);
  lines.push(
    `• آخر ${f.history.days} يوم: ${num(f.history.total)} ${f.currency} — ده الأساس اللي اتعلمت منه.`
  );
  lines.push(f.caveats.map((c) => `• ${c}`).join("\n"));
  return lines.join("\n");
}

/** How many orders a single read pulls — the storefront has thousands of rows. */
const MAX_ORDER_ROWS = 5_000;

/**
 * Live forecast for one company: read the order history, hand it to the pure
 * functions above. A failed read is reported as a refusal with the DB message
 * rather than becoming "no sales".
 */
export async function runRevenueForecast(
  companyId: string | null,
  opts: { horizonDays?: number; historyDays?: number } = {},
): Promise<ForecastSummary> {
  const horizonDays = opts.horizonDays ?? 30;
  const historyDays = opts.historyDays ?? 90;
  const endDate = new Date();

  const empty = forecastFromSeries([], { horizon: horizonDays, endDate });
  if (!companyId || !supabaseServer) {
    return { ...empty, refused: true, reason: "مفيش شركة محددة عشان أقرأ منها الطلبات." };
  }

  const from = new Date(endDate.getTime() - (historyDays + 2) * DAY_MS).toISOString();
  const ids = storeIdFilter(companyId);
  let query = supabaseServer
    .from("sales_orders")
    .select("created_at,total_amount")
    .gte("created_at", from)
    .limit(MAX_ORDER_ROWS);
  if (ids) query = query.in("company_id", ids);

  const { data, error } = await query;
  if (error) {
    return { ...empty, refused: true, reason: `قرأتش الطلبات من الدفتر: ${error.message}` };
  }

  const rows: OrderRow[] = (data || []).map((r: { created_at: string; total_amount: number | null }) => ({
    created_at: r.created_at,
    total_amount: r.total_amount,
  }));
  if (rows.length >= MAX_ORDER_ROWS) {
    // PostgREST silently stops at the cap; a truncated window would read as a
    // collapsing month, so say so instead of forecasting the truncation.
    const f = forecastFromSeries(dailyRevenueSeries(rows, { days: historyDays, endDate }).values, {
      horizon: horizonDays,
      endDate,
    });
    return { ...f, caveats: [...f.caveats, `النافذة فيها ${MAX_ORDER_ROWS} طلب أو أكثر — الرقم اتحسب على اللي قريناه بس.`] };
  }

  const { values } = dailyRevenueSeries(rows, { days: historyDays, endDate });
  return forecastFromSeries(values, { horizon: horizonDays, endDate });
}
