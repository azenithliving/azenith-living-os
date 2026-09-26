import "server-only";
/**
 * عيون على السوق — the competitor watch.
 *
 * Politeness is not optional here, it is the whole design:
 *  • robots.txt is read first and honoured (longest matching rule wins, and an
 *    `Allow` beats a shorter `Disallow`);
 *  • a run visits at most `maxPages` pages per rival with a delay between hits;
 *  • only public page FACTS are stored (counts of visible prices, product
 *    links, image signals) — never scraped copy, never personal data.
 *
 * Everything network-facing takes an injectable `fetchImpl`, so the rules above
 * are unit-tested without ever touching a real competitor.
 */
import * as cheerio from "cheerio";
import { supabaseServer } from "@/lib/dal/unified-supabase";

export interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelay?: number;
}

export interface RivalSignals {
  pagesExamined: number;
  title: string | null;
  h1Count: number;
  productLinks: number;
  visiblePrices: number;
  priceCurrencies: string[];
  whatsapp: boolean;
  gallerySignals: number;
  textWords: number;
}

export interface RivalRow {
  id: string;
  name: string;
  url: string;
  enabled?: boolean;
}

export interface CrawlOutcome {
  status: "completed" | "blocked_by_robots" | "failed";
  pagesCrawled: number;
  summary?: RivalSignals;
  error?: string;
}

const ASSET = /\.(jpg|jpeg|png|webp|gif|svg|avif|css|js|mjs|pdf|zip|gz|webp|mp4|webm|woff2?|ttf|ico)$/i;
const PRICE_RE = /(\d[\d.,]{1,12})\s*(ج\.?م|جنيه|EGP|LE|درهم|د\.إ|ر\.س|\$|€|£)/gi;
const PRODUCT_HINT = /(product|shop|collection|catalog|item|bag|sofa|chair|bed|room|غرفة|صالون|كنبة|منتج|تشكيل)/i;
const UA = "QayyimBot/1.0 (+https://azenith-living.vercel.app/admin/v2/agents)";

export function parseRobots(text: string): RobotsRules {
  const rules: RobotsRules = { disallow: [], allow: [] };
  let applies = false;
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === "user-agent") {
      applies = value === "*";
      continue;
    }
    if (!applies) continue;
    if (field === "disallow" && value) rules.disallow.push(value);
    if (field === "allow" && value) rules.allow.push(value);
    if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) rules.crawlDelay = n;
    }
  }
  return rules;
}

/** Longest matching prefix decides; a tie resolves in favour of `Allow`. */
export function isAllowedByRobots(rules: RobotsRules, absoluteUrl: string): boolean {
  let path: string;
  try {
    path = new URL(absoluteUrl).pathname + new URL(absoluteUrl).search;
  } catch {
    return false;
  }
  let best = { len: -1, allowed: true };
  for (const [rule, allowed] of [
    ...rules.allow.map((r): [string, boolean] => [r, true]),
    ...rules.disallow.map((r): [string, boolean] => [r, false]),
  ]) {
    if (path.startsWith(rule) && rule.length > best.len) best = { len: rule.length, allowed };
  }
  return best.allowed;
}

export function collectInternalLinks(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const origin = new URL(base).origin;
  const seen = new Set<string>();
  const out: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (u.origin !== origin) return;
    if (ASSET.test(u.pathname)) return;
    u.hash = "";
    const norm = u.pathname.replace(/\/+$/, "") + u.search;
    if (!norm) return;
    const key = origin + norm;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
}

export function extractSignals(html: string): RivalSignals {
  const $ = cheerio.load(html);
  const text = $("body").text() || $.root().text() || "";
  const currencies = new Set<string>();
  for (const m of text.matchAll(PRICE_RE)) currencies.add(m[2]);
  let productLinks = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (PRODUCT_HINT.test(href) || PRODUCT_HINT.test($(el).text())) productLinks++;
  });
  return {
    pagesExamined: 1,
    title: $("title").first().text().trim() || null,
    h1Count: $("h1").length,
    productLinks,
    visiblePrices: [...text.matchAll(PRICE_RE)].length,
    priceCurrencies: [...currencies],
    whatsapp: /wa\.me|api\.whatsapp\.com|whatsapp/i.test(html),
    gallerySignals: $("img").length,
    textWords: (text.match(/\S+/g) || []).length,
  };
}

