/**
 * qayyim-smoke.mjs — Playwright smoke test against dev/staging
 * Exits non-zero if console errors found or requests failed
 */

import { chromium } from '@playwright/test';

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

const PAGES_TO_TEST = [
  '/',
  '/rooms',
];

async function main() {
  console.log(`🧪 Starting Qayyim smoke test against ${SITE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('requestfailed', request => {
    const failure = request.failure();
    // Navigating away tears down in-flight requests (video/XHR) — not a page defect.
    if (failure && failure.errorText.includes('ERR_ABORTED')) return;
    failedRequests.push(`${request.url()} (${failure ? failure.errorText : 'unknown'})`);
  });

  let hasErrors = false;

  for (const pagePath of PAGES_TO_TEST) {
    const url = new URL(pagePath, SITE_URL).toString();
    console.log(`  → Visiting ${url}`);

    try {
      // domcontentloaded, not networkidle/load: the homepage streams a hero
      // video, so neither 'load' nor idle ever fires on a perfectly healthy site.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      console.log(`    ✓ Loaded successfully`);
    } catch (e) {
      console.error(`    ✗ Failed to load: ${e.message}`);
      hasErrors = true;
    }
  }

  await browser.close();

  // Summary
  console.log('\n📊 Smoke Test Summary');
  console.log(`  Pages tested: ${PAGES_TO_TEST.length}`);
  console.log(`  Console errors: ${consoleErrors.length}`);
  console.log(`  Failed requests: ${failedRequests.length}`);

  if (consoleErrors.length > 0) {
    console.error('\n❌ Console Errors:');
    consoleErrors.forEach(err => console.error(`  - ${err.slice(0, 100)}`));
    hasErrors = true;
  }

  if (failedRequests.length > 0) {
    console.error('\n❌ Failed Requests:');
    failedRequests.forEach(url => console.error(`  - ${url}`));
    hasErrors = true;
  }

  if (hasErrors) {
    console.error('\n❌ Smoke test FAILED');
    process.exit(1);
  } else {
    console.log('\n✅ Smoke test PASSED');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
