// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CANARY_PAGES,
  evaluateProbe,
  probePages,
  renderCanaryDigest,
  shouldAlert,
  type ProbeResult,
} from "@/lib/ops/canary";

/**
 * P6-M5 — the canary walks the public storefront every morning. The shop's front
 * door is the one thing the owner cannot check from a dashboard number, and a
 * 500 there is not a metric, it is a lost customer.
 *
 * `fetch` is injected, so the decision logic is tested without a network — the
 * real probe run is verified on production, not claimed from here.
 */

const ok = (path: string): ProbeResult => ({ path, status: 200, ok: true, error: null });
const bad = (path: string, status: number | null, error: string | null = null): ProbeResult => ({
  path,
  status,
  ok: false,
  error,
});

describe("evaluateProbe", () => {
  it("accepts a two-hundred", () => {
    expect(evaluateProbe("/", 200, null).ok).toBe(true);
  });

  // A 404 page still answers with a 200 on some hosts; the status is not the
  // whole truth, but a redirect chain means the route moved.
  it("rejects a redirect, a client error and a server error", () => {
    expect(evaluateProbe("/rooms", 308, null).ok).toBe(false);
    expect(evaluateProbe("/rooms", 404, null).ok).toBe(false);
    expect(evaluateProbe("/rooms", 500, null).ok).toBe(false);
  });

  it("rejects a request that never answered", () => {
    const r = evaluateProbe("/about", null, "fetch failed");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("fetch failed");
  });

  it("records the path so the owner can open it", () => {
    expect(evaluateProbe("/request", 503, null).path).toBe("/request");
  });
});

describe("probePages", () => {
  it("probes every page and reports each verdict", async () => {
    const seen: string[] = [];
    const results = await probePages("https://azenith-living.vercel.app", CANARY_PAGES, async (url) => {
      seen.push(url);
      return { status: 200 };
    });
    expect(results).toHaveLength(CANARY_PAGES.length);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(seen[0]).toBe("https://azenith-living.vercel.app/");
    expect(seen).toContain("https://azenith-living.vercel.app/rooms");
  });

  it("turns a thrown fetch into a failed probe instead of losing the round", async () => {
    const results = await probePages("https://x.test", ["/boom"], async () => {
      throw new Error("socket hang up");
    });
    expect(results[0]).toEqual({ path: "/boom", status: null, ok: false, error: "socket hang up" });
  });

  it("never builds a URL outside the site origin", async () => {
    const urls: string[] = [];
    await probePages("https://x.test", ["/../secrets"], async (u) => {
      urls.push(u);
      return { status: 200 };
    });
    expect(urls[0]).toBe("https://x.test/secrets");
  });

  it("closes the trailing slash so the probe matches the real route", async () => {
    const urls: string[] = [];
    await probePages("https://x.test", ["/about/"], (u) => {
      urls.push(u);
      return Promise.resolve({ status: 200 });
    });
    expect(urls[0]).toBe("https://x.test/about");
  });
});

describe("shouldAlert", () => {
  it("stays quiet when the storefront answers", () => {
    expect(shouldAlert(CANARY_PAGES.map(ok))).toBe(false);
  });

  it("fires on a single failure", () => {
    expect(shouldAlert([ok("/"), bad("/rooms", 500)])).toBe(true);
  });

  it("fires when nothing answered at all", () => {
    expect(shouldAlert([])).toBe(true);
  });
});

describe("renderCanaryDigest", () => {
  it("says all clear in plain arabic when nothing failed", () => {
    const text = renderCanaryDigest(CANARY_PAGES.map(ok));
    expect(text).toContain("كل الصفحات العامة بتفتح");
    expect(text).not.toMatch(/[A-Za-z]{3,}/);
  });

  it("names the page and what it answered", () => {
    const text = renderCanaryDigest([ok("/"), bad("/request", 500)]);
    expect(text).toContain("/request");
    expect(text).toContain("500");
    expect(text).toContain("صفحة بتفتح غلط");
  });

  it("keeps an unreachable page in the report", () => {
    const text = renderCanaryDigest([bad("/about", null, "fetch failed")]);
    expect(text).toContain("/about");
    expect(text).toContain("ما ردتش");
  });

  it("does not bury more than three failures", () => {
    const failing = ["/a", "/b", "/c", "/d", "/e"].map((p) => bad(p, 503));
    const lines = renderCanaryDigest(failing).split("\n").filter((l) => /^\s*-\s/.test(l));
    expect(lines.length).toBe(failing.length);
  });

  it("says which pages never got probed when the budget ran out", () => {
    const text = renderCanaryDigest([ok("/"), ok("/rooms")], 3);
    expect(text).toContain("3");
    expect(text).toContain("ما اتفحصش");
  });
});
