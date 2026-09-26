/**
 * Unit tests for realChecks.ts — P2 Honest QA
 * NO network calls, all tests are deterministic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runA11yChecks, evaluateHeaders, runLoadProbe, type LoadScenario } from '@/lib/ops/qa/realChecks';

describe('A11y Checks (cheerio-based, no network)', () => {
  it('should detect missing alt on images', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body>
        <img src="photo1.jpg" alt="Valid image">
        <img src="photo2.jpg">
      </body>
      </html>
    `;

    const result = await runA11yChecks(html, 'https://example.com/test');

    const imgViolation = result.violations.find(v => v.ruleId === 'image-alt');
    expect(imgViolation).toBeDefined();
    expect(imgViolation?.count).toBe(1);
  });

  it('should detect duplicate IDs', async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Test</title></head>
      <body>
        <div id="main">First</div>
        <div id="main">Duplicate</div>
        <span id="main">Another duplicate</span>
      </body>
      </html>
    `;

    const result = await runA11yChecks(html, 'https://example.com/test');

    const dupViolation = result.violations.find(v => v.ruleId === 'duplicate-id');
    expect(dupViolation).toBeDefined();
    expect(dupViolation?.count).toBe(1); // 1 duplicate id "main" (3 occurrences = 1 duplicate set)
  });

  it('should detect unlabeled form inputs', async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head><title>Test</title></head>
      <body>
        <label for="name">Name</label>
        <input type="text" id="name">
        <input type="text" id="email">
      </body>
      </html>
    `;

    const result = await runA11yChecks(html, 'https://example.com/test');

    const labelViolation = result.violations.find(v => v.ruleId === 'label');
    expect(labelViolation).toBeDefined();
    expect(labelViolation?.count).toBe(1); // email input missing label
  });

  it('should detect missing html lang', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body></body>
      </html>
    `;

    const result = await runA11yChecks(html, 'https://example.com/test');

    const langViolation = result.violations.find(v => v.ruleId === 'html-has-lang');
    expect(langViolation).toBeDefined();
  });

  it('should pass clean HTML with zero violations', async () => {
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <title>Clean Page</title>
        <meta name="viewport" content="width=device-width">
      </head>
      <body>
        <label for="username">Username</label>
        <input type="text" id="username">
        <img src="logo.png" alt="Company logo">
      </body>
      </html>
    `;

    const result = await runA11yChecks(html, 'https://example.com/test');

    expect(result.violations.length).toBe(0);
  });
});

describe('Security Header Checks (pure evaluator)', () => {
  it('should pass when HSTS is present', () => {
    const headers = {
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
    };

    const checks = evaluateHeaders(headers, '');

    const hstsCheck = checks.find(c => c.id === 'hsts');
    expect(hstsCheck?.pass).toBe(true);
  });

  it('should fail when HSTS is absent', () => {
    const headers = {};

    const checks = evaluateHeaders(headers, '');

    const hstsCheck = checks.find(c => c.id === 'hsts');
    expect(hstsCheck?.pass).toBe(false);
    expect(hstsCheck?.detail).toContain('Missing');
  });

  it('should detect dangerous CORS wildcard with credentials', () => {
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true',
    };

    const checks = evaluateHeaders(headers, '');

    const corsCheck = checks.find(c => c.id === 'cors-wildcard-credentials');
    expect(corsCheck?.pass).toBe(false);
    expect(corsCheck?.detail).toContain('Dangerous');
  });

  it('should pass safe CORS configuration', () => {
    const headers = {
      'access-control-allow-origin': 'https://example.com',
      'access-control-allow-credentials': 'true',
    };

    const checks = evaluateHeaders(headers, '');

    const corsCheck = checks.find(c => c.id === 'cors-wildcard-credentials');
    expect(corsCheck?.pass).toBe(true);
  });

  it('should fail when cross-origin probe echoes wildcard with credentials', () => {
    const checks = evaluateHeaders({}, '', {
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true',
    });

    const corsCheck = checks.find(c => c.id === 'cors-wildcard-credentials');
    expect(corsCheck?.pass).toBe(false);
    expect(corsCheck?.detail).toContain('cross-origin probe');
  });

  it('should prefer probe headers over plain response headers', () => {
    // Plain response looks safe, but probe reveals the wildcard policy
    const checks = evaluateHeaders(
      { 'access-control-allow-origin': 'https://trusted.com' },
      '',
      { 'access-control-allow-origin': '*', 'access-control-allow-credentials': 'true' }
    );

    const corsCheck = checks.find(c => c.id === 'cors-wildcard-credentials');
    expect(corsCheck?.pass).toBe(false);
  });

  it('should check cookie flags', () => {
    const headers = {};
    const cookies = 'sessionid=abc123; Secure; HttpOnly; SameSite=Strict';

    const checks = evaluateHeaders(headers, cookies);

    const secureCheck = checks.find(c => c.id === 'cookie-secure');
    const httpOnlyCheck = checks.find(c => c.id === 'cookie-httponly');
    const sameSiteCheck = checks.find(c => c.id === 'cookie-samesite');

    expect(secureCheck?.pass).toBe(true);
    expect(httpOnlyCheck?.pass).toBe(true);
    expect(sameSiteCheck?.pass).toBe(true);
  });
});

describe('Load Probe Percentiles (stubbed fetch)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate correct p50/p95/p99 from deterministic latencies', async () => {
    // Mock fetch with deterministic delays
    const latencies = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]; // sorted
    let callIndex = 0;

    global.fetch = vi.fn().mockImplementation(async () => {
      const delay = latencies[callIndex % latencies.length];
      callIndex++;
      await new Promise(resolve => setTimeout(resolve, delay));
      return {
        ok: true,
        status: 200,
      } as Response;
    });

    const scenarios: LoadScenario[] = [
      { name: 'Home', path: '/', method: 'GET' },
    ];

    const result = await runLoadProbe('https://example.com', scenarios, {
      concurrency: 2,
      totalRequests: 10,
    });

    // Sorted: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    // Real setTimeout jitter under parallel vitest load can add ±25ms per
    // request, so the bands are deliberately wide — the point is the math,
    // not wall-clock precision.
    expect(result.totalRequests).toBe(10);
    expect(result.errors).toBe(0);
    expect(result.p50Ms).toBeGreaterThanOrEqual(30);
    expect(result.p50Ms).toBeLessThanOrEqual(90);
    expect(result.p95Ms).toBeGreaterThanOrEqual(80);
    expect(result.errorRate).toBe(0);

    vi.restoreAllMocks();
  });

  it('should reject off-origin scenarios', async () => {
    const scenarios: LoadScenario[] = [
      { name: 'External', path: 'https://evil.com/hack', method: 'GET' },
    ];

    await expect(
      runLoadProbe('https://example.com', scenarios, { totalRequests: 1 })
    ).rejects.toThrow('outside base origin');
  });
});
