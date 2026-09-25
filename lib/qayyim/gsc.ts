import "server-only";
/**
 * كلمات البحث الحقيقية من Google Search Console — الصفر تكلفة، والصفر اختراع.
 *
 * This is the one external data source inside the store's own boundary that is
 * free but not yet wired: the owner's Search Console property. Two states are
 * possible and both are reported honestly:
 *  • configured  → a real service-account JWT flow and real numbers back.
 *  • unconfigured → a refusal that names the exact missing env vars and the
 *    five-minute path to enable them. Never a plausible-looking table.
 *
 * `env` and `fetchImpl` are injectable so the signing and parsing paths are
 * unit-tested without touching Google.
 */
import { createSign, randomBytes } from "node:crypto";

export interface GscRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscResult {
  ok: boolean;
  rows?: GscRow[];
  range?: { start: string; end: string };
  error?: string;
  missing?: string[];
  /** The reason in the owner's language, when a variable exists but is unusable. */
  note?: string;
}

interface ServiceAccount {
  client_email?: string;
  private_key?: string;
  token_uri?: string;
}

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const QUERY_ENDPOINT = "https://searchconsole.googleapis.com/webmasters/v1/query";

export function gscConfig(env: NodeJS.ProcessEnv = process.env): {
  ready: boolean;
  siteUrl?: string;
  creds?: ServiceAccount;
  missing: string[];
  /** Why, in the owner's language. The variable names stay on their own lines. */
  note?: string;
} {
  const siteUrl = (env.GSC_SITE_URL || "").trim();
  const rawCreds = (env.GOOGLE_APPLICATION_CREDENTIALS_JSON || "").trim();
  const missing: string[] = [];
  if (!siteUrl) missing.push("GSC_SITE_URL");
  if (!rawCreds) missing.push("GOOGLE_APPLICATION_CREDENTIALS_JSON");
  if (missing.length) return { ready: false, missing };

  let creds: ServiceAccount;
  try {
    creds = JSON.parse(rawCreds) as ServiceAccount;
  } catch {
    return {
      ready: false,
      missing: ["GOOGLE_APPLICATION_CREDENTIALS_JSON"],
      note: "المتغير موجود بس محتواه مش مقروء — اتأكد إن الملف منسوخ كله زي ما هو.",
    };
  }
  if (!creds.client_email || !creds.private_key) {
    return {
      ready: false,
      missing: ["GOOGLE_APPLICATION_CREDENTIALS_JSON"],
      note: "المتغير موجود بس ناقصه عنوان البريد أو المفتاح الخاص جوه الملف.",
    };
  }
  return { ready: true, siteUrl, creds, missing: [] };
}

export function parseGscRows(payload: unknown): GscRow[] {
  const rows = (payload as { rows?: unknown })?.rows;
  if (!Array.isArray(rows)) return [];
  const out: GscRow[] = [];
  for (const r of rows) {
    const row = r as { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number };
    const query = Array.isArray(row?.keys) ? String(row.keys[0] ?? "").trim() : "";
    if (!query) continue;
    out.push({
      query,
      clicks: Number(row.clicks) || 0,
      impressions: Number(row.impressions) || 0,
      ctr: Number(row.ctr) || 0,
      position: Number(row.position) || 0,
    });
  }
  return out.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** RS256 service-account assertion, per the Google OAuth2 JWT-bearer flow. */
export function signAssertion(creds: ServiceAccount, audience: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: creds.client_email,
      sub: creds.client_email,
      aud: audience,
      scope: SCOPE,
      iat: nowSec,
      exp: nowSec + 3600,
      jti: randomBytes(16).toString("hex"),
    })
  );
  const signingInput = `${header}.${claims}`;
  const sig = createSign("RSA-SHA256").update(signingInput).sign(creds.private_key as string);
  return `${signingInput}.${b64url(sig)}`;
}

