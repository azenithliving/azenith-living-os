/**
 * P6-M5 — the daily canary.
 *
 * Every other measurement in this swarm reads a number out of the store's own
 * ledger. This one walks to the front door and pushes it: does the public site
 * actually open? A deploy that builds green and serves a 500 is the failure mode
 * that costs a customer while every dashboard stays green, and the owner has no
 * way to see it from a report.
 *
 * The page list is deliberately the storefront, not the admin: an admin page
 * behind the gate answers 200 to a crawler or 401 to nobody, and either way it
 * says nothing about the shop.
 */

import "server-only";

import { createAdminProposal } from "@/lib/admin-sovereign-mind";

export const CANARY_PAGES = ["/", "/rooms", "/about", "/request", "/privacy"];

const PER_REQUEST_TIMEOUT_MS = 6_000;

export interface ProbeResult {
  path: string;
  status: number | null;
  ok: boolean;
  error: string | null;
}

export type ProbeFetch = (url: string) => Promise<{ status: number }>;

export function evaluateProbe(path: string, status: number | null, error: string | null): ProbeResult {
  return { path, status, ok: status !== null && status >= 200 && status < 300 && !error, error };
}

/** A single failing page is news; an empty result means nothing answered at all. */
export function shouldAlert(results: ProbeResult[]): boolean {
  return !results.length || results.some((r) => !r.ok);
}

export function renderCanaryDigest(results: ProbeResult[], skipped = 0): string {
  const broken = results.filter((r) => !r.ok);
  const tail = skipped ? `وفضل ${skipped} صفحة ما اتفحصش لأن وقت الفحص خلص.` : "";
  if (!broken.length) {
    return `كل الصفحات العامة بتفتح (${results.length} صفحة).${tail ? ` ${tail}` : ""}`;
  }
  return [
    `صفحة بتفتح غلط (${broken.length} من ${results.length}):`,
    ...broken.map((r) => `  - ${r.path}: ${r.status ?? "ما ردتش"}${r.error ? ` (${r.error})` : ""}`),
    tail,
  ].filter(Boolean).join("\n");
}

function canaryUrl(origin: string, path: string): string {
  const clean = path.replace(/\/+$/, "") || "/";
  // Resolving through URL is what keeps `/../x` from ever reaching a fetch.
  return new URL(clean, origin.endsWith("/") ? origin : `${origin}/`).toString();
}

export async function probePages(
  origin: string,
  pages: string[],
  doFetch: ProbeFetch,
  deadlineAt = Number.POSITIVE_INFINITY,
): Promise<ProbeResult[]> {
  const out: ProbeResult[] = [];
  for (const path of pages) {
    if (Date.now() > deadlineAt) break;
    try {
      const res = await doFetch(canaryUrl(origin, path));
      out.push(evaluateProbe(path, res.status, null));
    } catch (e: any) {
      out.push(evaluateProbe(path, null, e?.message || "fetch failed"));
    }
  }
  return out;
}

/** The real probe: same logic, with a timeout so one hung page cannot eat the round. */
async function fetchWithTimeout(url: string): Promise<{ status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "GET", redirect: "manual", signal: controller.signal, cache: "no-store" });
    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

export interface CanaryOutcome {
  checked: number;
  skipped: number;
  failed: number;
  digest: string;
  alerted: boolean;
  proposalCreated: boolean;
  proposalId: string | null;
  error?: string;
}

export async function runCanary(opts: { origin?: string; budgetMs?: number } = {}): Promise<CanaryOutcome> {
  const site = (opts.origin || process.env.NEXT_PUBLIC_SITE_URL || "").trim();
  if (!site) {
    return {
      checked: 0,
      skipped: CANARY_PAGES.length,
      failed: 0,
      digest: "مفيش عنوان الموقع مضبوط، فالكاناري ما اتعملش — متعطلش.",
      alerted: false,
      proposalCreated: false,
      proposalId: null,
      error: "NEXT_PUBLIC_SITE_URL مش مضبوط",
    };
  }

  const budgetMs = opts.budgetMs ?? 24_000;
  const results = await probePages(site, CANARY_PAGES, fetchWithTimeout, Date.now() + budgetMs);
  const skipped = CANARY_PAGES.length - results.length;
  const digest = renderCanaryDigest(results, skipped);
  const failed = results.filter((r) => !r.ok).length;

  if (!shouldAlert(results)) {
    return { checked: results.length, skipped, failed, digest, alerted: false, proposalCreated: false, proposalId: null };
  }

  // The alarm is a decision card, not a log line: it reaches the owner where he
  // already answers the swarm's other questions.
  const proposal = await createAdminProposal({
    title: "كاناري: صفحة عامة في الموقع بتفتح غلط",
    description: `${digest}\n\nالفحص بيتم كل صباح على الصفحات العامة دي:\n${CANARY_PAGES.join("\n")}`,
    reasoning: "فحص كاناري مجدول من جولة مدير تشغيل المحتوى",
    userMessage: "افتح الصفحات اللي وقعت وشوف النشر الأخير",
    intent: { kind: "health", confidence: 0.9 },
    userEmail: process.env.MASTER_ADMIN_EMAILS?.split(",")[0]?.trim(),
    proactive: true,
  });

  return {
    checked: results.length,
    skipped,
    failed,
    digest,
    alerted: true,
    proposalCreated: proposal.success,
    proposalId: proposal.requestId ?? null,
    ...(proposal.success ? {} : { error: proposal.error || "اقتراح الكاناري ما اتسجلش" }),
  };
}
