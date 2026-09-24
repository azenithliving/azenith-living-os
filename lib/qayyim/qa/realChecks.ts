/**
 * realChecks.ts — Real measurements for QA (no LLM prose)
 * 
 * Three pure functions for load/security/a11y testing:
 * - runLoadProbe: bounded concurrency, real latency percentiles
 * - runSecurityHeaderChecks: fetch + evaluate headers
 * - runA11yChecks: cheerio-based static WCAG subset
 */

import * as cheerio from "cheerio";

// ═══════════════════════════════════════════════════════════════════════════
// 1. LOAD PROBE — bounded concurrency, real percentiles
// ═══════════════════════════════════════════════════════════════════════════

export interface LoadProbeResult {
  totalRequests: number;
  errors: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  errorDetails: Array<{ path: string; error: string }>;
}

export interface LoadScenario {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  body?: any;
}

export async function runLoadProbe(
  baseUrl: string,
  scenarios: LoadScenario[],
  opts?: { concurrency?: number; totalRequests?: number }
): Promise<LoadProbeResult> {
  const concurrency = Math.min(opts?.concurrency || 10, 10); // hard cap at 10
  const totalRequests = Math.min(opts?.totalRequests || 200, 200); // hard cap at 200

  const baseOrigin = new URL(baseUrl).origin;

  // Validate all scenarios are same-origin
  for (const sc of scenarios) {
    try {
      const url = new URL(sc.path, baseUrl);
      if (url.origin !== baseOrigin) {
        throw new Error(`Scenario path "${sc.path}" is outside base origin ${baseOrigin}`);
      }
    } catch (e: any) {
      throw new Error(`Invalid scenario path "${sc.path}": ${e.message}`);
    }
  }

  const latencies: number[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  let completed = 0;

  const queue: Array<() => Promise<void>> = [];

  for (let i = 0; i < totalRequests; i++) {
    const scenario = scenarios[i % scenarios.length];
    queue.push(async () => {
      const url = new URL(scenario.path, baseUrl).toString();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s per-request timeout

      const start = performance.now();
      try {
        const response = await fetch(url, {
          method: scenario.method,
          body: scenario.body ? JSON.stringify(scenario.body) : undefined,
          headers: scenario.body ? { 'Content-Type': 'application/json' } : {},
          signal: controller.signal,
        });

        const elapsed = performance.now() - start;
        if (!response.ok && response.status >= 500) {
          errors.push({ path: scenario.path, error: `HTTP ${response.status}` });
        } else {
          latencies.push(elapsed);
        }
      } catch (e: any) {
        errors.push({ path: scenario.path, error: e.name === 'AbortError' ? 'Timeout' : e.message });
      } finally {
        clearTimeout(timeout);
        completed++;
      }
    });
  }

  // Execute with bounded concurrency
  let index = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < queue.length) {
      const task = queue[index++];
      await task();
    }
  });

  await Promise.all(workers);

  // Calculate percentiles
  if (latencies.length === 0) {
    return {
      totalRequests: completed,
      errors: errors.length,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      errorRate: 1.0,
      errorDetails: errors,
    };
  }

  latencies.sort((a, b) => a - b);
  const p50 = percentile(latencies, 0.5);
  const p95 = percentile(latencies, 0.95);
  const p99 = percentile(latencies, 0.99);

  return {
    totalRequests: completed,
    errors: errors.length,
    p50Ms: Math.round(p50),
    p95Ms: Math.round(p95),
    p99Ms: Math.round(p99),
    errorRate: errors.length / completed,
    errorDetails: errors,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SECURITY HEADER CHECKS — fetch + evaluate
// ═══════════════════════════════════════════════════════════════════════════

export interface SecurityCheck {
  id: string;
  pass: boolean;
  detail: string;
  headerValue?: string;
}

export interface SecurityHeaderResult {
  checks: SecurityCheck[];
}

export async function runSecurityHeaderChecks(url: string): Promise<SecurityHeaderResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      signal: controller.signal,
    });
  } catch (e: any) {
    throw new Error(`Fetch failed: ${e.message}`);
  } finally {
    clearTimeout(timeout);
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const cookies = headers['set-cookie'] || '';

  // CORS probe: a second request carrying a foreign Origin header, so the
  // server echoes its real cross-origin policy instead of hiding it.
  const corsProbeHeaders = await fetchCorsProbeHeaders(url);

  return { checks: evaluateHeaders(headers, cookies, corsProbeHeaders) };
}