export async function fetchSearchQueries(opts: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  days?: number;
  rowLimit?: number;
  now?: Date;
} = {}): Promise<GscResult> {
  const cfg = gscConfig(opts.env ?? process.env);
  if (!cfg.ready || !cfg.siteUrl || !cfg.creds) return { ok: false, missing: cfg.missing, note: cfg.note };

  const doFetch = opts.fetchImpl ?? fetch;
  const end = new Date((opts.now ?? new Date()).getTime() - 3 * 864e5); // GSC lags ~3 days
  const start = new Date(end.getTime() - (opts.days ?? 30) * 864e5);
  const range = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  const tokenUri = cfg.creds.token_uri || "https://oauth2.googleapis.com/token";

  let accessToken: string;
  try {
    const res = await doFetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signAssertion(cfg.creds, tokenUri),
      }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const j = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
    if (!res.ok || !j.access_token) {
      return { ok: false, error: `رفضت Google التوكن: ${j.error_description || j.error || `HTTP ${res.status}`}` };
    }
    accessToken = j.access_token;
  } catch (e) {
    return { ok: false, error: `تعذّر الوصول إلى Google: ${e instanceof Error ? e.message : "خطأ شبكة"}` };
  }

  try {
    const res = await doFetch(`${QUERY_ENDPOINT}?siteUrl=${encodeURIComponent(cfg.siteUrl)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate: range.start,
        endDate: range.end,
        rowLimit: opts.rowLimit ?? 25,
        dimensions: ["query"],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message || msg;
      } catch {
        /* keep the status text */
      }
      return { ok: false, error: msg };
    }
    const rows = parseGscRows(JSON.parse(text) as unknown);
    return { ok: true, rows, range };
  } catch (e) {
    return { ok: false, error: `تعذّر قراءة رد Search Console: ${e instanceof Error ? e.message : "خطأ شبكة"}` };
  }
}

/**
 * The setup path, in the shape the owner can actually read: Arabic sentences
 * first, and every name he has to type or search for on a line of its own.
 * Arrows and parentheses around Latin inside an Arabic line scramble the whole
 * line on screen, so they are not used here.
 */
const SETUP_STEPS = [
  "الخطوة 1: افتح منصة جوجل للمطورين، اعمل مشروع جديد، وفعّل واجهة بحث جوجل. مجانية.",
  "الخطوة 2: اعمل حساب خدمة جديد، ونزّل منه مفتاح على شكل ملف بيانات.",
  "الخطوة 3: في خدمة بحث جوجل، ضيف البريد بتاع حساب الخدمة ده كمالك لعقار الدار.",
  "الخطوة 4: في منصة الاستضافة، ضيف المتغيرين دول ثم أعد النشر:",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON",
  "GSC_SITE_URL",
];

export function renderGscResult(r: GscResult): string {
  if (!r.ok && r.missing?.length) {
    return [
      "خدمة بحث جوجل لسه موصولةش بالدار. مقدرش أعرض كلمات بحث حقيقية، ومش هخترع واحدة.",
      "ينقصني:",
      ...r.missing.map((m) => m.split(" ")[0]),
      ...(r.note ? [r.note] : []),
      "التفعيل بيخلص في 5 دقايق مرة واحدة، وبيفضل مجاني.",
      ...SETUP_STEPS.map((s) => `• ${s}`),
      "بعدها أوريك بالظبط: أي كلمة بحث جابت نقرة، وموقعك المتوسط منها.",
    ].join("\n");
  }
  if (!r.ok) return `خدمة بحث جوجل ما ردتش: ${r.error || "خطأ غير معروف"} — ما استبدلتش الرد بتخمين.`;
  if (!r.rows?.length)
    return `مفيش كلمات بحث مسجّلة من ${r.range?.start} إلى ${r.range?.end}. دي صفر نتائج، وهي إجابة حقيقية مش خطأ.`;
  const head = `كلمات البحث الحقيقية من ${r.range?.start} إلى ${r.range?.end} — أعلى ${r.rows.length}:`;
  const body = r.rows
    .slice(0, 12)
    .map(
      (x) =>
        `• «${x.query}» — ${x.clicks} نقرة من ${x.impressions} ظهور · نسبة النقر ${(x.ctr * 100).toFixed(1)}% · متوسط الموقع ${x.position.toFixed(1)}`,
    );
  return [head, ...body].join("\n");
}
