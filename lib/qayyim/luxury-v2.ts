import "server-only";
/**
 * Luxury Score v2 — مقاس، مش متخيَّل.
 *
 * The previous score came from an LLM being asked to rate how luxurious the
 * store feels. That number could not be reproduced, could not be audited, and
 * in the daily cron it silently returned `null` whenever the model phrased its
 * answer differently — a "green" round that measured nothing.
 *
 * This version only combines things a probe can actually read. Each signal is
 * mapped to 0..100, weighted, and the weights of unavailable signals are
 * redistributed rather than counted as zero — because "we could not read it"
 * must never look like "the store is bad at it". If nothing could be read, the
 * score is null and the reason is named.
 */
import { supabaseServer } from "@/lib/dal/unified-supabase";

export interface LuxurySignals {
  /** share of active products that have a main image (0..1) */
  imageCompleteness: number | null;
  /** share of active products with a visible price (0..1) */
  priceDisclosed: number | null;
  /** share of imagery carrying alt text (0..1) */
  altCoverage: number | null;
  /** best measured SEO score for the store's pages (0..100) */
  seoScore: number | null;
  /** p95 load time in ms across the public pages */
  loadP95Ms: number | null;
}

export interface SignalRow {
  key: keyof LuxurySignals;
  label: string;
  weight: number;
  value: number | null;
}

export interface LuxuryResult {
  score: number | null;
  breakdown: SignalRow[];
  missing: string[];
}

const WEIGHTS: Record<keyof LuxurySignals, number> = {
  imageCompleteness: 25,
  priceDisclosed: 15,
  altCoverage: 15,
  seoScore: 25,
  loadP95Ms: 20,
};

const LABELS: Record<keyof LuxurySignals, string> = {
  imageCompleteness: "اكتمال صور المنتجات",
  priceDisclosed: "إظهار السعر",
  altCoverage: "نصوص بديلة للصور",
  seoScore: "صحة SEO",
  loadP95Ms: "سرعة التحميل",
};

/** Core Web Vitals-shaped bands: fast under 1.5s, hopeless past 4s. */
export function loadScore(p95Ms: number | null): number | null {
  if (p95Ms === null || !Number.isFinite(p95Ms) || p95Ms <= 0) return null;
  if (p95Ms <= 1500) return 100;
  if (p95Ms >= 4000) return 0;
  return Math.round(((4000 - p95Ms) / 2500) * 100);
}