async function fetchCorsProbeHeaders(url: string): Promise<Record<string, string>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const probe = await fetch(url, {
      redirect: 'manual',
      headers: { Origin: 'https://example.invalid' },
      signal: controller.signal,
    });
    const probeHeaders: Record<string, string> = {};
    probe.headers.forEach((value, key) => {
      probeHeaders[key.toLowerCase()] = value;
    });
    return probeHeaders;
  } catch {
    return {}; // probe failed → evaluator falls back to the main response headers
  } finally {
    clearTimeout(timeout);
  }
}

export function evaluateHeaders(
  headers: Record<string, string>,
  cookies: string,
  corsProbeHeaders: Record<string, string> = {}
): SecurityCheck[] {
  const checks: SecurityCheck[] = [];

  // 1. HSTS
  const hsts = headers['strict-transport-security'];
  checks.push({
    id: 'hsts',
    pass: !!hsts,
    detail: hsts ? 'HSTS header present' : 'Missing Strict-Transport-Security',
    headerValue: hsts,
  });

  // 2. CSP
  const csp = headers['content-security-policy'];
  checks.push({
    id: 'csp',
    pass: !!csp,
    detail: csp ? 'CSP header present' : 'Missing Content-Security-Policy',
    headerValue: csp,
  });

  // 3. X-Content-Type-Options
  const xcto = headers['x-content-type-options'];
  checks.push({
    id: 'x-content-type-options',
    pass: xcto === 'nosniff',
    detail: xcto === 'nosniff' ? 'X-Content-Type-Options: nosniff' : 'Missing or incorrect X-Content-Type-Options',
    headerValue: xcto,
  });

  // 4. X-Frame-Options or frame-ancestors in CSP
  const xfo = headers['x-frame-options'];
  const hasFrameAncestors = csp ? /frame-ancestors\s+[^;]+/i.test(csp) : false;
  checks.push({
    id: 'frame-protection',
    pass: !!xfo || hasFrameAncestors,
    detail: xfo
      ? `X-Frame-Options: ${xfo}`
      : hasFrameAncestors
      ? 'frame-ancestors in CSP'
      : 'Missing X-Frame-Options and frame-ancestors',
    headerValue: xfo || (hasFrameAncestors ? 'CSP frame-ancestors' : undefined),
  });

  // 5. Cookie flags (Secure, HttpOnly, SameSite)
  if (cookies) {
    const hasSecure = /\bSecure\b/i.test(cookies);
    const hasHttpOnly = /\bHttpOnly\b/i.test(cookies);
    const hasSameSite = /\bSameSite=/i.test(cookies);

    checks.push({
      id: 'cookie-secure',
      pass: hasSecure,
      detail: hasSecure ? 'Cookies have Secure flag' : 'Cookies missing Secure flag',
    });

    checks.push({
      id: 'cookie-httponly',
      pass: hasHttpOnly,
      detail: hasHttpOnly ? 'Cookies have HttpOnly flag' : 'Cookies missing HttpOnly flag',
    });

    checks.push({
      id: 'cookie-samesite',
      pass: hasSameSite,
      detail: hasSameSite ? 'Cookies have SameSite attribute' : 'Cookies missing SameSite',
    });
  }

  // 6. CORS wildcard with credentials (dangerous pattern) — prefer the
  // cross-origin probe response, fall back to the plain request headers.
  const acao = corsProbeHeaders['access-control-allow-origin'] ?? headers['access-control-allow-origin'];
  const acac = corsProbeHeaders['access-control-allow-credentials'] ?? headers['access-control-allow-credentials'];
  const probed = Object.keys(corsProbeHeaders).length > 0;
  if (acao === '*' && acac === 'true') {
    checks.push({
      id: 'cors-wildcard-credentials',
      pass: false,
      detail: 'Dangerous: ACAO=* with credentials=true' + (probed ? ' (cross-origin probe)' : ''),
      headerValue: `${acao} + credentials`,
    });
  } else {
    checks.push({
      id: 'cors-wildcard-credentials',
      pass: true,
      detail: 'No dangerous CORS wildcard pattern' + (probed ? ' (cross-origin probe)' : ''),
    });
  }

  return checks;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. A11Y CHECKS — cheerio-based static WCAG subset
// ═══════════════════════════════════════════════════════════════════════════

export interface A11yViolation {
  ruleId: string;
  selector?: string;
  message: string;
  count?: number;
}

export interface A11yCheckResult {
  violations: A11yViolation[];
}

export async function runA11yChecks(html: string, _pageUrl: string): Promise<A11yCheckResult> {
  const $ = cheerio.load(html);
  const violations: A11yViolation[] = [];

  // 1. Missing <html lang>
  const htmlLang = $('html').attr('lang');
  if (!htmlLang || htmlLang.trim() === '') {
    violations.push({
      ruleId: 'html-has-lang',
      selector: 'html',
      message: 'Missing lang attribute on <html>',
    });
  }

  // 2. Missing <title>
  const title = $('title').text().trim();
  if (!title) {
    violations.push({
      ruleId: 'document-title',
      selector: 'head',
      message: 'Missing or empty <title>',
    });
  }

  // 3. Images without alt
  const imgsMissingAlt: string[] = [];
  $('img').each((i, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') {
      const src = $(el).attr('src') || '';
      const selector = src ? `img[src="${src.slice(0, 40)}..."]` : `img:nth(${i})`;
      imgsMissingAlt.push(selector);
    }
  });

  if (imgsMissingAlt.length > 0) {
    violations.push({
      ruleId: 'image-alt',
      message: `${imgsMissingAlt.length} image(s) missing alt attribute`,
      count: imgsMissingAlt.length,
      selector: imgsMissingAlt.slice(0, 5).join(', '), // first 5
    });
  }

  // 4. Duplicate IDs
  const ids: Record<string, number> = {};
  $('[id]').each((_, el) => {
    const id = $(el).attr('id');
    if (id) {
      ids[id] = (ids[id] || 0) + 1;
    }
  });

  const duplicates = Object.entries(ids).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    violations.push({
      ruleId: 'duplicate-id',
      message: `${duplicates.length} duplicate id(s) found`,
      selector: duplicates.map(([id]) => `#${id}`).slice(0, 5).join(', '),
      count: duplicates.length,
    });
  }

  // 5. Form inputs without labels
  const unlabeled: string[] = [];
  $('input, select, textarea').each((i, el) => {
    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledby = $(el).attr('aria-labelledby');
    const titleAttr = $(el).attr('title');
    const type = $(el).attr('type');

    // Skip hidden inputs
    if (type === 'hidden' || type === 'submit' || type === 'button') return;

    const hasLabel = id && $(`label[for="${id}"]`).length > 0;
    const hasAria = ariaLabel || ariaLabelledby || titleAttr;

    if (!hasLabel && !hasAria) {
      const name = $(el).attr('name') || '';
      const selector = name ? `${el.tagName.toLowerCase()}[name="${name}"]` : `${el.tagName.toLowerCase()}:nth(${i})`;
      unlabeled.push(selector);
    }
  });

  if (unlabeled.length > 0) {
    violations.push({
      ruleId: 'label',
      message: `${unlabeled.length} form control(s) without labels`,
      count: unlabeled.length,
      selector: unlabeled.slice(0, 5).join(', '),
    });
  }

  // 6. Missing meta viewport
  const viewport = $('meta[name="viewport"]').attr('content');
  if (!viewport) {
    violations.push({
      ruleId: 'meta-viewport',
      selector: 'head',
      message: 'Missing <meta name="viewport">',
    });
  }

  return { violations };
}
