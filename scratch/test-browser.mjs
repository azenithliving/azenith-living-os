import { chromium } from 'playwright';
import path from 'path';

async function inspect(url) {
  const artifactDir = 'C:\\Users\\noura\\.gemini\\antigravity\\brain\\70f7fac4-6174-4e90-86fa-279ab72c900b';
  const screenshotPath = path.join(artifactDir, 'live_preview.png');
  
  console.log(`Navigating to ${url}...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const pageErrors = [];

  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  try {
    const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`Response status: ${res ? res.status() : 'none'}`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`Screenshot saved to: ${screenshotPath}`);
  } catch (err) {
    console.error('Navigation error:', err.message);
  }

  await browser.close();

  console.log('\n--- Console Logs ---');
  consoleLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));

  console.log('\n--- Page Errors ---');
  if (pageErrors.length === 0) {
    console.log('No page errors detected.');
  } else {
    pageErrors.forEach(e => console.error(`[ERROR] ${e}`));
  }
}

const targetUrl = process.argv[2] || 'https://azenith-living.vercel.app';
inspect(targetUrl);
