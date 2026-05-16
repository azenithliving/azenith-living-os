import { chromium } from 'playwright';

async function auditSite() {
  const url = 'https://azenith-living-os.vercel.app';
  console.log(`Starting audit of ${url}...`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const consoleLogs = [];
  
  page.on('pageerror', error => {
    errors.push(`[Page Error]: ${error.message}`);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLogs.push(`[Console ${msg.type().toUpperCase()}]: ${msg.text()}`);
    }
  });

  page.on('response', response => {
    if (response.status() >= 400 && !response.url().includes('posthog')) {
      errors.push(`[Network Error]: ${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    console.log(`Homepage loaded successfully.`);
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    console.log(`Navigating to /rooms/living-room...`);
    await page.goto(`${url}/rooms/living-room`, { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log(`Clicking style picker...`);
    // Try english or arabic
    const classicBtn = page.locator('button', { hasText: 'Classic' }).first();
    const classicArBtn = page.locator('button', { hasText: 'كلاسيكي' }).first();
    
    if (await classicBtn.isVisible()) {
        await classicBtn.click();
        console.log("Clicked Classic");
    } else if (await classicArBtn.isVisible()) {
        await classicArBtn.click();
        console.log("Clicked كلاسيكي");
    } else {
        console.log("Could not find style button.");
    }
    
    await page.waitForTimeout(3000); 
    
    console.log(`Navigating to /request...`);
    await page.goto(`${url}/request`, { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log(`Filling out request form...`);
    const nameInput = page.locator('input[name="full_name"], input[placeholder*="Name"], input[placeholder*="اسم"]').first();
    const emailInput = page.locator('input[type="email"]').first();
    const phoneInput = page.locator('input[type="tel"]').first();
    
    if (await nameInput.isVisible()) await nameInput.fill('Test User');
    if (await emailInput.isVisible()) await emailInput.fill('test@example.com');
    if (await phoneInput.isVisible()) await phoneInput.fill('+201000000000');
    
    const submitBtn = page.locator('button[type="submit"]').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      console.log("Submitted form.");
      await page.waitForTimeout(5000); 
    }
    
  } catch (err) {
    console.error(`Crawl failed:`, err);
  } finally {
    await browser.close();
  }
  
  console.log("\n--- AUDIT REPORT ---");
  console.log("Errors:");
  errors.forEach(e => console.log(e));
  console.log("\nConsole Warnings/Errors:");
  consoleLogs.forEach(c => console.log(c));
}

auditSite();