const sum = (a: RivalSignals, b: RivalSignals): RivalSignals => ({
  pagesExamined: a.pagesExamined + b.pagesExamined,
  title: a.title ?? b.title,
  h1Count: a.h1Count + b.h1Count,
  productLinks: a.productLinks + b.productLinks,
  visiblePrices: a.visiblePrices + b.visiblePrices,
  priceCurrencies: [...new Set([...a.priceCurrencies, ...b.priceCurrencies])],
  whatsapp: a.whatsapp || b.whatsapp,
  gallerySignals: a.gallerySignals + b.gallerySignals,
  textWords: a.textWords + b.textWords,
});

const EMPTY: RivalSignals = {
  pagesExamined: 0,
  title: null,
  h1Count: 0,
  productLinks: 0,
  visiblePrices: 0,
  priceCurrencies: [],
  whatsapp: false,
  gallerySignals: 0,
  textWords: 0,
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getText(fetchImpl: typeof fetch, url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const text = res.ok ? await res.text().catch(() => "") : "";
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  }
}

export async function crawlRival(
  rival: RivalRow,
  opts: { fetchImpl?: typeof fetch; maxPages?: number; robots?: boolean; delayMs?: number } = {}
): Promise<CrawlOutcome> {
  const doFetch = opts.fetchImpl ?? fetch;
  const maxPages = Math.max(1, Math.min(opts.maxPages ?? 10, 25));
  let origin: URL;
  try {
    origin = new URL(rival.url);
  } catch {
    return { status: "failed", pagesCrawled: 0, error: `رابط غير صالح: ${rival.url}` };
  }

  let rules: RobotsRules = { disallow: [], allow: [] };
  if (opts.robots !== false) {
    const robots = await getText(doFetch, `${origin.origin}/robots.txt`);
    if (robots.ok) rules = parseRobots(robots.text);
    // A missing/unreadable robots.txt is permission, not a wall.
  }
  const delay = Math.max(opts.delayMs ?? 1200, (rules.crawlDelay ?? 0) * 1000);

  const queue = [origin.origin + (origin.pathname === "/" ? "" : origin.pathname)];
  const visited = new Set<string>();
  let acc = EMPTY;
  let firstError = "";

  while (queue.length && acc.pagesExamined < maxPages) {
    const url = queue.shift() as string;
    if (visited.has(url)) continue;
    if (!isAllowedByRobots(rules, url)) {
      if (acc.pagesExamined === 0) return { status: "blocked_by_robots", pagesCrawled: 0 };
      continue;
    }
    visited.add(url);
    if (acc.pagesExamined > 0 && delay) await wait(delay);
    const page = await getText(doFetch, url);
    if (!page.ok) {
      if (!firstError) firstError = `HTTP ${page.status || "غير متاح"}`;
      if (acc.pagesExamined === 0) return { status: "failed", pagesCrawled: 0, error: firstError };
      continue;
    }
    acc = sum(acc, extractSignals(page.text));
    for (const link of collectInternalLinks(page.text, url)) {
      if (!visited.has(link) && queue.length < 60) queue.push(link);
    }
  }

  if (acc.pagesExamined === 0) {
    return { status: "failed", pagesCrawled: 0, error: firstError || "لم تُفتح أي صفحة" };
  }
  return { status: "completed", pagesCrawled: acc.pagesExamined, summary: acc };
}

const delta = (label: string, from: number, to: number) => (to === from ? null : `${to > from ? "+" : "−"}${Math.abs(to - from)} ${label}`);

/** Rivals the time budget could not reach — named, never quietly omitted. */
export function skippedNote(skipped: string[]): string {
  if (!skipped.length) return "";
  return `⏳ لم أقيس هذا الأسبوع (انتهى وقت الدالة قبلهم): ${skipped.join("، ")} — سيُقاسون في الجولة القادمة.`;
}