export function ratioScore(ratio: number | null): number | null {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function compositeLuxury(s: LuxurySignals): LuxuryResult {
  const breakdown: SignalRow[] = [
    { key: "imageCompleteness", label: LABELS.imageCompleteness, weight: WEIGHTS.imageCompleteness, value: ratioScore(s.imageCompleteness) },
    { key: "priceDisclosed", label: LABELS.priceDisclosed, weight: WEIGHTS.priceDisclosed, value: ratioScore(s.priceDisclosed) },
    { key: "altCoverage", label: LABELS.altCoverage, weight: WEIGHTS.altCoverage, value: ratioScore(s.altCoverage) },
    { key: "seoScore", label: LABELS.seoScore, weight: WEIGHTS.seoScore, value: s.seoScore === null || !Number.isFinite(s.seoScore) ? null : Math.max(0, Math.min(100, Math.round(s.seoScore))) },
    { key: "loadP95Ms", label: LABELS.loadP95Ms, weight: WEIGHTS.loadP95Ms, value: loadScore(s.loadP95Ms) },
  ];

  const measured = breakdown.filter((b) => b.value !== null);
  const weightSum = measured.reduce((a, b) => a + b.weight, 0);
  const missing = breakdown.filter((b) => b.value === null).map((b) => b.label);

  return {
    score: weightSum ? Math.round(measured.reduce((a, b) => a + b.weight * (b.value as number), 0) / weightSum) : null,
    breakdown,
    missing,
  };
}

/** Reads the signals that exist today; anything unreadable is returned as null. */
export async function measureSignals(companyId: string | null): Promise<LuxurySignals> {
  const out: LuxurySignals = { imageCompleteness: null, priceDisclosed: null, altCoverage: null, seoScore: null, loadP95Ms: null };
  if (!supabaseServer) return out;

  const active = companyId
    ? supabaseServer.from("products").select("featured_image_url,sale_price,is_active").eq("company_id", companyId).eq("is_active", true)
    : supabaseServer.from("products").select("featured_image_url,sale_price,is_active").eq("is_active", true);
  const { data: products } = await active;
  if (products && products.length) {
    const withImage = products.filter((p: any) => Boolean(p.featured_image_url)).length;
    const withPrice = products.filter((p: any) => p.sale_price !== null && p.sale_price !== undefined).length;
    out.imageCompleteness = withImage / products.length;
    out.priceDisclosed = withPrice / products.length;
  } else if (products) {
    out.imageCompleteness = null; // an empty catalogue is not "0% complete"
    out.priceDisclosed = null;
  }

  const seoQ = companyId
    ? supabaseServer.from("seo_analysis_results").select("score").eq("company_id", companyId).order("created_at", { ascending: false }).limit(10)
    : supabaseServer.from("seo_analysis_results").select("score").order("created_at", { ascending: false }).limit(10);
  const { data: seoRows } = await seoQ;
  const scores = (seoRows || []).map((r: any) => Number(r.score)).filter((n: number) => Number.isFinite(n));
  if (scores.length) out.seoScore = Math.max(...scores);

  // A deliberately light probe: the score must not turn into a load test.
  try {
    const { runLoadProbe } = await import("@/lib/qayyim/qa/realChecks");
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://azenith-living.vercel.app";
    const probe = await runLoadProbe(
      base,
      [
        { name: "home", path: "/", method: "GET" },
        { name: "rooms", path: "/rooms", method: "GET" },
      ],
      { concurrency: 2, totalRequests: 6 }
    );
    if (Number.isFinite(probe.p95Ms)) out.loadP95Ms = probe.p95Ms;
  } catch {
    /* probe failed — reported as a missing signal, never as a slow site */
  }

  // alt coverage is counted on the real homepage markup
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "https://azenith-living.vercel.app";
    const html = await (await fetch(`${base}/`, { signal: AbortSignal.timeout(15_000) })).text();
    const cheerio = await import("cheerio");
    const $ = cheerio.load(html);
    const imgs = $("img");
    let withAlt = 0;
    imgs.each((_, el) => {
      const alt = $(el).attr("alt")?.trim();
      if (alt) withAlt++;
    });
    if (imgs.length) out.altCoverage = withAlt / imgs.length;
  } catch {
    /* unreadable page — altCoverage stays null */
  }

  return out;
}

export function renderLuxury(r: LuxuryResult, s: LuxurySignals): string {
  if (r.score === null) return "لم أستطع قياس أي إشارة من إشارات الفخامة — لن أعطي رقمًا من عندي.";
  const lines = r.breakdown
    .filter((b) => b.value !== null)
    .map((b) => `• ${b.label}: ${b.value}/100 (وزن ${b.weight})`);
  const missing = r.missing.length ? `\n• إشارات غير متاحة الآن: ${r.missing.join("، ")} (وزنها أُعيد توزيعته)` : "";
  const rawLoad = s.loadP95Ms === null ? "" : ` — p95 = ${Math.round(s.loadP95Ms)}ms`;
  return `Luxury Score مقاسة: ${r.score}/100${rawLoad}\n${lines.join("\n")}${missing}`;
}

/** Single entry point for the chat tool and the daily round. */
export async function runLuxuryScore(companyId: string | null): Promise<{
  luxury_score: number | null;
  signals: LuxurySignals;
  missing: string[];
  message: string;
}> {
  const signals = await measureSignals(companyId);
  const result = compositeLuxury(signals);
  return {
    luxury_score: result.score,
    signals,
    missing: result.missing,
    message: renderLuxury(result, signals),
  };
}
