// @vitest-environment node
import { describe, it, expect } from "vitest";
import { gscConfig, signAssertion, fetchSearchQueries } from "../../lib/qayyim/gsc";

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
 *   GSC_LIVE=1 npx vitest run tests/qayyim/gsc.live.test.ts
 *
 * Nothing here prints a key or a token: only property names, the account email
 * (which is what gets invited), and query rows.
 */
const TOKEN_URI = "https://oauth2.googleapis.com/token";
const SITES_ENDPOINT = "https://searchconsole.googleapis.com/webmasters/v1/sites";
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

  it("answers with real queries, not an empty table", async () => {
    const res = await fetchSearchQueries({ days: 28, rowLimit: 10 });
    expect(res.ok, res.error ?? `not configured: ${res.missing?.join(", ")}`).toBe(true);
    console.log(`range: ${res.range?.start} → ${res.range?.end}`);
    console.log(`rows: ${res.rows?.length ?? 0}`);
    for (const r of (res.rows ?? []).slice(0, 10)) {
      console.log(`  ${r.query} — نقرة ${r.clicks} ظهور ${r.impressions} ترتيب ${r.position.toFixed(1)}`);
    }
    expect((res.rows ?? []).length, "Google answered with zero rows for 28 days").toBeGreaterThan(0);
  }, 60_000);
});