export function diffSignals(prev: RivalSignals | null, cur: RivalSignals): string[] {
  if (!prev) return [`أول قياس — أساس للمقارنة القادمة (${cur.pagesExamined} صفحة)`];
  const out = [
    delta("رابط منتج", prev.productLinks, cur.productLinks),
    delta("سعر ظاهر", prev.visiblePrices, cur.visiblePrices),
    delta("صورة", prev.gallerySignals, cur.gallerySignals),
    delta("كلمة", prev.textWords, cur.textWords),
  ].filter(Boolean) as string[];
  if (prev.whatsapp !== cur.whatsapp) out.push(cur.whatsapp ? "أضاف واتساب" : "حذف الواتساب");
  const newCur = cur.priceCurrencies.filter((c) => !prev.priceCurrencies.includes(c));
  if (newCur.length) out.push(`عملة جديدة: ${newCur.join("، ")}`);
  return out;
}

export interface RivalDigestEntry {
  name: string;
  url: string;
  crawledAt: string;
  status: string;
  error?: string | null;
  signals?: RivalSignals | null;
  changes?: string[];
}

export function renderRivalsDigest(entries: RivalDigestEntry[]): string {
  if (!entries.length) {
    return [
      "مضفتش أي منافس لحد دلوقتي — عيني على السوق مقفولة.",
      "التفعيل: ضيف سطر لكل منافس فيه اسمه ورابط موقعه، في الدفتر ده:",
      "qayyim_rivals",
      "وأنا أقيسه كل اثنين بهدوء، باحترام قواعد الموقع وعلى 10 صفحات كحد أقصى.",
      "بعدها أقارن بالأرقام: عدد المنتجات، والأسعار الظاهرة، ووجود واتساب، وحجم المحتوى.",
    ].join("\n");
  }
  const lines = [`مراقبة المنافسين — ${entries.length} منافس، آخر قياس ${entries[0].crawledAt.slice(0, 10)}:`];
  for (const e of entries) {
    if (e.status !== "completed" || !e.signals) {
      lines.push(`• ${e.name}: تعذّر القياس (${e.error || e.status}) — لا أستنتج عنه شيئا.`);
      continue;
    }
    const s = e.signals;
    lines.push(
      `• ${e.name} (${s.pagesExamined} صفحة): ${s.productLinks} رابط منتج · ${s.visiblePrices} سعر ظاهر${s.whatsapp ? " · واتساب" : ""}${s.priceCurrencies.length ? ` · عملات: ${s.priceCurrencies.join("/")}` : ""}`
    );
    if (e.changes?.length) lines.push(`   تغيّر عن الأسبوع الماضي: ${e.changes.join("، ")}`);
  }
  lines.push("الأرقام من صفحاتهم العامة، مقروءة باحترام لملف القواعد بتاعهم — لا نسخ ولا بيانات أشخاص.");
  return lines.join("\n");
}

export async function listRivals(companyId: string): Promise<RivalRow[]> {
  if (!supabaseServer) return [];
  const { data, error } = await supabaseServer
    .from("qayyim_rivals")
    .select("id,name,url,enabled")
    .eq("company_id", companyId)
    .eq("enabled", true)
    .order("name");
  if (error) throw new Error(error.message);
  return (data || []) as RivalRow[];
}

/**
 * One polite weekly pass: crawl each enabled rival, store, and diff vs previous.
 *
 * `budgetMs` exists because this runs inside a 60-second serverless function:
 * crawling is bounded by time, and rivals left unmeasured are NAMED rather than
 * silently dropped, so the digest never implies full coverage.
 */
