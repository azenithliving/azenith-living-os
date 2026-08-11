/**
/**
 * admin-live-browser-cloud.ts
 *
 * Cloud browser fallback — يعمل على Vercel/Netlify serverless بدون Playwright binary.
 * طبقات الـ fallback بالترتيب:
 *   1. Jina.ai Reader API  — مجاني تماماً بدون key، يُشغّل JS ويُعيد markdown نظيف
 *   2. Browserless.io      — لو BROWSERLESS_TOKEN موجود
 *   3. Direct fetch        — HTML خام كآخر خيار
 */

export type CloudBrowserSource = "jina_reader" | "browserless" | "direct_fetch";

export interface CloudPageResult {
  url: string;
  title: string;
  text: string;
  links: Array<{ text: string; href: string }>;
  screenshotBase64?: string;
  source: CloudBrowserSource;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getBrowserlessEndpoint(): string | null {
  const token = process.env.BROWSERLESS_TOKEN;
  const base  = process.env.BROWSERLESS_URL || "https://production-sfo.browserless.io";
  if (!token) return null;
  return `${base.replace(/\/$/, "")}/content?token=${token}`;
}

// ── Jina.ai Reader API (مجاني تماماً — الأولوية الأولى) ─────────────────────

async function fetchViaJina(url: string): Promise<CloudPageResult> {
  // Jina Reader يُحوّل أي URL إلى نص markdown نظيف، يُشغّل JS، مجاني بدون key
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      "Accept": "text/plain",
      "X-Return-Format": "markdown",
      "X-Timeout": "15",
    },
    signal: AbortSignal.timeout(18_000),
  });

  if (!res.ok) throw new Error(`Jina ${res.status}: ${res.statusText}`);

  const markdown = await res.text();

  // استخراج العنوان من أول سطر markdown
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? url;

  // استخراج الروابط من markdown [text](href)
  const links: Array<{ text: string; href: string }> = [];
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(markdown)) !== null && links.length < 60) {
    links.push({ text: m[1].trim().slice(0, 100), href: m[2] });
  }

  // نظّف الـ markdown من syntax symbols للحصول على نص مقروء
  const text = markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 8000);

  return { url, title, text, links, source: "jina_reader" };
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed === "about:blank") return "about:blank";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 8000);
}

function extractLinksFromHtml(html: string, baseUrl: string): Array<{ text: string; href: string }> {
  const links: Array<{ text: string; href: string }> = [];
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && links.length < 60) {
    const href = match[1].trim();
    const text = match[2].replace(/<[^>]+>/g, "").trim().slice(0, 100);
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      const abs = href.startsWith("http") ? href : new URL(href, baseUrl).toString();
      if (/^https?:\/\//i.test(abs)) links.push({ text, href: abs });
    } catch { /* invalid URL */ }
  }
  return links;
}

function extractTitleFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

// ── Browserless v2 content API ────────────────────────────────────────────────

async function fetchViaBrowserless(url: string): Promise<CloudPageResult> {
  const endpoint = getBrowserlessEndpoint()!;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      waitFor: 1500,
      rejectResourceTypes: ["image", "font", "media"],
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    throw new Error(`Browserless ${res.status}: ${res.statusText}`);
  }

  const html = await res.text();
  const title = extractTitleFromHtml(html);
  const text  = extractTextFromHtml(html);
  const links = extractLinksFromHtml(html, url);

  return { url, title, text, links, source: "browserless" };
}

// ── Direct fetch fallback (no JS rendering) ───────────────────────────────────

async function fetchDirect(url: string): Promise<CloudPageResult> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AzenithBot/1.0; +https://azenithliving.com)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ar,en;q=0.9",
    },
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("html") && !contentType.includes("text")) {
    return { url: res.url, title: "", text: `[binary content: ${contentType}]`, links: [], source: "direct_fetch" };
  }

  const html  = await res.text();
  const title = extractTitleFromHtml(html);
  const text  = extractTextFromHtml(html);
  const links = extractLinksFromHtml(html, res.url);

  return { url: res.url, title, text, links, source: "direct_fetch" };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * يجلب صفحة ويب بأفضل طريقة متاحة:
 * 1. Jina.ai Reader   — مجاني تماماً، يُشغّل JS، أفضل جودة
 * 2. Browserless API  — لو TOKEN موجود
 * 3. Direct fetch     — HTML خام كآخر خيار
 */
