// @vitest-environment node
import { describe, it, expect } from "vitest";
import { gscConfig, signAssertion, fetchSearchQueries } from "../../lib/ops/gsc";

/**
 * Live Search Console check — off unless someone asks for it.
 *
 * The unit tests in `gsc.test.ts` prove the signing and parsing against fakes.
 * This file answers the one question a fake cannot: does the account the owner
 * created actually SEE the store's property, and does Google hand back rows.
 * That is the step where a free integration silently dies — the property string
 * has to match Search Console character for character, and the service account
 * has to be invited onto it.
 *
 * Run it once the two variables are in place:
 *   GSC_LIVE=1 npx vitest run tests/ops/gsc.live.test.ts
 *
 * Nothing here prints a key or a token: only property names, the account email
 * (which is what gets invited), and query rows.
 */
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SITES_ENDPOINT = "https://searchconsole.googleapis.com/webmasters/v3/sites";
const LIVE = process.env.GSC_LIVE === "1";

describe.skipIf(!LIVE)("live Search Console access", () => {
  it("the account can name the property it is supposed to read", async () => {
    const cfg = gscConfig();
    expect(cfg.ready, `missing: ${cfg.missing?.join(", ")}`).toBe(true);

    const assertion = signAssertion(cfg.creds!, TOKEN_URI);
    const tokenRes = await fetch(TOKEN_URI, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(20_000),
    });
    const token = (await tokenRes.json()) as { access_token?: string; error_description?: string };
    expect(token.access_token, token.error_description ?? `HTTP ${tokenRes.status}`).toBeTruthy();

    const sites = await fetch(SITES_ENDPOINT, {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(20_000),
    });
    const list = (await sites.json()) as { siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> };
    const entries = list.siteEntry ?? [];
    console.log(`account: ${cfg.creds?.client_email}`);
    console.log(`properties this account can see: ${entries.length}`);
    for (const e of entries) console.log(`  ${e.siteUrl} — ${e.permissionLevel}`);
    console.log(`GSC_SITE_URL is set to: ${cfg.siteUrl}`);

    // Google's own list is the only authority on the string the API accepts.
    const match = entries.find((e) => e.siteUrl === cfg.siteUrl);
    expect(
      match,
      entries.length
        ? `no property matches the configured string — paste one of the siteUrl values above into GSC_SITE_URL`
        : `the account sees no properties — invite ${cfg.creds?.client_email} as a user in Search Console first`
    ).toBeTruthy();
    expect(match?.permissionLevel).not.toBe("siteUnverifiedUser");
  }, 60_000);

  it("reaches the query endpoint and reports what Google really says", async () => {
    const res = await fetchSearchQueries({ days: 90, rowLimit: 12 });
    expect(res.ok, res.error ?? `not configured: ${res.missing?.join(", ")}`).toBe(true);
    expect(res.range?.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    console.log(`range: ${res.range?.start} → ${res.range?.end}`);
    console.log(`rows: ${res.rows?.length ?? 0}`);
    for (const r of (res.rows ?? []).slice(0, 12)) {
      console.log(`  ${r.query} — نقرة ${r.clicks} ظهور ${r.impressions} ترتيب ${r.position.toFixed(1)}`);
    }
    // Zero rows is a real answer, not a broken pipe: the store may simply have
    // no search history. Asserting rows > 0 here would make the check fail on
    // true data and pass on nothing.
    if (!(res.rows?.length)) console.log("  (صفر نتائج — جوجل ما عندهوش كلمات لهذا العقار بعد)");
  }, 60_000);
});
