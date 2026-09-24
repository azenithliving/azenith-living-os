# PHASE P2 — Honest QA (real probes instead of LLM-prose "tests")

> 🇪🇬 ملخص: `loadTest` و`securityScan` و`accessibilityAudit` في وكيل QA كانوا بيدّوا المهمة لـ LLM ويرجعوا نص حلو. هنا نبدلهم بقياسات حقيقية: أرقام استجابة فعلية، فحص headers حقيقي، وفحص WCAG جزئي حقيقي على الـ HTML — والـ LLM يتلخص المقاس بس.

## Mission

Replace three prose-generating QA methods with real measurements (pure Node + cheerio, zero new deps), keep the LLM only as a summarizer of measured data, and add unit + Playwright smoke coverage. No CI re-addition.

## Pre-flight verification

```bash
# 1. loadTest is LLM-prose
sed -n '201,219p' lib/qayyim/QayyimQaAgent.ts
# EXPECT: builds task type "load_test" → this.process(task). No real requests.

# 2. securityScan is LLM-prose
sed -n '224,241p' lib/qayyim/QayyimQaAgent.ts
# EXPECT: same pattern, task type "security_scan".

# 3. accessibilityAudit is LLM-prose
sed -n '185,196p' lib/qayyim/QayyimQaAgent.ts
# EXPECT: task type "accessibility_audit".

# 4. QA API route passes scenarios through
sed -n '60,90p' app/api/admin/qayyim/qa/route.ts
# EXPECT: load_test branch requires scenarios+stages (:72-76).

# 5. Deps
grep -n '"cheerio"\|"playwright"' package.json
# EXPECT: cheerio (:49), playwright devDep (:110)
```

## Changes

| # | File | Change |
|---|------|--------|
| 1 | NEW `lib/qayyim/qa/realChecks.ts` | Three pure functions (all side-effect-light, fully unit-testable): **(a)** `runLoadProbe(baseUrl, scenarios, opts)` — bounded concurrency (≤10), total request cap 200, per-request timeout 5s via AbortController; only same-origin paths of `baseUrl` are allowed (refuse otherwise with a thrown Error); returns real `{ totalRequests, errors, p50Ms, p95Ms, p99Ms, errorRate }` measured with `performance.now()`. **(b)** `runA11yChecks(html, pageUrl)` — cheerio-based static checks: missing `<html lang>`, missing `<title>`, `<img>` without `alt` (report count + first 5 css-ish selectors), duplicate `id` values, `<input>/<select>/<textarea>` without associated label/`aria-label`/`aria-labelledby`/`title`, missing meta viewport. Returns `violations: Array<{ ruleId, selector, message }>` — real, locatable, honest subset (state in the report that full WCAG needs a browser engine). **(c)** `runSecurityHeaderChecks(url)` — one `fetch(url, { redirect: "manual" })`; evaluate present/absent: `strict-transport-security`, `content-security-policy`, `x-content-type-options`, `x-frame-options` OR `frame-ancestors` inside CSP, `set-cookie` flags (`Secure`, `HttpOnly`, `SameSite`), and a CORS probe: second fetch with `Origin: https://example.invalid` flagging `access-control-allow-origin: *` especially alongside credentials. Returns `{ checks: Array<{ id, pass, detail, headerValue? }> }`. |
| 2 | `lib/qayyim/QayyimQaAgent.ts` | `loadTest` (:201-219): call `runLoadProbe(process.env.NEXT_PUBLIC_SITE_URL, ...)` (refuse if unset → success:false "SITE_URL not configured"); put measurements in `data.metrics`; then (and only then) call `this.process(task)` with the measurements embedded in `task.context.measured` so the LLM SUMMARIZES real numbers — system-prompt addition for this agent: `"ستجد في السياق قياسات حقيقية. لخصها فقط. ممنوع اختراع أي رقم غير موجود في measured."` `securityScan` (:224-241): run `runSecurityHeaderChecks`, same pattern. `accessibilityAudit` (:185-196): fetch each page (8s timeout, same-origin only, bounded parallelism ≤5), run `runA11yChecks` per page, aggregate into `data.violationsByPage`, LLM summarizes. If any fetch fails, that page gets `error` recorded — never invented results. |
| 3 | `app/api/admin/qayyim/qa/route.ts` | In the `load_test`/`security_scan`/`accessibility_audit` branches, ensure the response surfaces the new real `data` fields (pass through what the agent returns). No logic rewrite beyond pass-through. |
| 4 | NEW `tests/qayyim/realChecks.test.ts` | vitest, NO network: (a) a11y on a fixture HTML string containing a missing-alt img, duplicate id, unlabeled input, no lang → expect exactly those ruleIds found with correct counts; a clean fixture → zero violations. (b) header-check parser factored pure (`evaluateHeaders(headersObj, cookies)` — export it from realChecks.ts) → table-driven cases (HSTS present/absent, ACAO `*` flagged). (c) percentile math: feed runLoadProbe a stubbed `fetch` (deterministic latencies) → assert p95 equals expected value. |
| 5 | NEW `scripts/qayyim-smoke.mjs` + package.json script `"qayyim:smoke": "node scripts/qayyim-smoke.mjs"` | Playwright (chromium) smoke against `$SITE_URL` (default `http://localhost:3000`): visit `/` and `/rooms` (or the real rooms index path — verify by reading `app/` structure first), wait `networkidle`, collect console errors + failed request URLs; exit non-zero if any console error; print a 5-line summary. Read `node_modules/next/dist/docs/` conventions are NOT needed (this is a plain node script, not a Next route). |

## Forbidden

- NO re-adding `.github/workflows/` (CI removal was deliberate).
- NO new deps (no k6, no axe, no lighthouse).
- NO load probe against production with >200 requests or >10 concurrency — caps are hard-coded, do not parameterize them away.
- NO letting the LLM produce the numbers. It summarizes `measured` only.
- Do NOT touch other Qayyim agents or the orchestrator.

## Post-change verification

```bash
npm run typecheck
npx eslint lib/qayyim/qa/realChecks.ts lib/qayyim/QayyimQaAgent.ts app/api/admin/qayyim/qa/route.ts tests/qayyim/realChecks.test.ts
npm test -- tests/qayyim/realChecks.test.ts
# EXPECT: all exit 0

npm run qayyim:smoke   # with dev server running
# EXPECT: exit 0, summary printed
```

## Definition of Done

- [ ] Pre-flight 1-5 matched.
- [ ] `loadTest` returns numeric p50/p95/p99 from real requests (test proves the math on stubbed fetch).
- [ ] `securityScan` lists observed header values, marking each pass/fail.
- [ ] `accessibilityAudit` findings carry `ruleId` + `selector`; failed fetches surface as errors.
- [ ] LLM step receives `measured` and cannot alter the numbers (they are also returned raw in `data`).
- [ ] Smoke script exits non-zero on console errors.
- [ ] Verification loop green.

## Rollback

```bash
git revert <p2-commit>
# No DB changes in this phase. Deleting the two new files + the package.json script line is a complete revert.
```