export async function runRivalsWeekly(
  companyId: string,
  opts: { budgetMs?: number; maxPagesPerRival?: number } = {}
): Promise<{ crawled: number; failed: number; digest: string; errors: string[]; skipped: string[] }> {
  const budgetMs = opts.budgetMs ?? 45_000;
  const startedAt = Date.now();
  if (!supabaseServer) return { crawled: 0, failed: 0, digest: renderRivalsDigest([]), errors: ["لا يوجد اتصال بقاعدة البيانات"], skipped: [] };
  const errors: string[] = [];
  const skipped: string[] = [];
  let rivals: RivalRow[] = [];
  try {
    rivals = await listRivals(companyId);
  } catch (e) {
    return {
      crawled: 0,
      failed: 0,
      digest: `لم أستطع قراءة جدول المنافسين: ${e instanceof Error ? e.message : "خطأ"} — غالباً هجرة P6-M2 (20260925_p6_rivals.sql) لم تُطبَّق بعد.`,
      errors: [`فشل قراءة المنافسين: ${e instanceof Error ? e.message : "خطأ"}`],
      skipped: [],
    };
  }
  if (!rivals.length) return { crawled: 0, failed: 0, digest: renderRivalsDigest([]), errors: [], skipped: [] };

  const entries: RivalDigestEntry[] = [];
  let crawled = 0;
  let failed = 0;
  for (const rival of rivals) {
    if (Date.now() - startedAt > budgetMs) {
      skipped.push(rival.name);
      continue;
    }
    let prev: RivalSignals | null = null;
    const { data: prevRow } = await supabaseServer
      .from("qayyim_rival_snapshots")
      .select("summary,crawled_at,status")
      .eq("rival_id", rival.id)
      .eq("status", "completed")
      .order("crawled_at", { ascending: false })
      .limit(1);
    if (prevRow?.[0]?.summary) prev = prevRow[0].summary as RivalSignals;

    const outcome = await crawlRival(rival, { maxPages: opts.maxPagesPerRival ?? 6 });
    await supabaseServer.from("qayyim_rival_snapshots").insert({
      rival_id: rival.id,
      company_id: companyId,
      status: outcome.status,
      error: outcome.error ?? null,
      pages_crawled: outcome.pagesCrawled,
      summary: outcome.summary ?? null,
    });
    if (outcome.status === "completed" && outcome.summary) {
      crawled++;
      entries.push({
        name: rival.name,
        url: rival.url,
        crawledAt: new Date().toISOString(),
        status: outcome.status,
        signals: outcome.summary,
        changes: diffSignals(prev, outcome.summary),
      });
    } else {
      failed++;
      errors.push(`${rival.name}: ${outcome.error || outcome.status}`);
      entries.push({ name: rival.name, url: rival.url, crawledAt: new Date().toISOString(), status: outcome.status, error: outcome.error ?? null });
    }
  }
  let digest = renderRivalsDigest(entries);
  const skip = skippedNote(skipped);
  if (skip) digest += `\n${skip}`;
  return { crawled, failed, digest, errors, skipped };
}

/** Latest stored snapshot per rival — what the `ops_rivals` tool answers with. */
export async function latestRivalDigest(companyId: string): Promise<string> {
  if (!supabaseServer) return renderRivalsDigest([]);
  let rivals: RivalRow[] = [];
  try {
    rivals = await listRivals(companyId);
  } catch (e) {
    return `لم أستطع قراءة جدول المنافسين: ${e instanceof Error ? e.message : "خطأ"} — غالباً هجرة P6-M2 (20260925_p6_rivals.sql) لم تُطبَّق على القاعدة بعد.`;
  }
  const entries: RivalDigestEntry[] = [];
  for (const rival of rivals) {
    const { data } = await supabaseServer
      .from("qayyim_rival_snapshots")
      .select("summary,crawled_at,status,error")
      .eq("rival_id", rival.id)
      .order("crawled_at", { ascending: false })
      .limit(1);
    const row = data?.[0] as { summary: unknown; crawled_at: string; status: string; error: string | null } | undefined;
    if (!row) {
      entries.push({ name: rival.name, url: rival.url, crawledAt: new Date(0).toISOString(), status: "never_crawled" });
      continue;
    }
    entries.push({
      name: rival.name,
      url: rival.url,
      crawledAt: row.crawled_at,
      status: row.status,
      error: row.error,
      signals: (row.summary as RivalSignals) ?? null,
    });
  }
  if (!entries.length) return renderRivalsDigest([]);
  const withSignals = entries.filter((e) => e.signals);
  if (withSignals.length && withSignals.every((e) => new Date(e.crawledAt).getTime() < Date.now() - 8 * 864e5)) {
    return renderRivalsDigest(entries) + "\n⚠️ آخر قياس أقدم من أسبوع — الكرون الأسبوعي لم يعمل أو لا منافسين مفعّلين.";
  }
  return renderRivalsDigest(entries);
}