export async function cloudFetchPage(url: string): Promise<CloudPageResult> {
  const normalized = normalizeUrl(url);
  if (normalized === "about:blank") {
    return { url: "about:blank", title: "", text: "", links: [], source: "direct_fetch" };
  }

  // ── Tier 1: Jina.ai Reader (مجاني دائماً) ──────────────────────────
  try {
    return await fetchViaJina(normalized);
  } catch (jinaErr) {
    console.warn("[cloud-browser] Jina failed:", jinaErr instanceof Error ? jinaErr.message : jinaErr);
  }

  // ── Tier 2: Browserless (لو token موجود) ───────────────────────────
  if (getBrowserlessEndpoint()) {
    try {
      return await fetchViaBrowserless(normalized);
    } catch (blessErr) {
      console.warn("[cloud-browser] Browserless failed:", blessErr instanceof Error ? blessErr.message : blessErr);
    }
  }

  // ── Tier 3: Direct fetch ───────────────────────────────────────────
  return await fetchDirect(normalized);
}

/**
 * هل المتصفح السحابي متاح؟ (للإظهار في الـ UI)
 */
export function isCloudBrowserAvailable(): boolean {
  return !!getBrowserlessEndpoint();
}

/**
 * بحث سحابي: يبحث في Bing ثم يقرأ أول N نتائج عبر Jina
 */
export async function cloudSearchAndRead(query: string, maxSources = 3): Promise<{
  sources: CloudPageResult[];
  steps: string[];
}> {
  const steps: string[] = [];
  const sources: CloudPageResult[] = [];

  // ── Tier 1: Jina.ai Search (مجاني، يبحث ويُعيد نتائج مباشرة) ────────
  try {
    const jinaSearchUrl = `https://s.jina.ai/${encodeURIComponent(query)}`;
    steps.push(`Jina Search عن: ${query}`);
    const res = await fetch(jinaSearchUrl, {
      headers: { "Accept": "text/plain", "X-Return-Format": "markdown" },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) {
      const markdown = await res.text();
      // كل نتيجة في Jina Search تكون بصيغة ## Title\nURL\nContent
      const blocks = markdown.split(/\n(?=##\s)/);
      let count = 0;
      for (const block of blocks) {
        if (count >= maxSources) break;
        const lines = block.trim().split("\n");
        const title = (lines[0] ?? "").replace(/^#{1,3}\s+/, "").trim();
        const urlLine = lines.find((l) => /^https?:\/\//i.test(l.trim()));
        const text = lines.slice(urlLine ? 2 : 1).join("\n").trim().slice(0, 3000);
        if (title && text) {
          sources.push({ url: urlLine ?? "", title, text, links: [], source: "jina_reader" });
          steps.push(`نتيجة: ${title}`);
          count++;
        }
      }
      if (sources.length > 0) return { sources, steps };
    }
  } catch (e) {
    steps.push(`Jina Search فشل: ${e instanceof Error ? e.message : "خطأ"} — سأبحث عبر Bing`);
  }

  // ── Tier 2: Bing + قراءة النتائج بـ Jina ────────────────────────────
  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  steps.push(`بحث Bing عن: ${query}`);

  let searchPage: CloudPageResult;
  try {
    searchPage = await cloudFetchPage(searchUrl);
  } catch (e) {
    steps.push(`فشل البحث: ${e instanceof Error ? e.message : "خطأ"}`);
    return { sources, steps };
  }

  const resultLinks = searchPage.links
    .filter((l) => {
      try {
        const h = new URL(l.href).hostname.replace(/^www\./, "");
        return !["bing.com", "microsoft.com", "msn.com"].includes(h);
      } catch { return false; }
    })
    .filter((l, i, arr) => arr.findIndex((x) => x.href === l.href) === i)
    .slice(0, maxSources);

  steps.push(`وجدت ${resultLinks.length} نتيجة — سأقرأها`);

  for (const link of resultLinks) {
    try {
      const page = await cloudFetchPage(link.href);
      sources.push(page);
      steps.push(`قرأت (${page.source}): ${page.title || page.url}`);
    } catch (e) {
      steps.push(`تجاوزت: ${link.href} (${e instanceof Error ? e.message : "خطأ"})`);
    }
  }

  return { sources, steps };
}
