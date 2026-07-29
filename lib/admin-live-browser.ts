import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export type LiveBrowserDeviceMode = "desktop" | "mobile";
export type LiveBrowserNetworkMode = "direct" | "tor" | "custom";

type LiveBrowserRuntime = {
  browser?: Browser;
  context?: BrowserContext;
  pages?: Page[];
  activePageIndex?: number;
  deviceMode?: LiveBrowserDeviceMode;
  networkMode?: LiveBrowserNetworkMode;
  startedAt?: string;
  lastError?: string;
};

type BrowserAction =
  | { action: "goto"; url: string }
  | { action: "click"; x: number; y: number }
  | { action: "type"; text: string }
  | { action: "press"; key: string }
  | { action: "scroll"; deltaX?: number; deltaY?: number }
  | { action: "reload" }
  | { action: "back" }
  | { action: "forward" }
  | { action: "newTab"; url?: string }
  | { action: "switchTab"; index: number }
  | { action: "closeTab"; index: number }
  | { action: "setDevice"; mode: LiveBrowserDeviceMode }
  | { action: "setNetwork"; mode: LiveBrowserNetworkMode };

const GLOBAL_KEY = "__azenithAdminLiveBrowser";

function runtime(): LiveBrowserRuntime {
  const globalStore = globalThis as typeof globalThis & {
    [GLOBAL_KEY]?: LiveBrowserRuntime;
  };
  if (!globalStore[GLOBAL_KEY]) {
    globalStore[GLOBAL_KEY] = {};
  }
  return globalStore[GLOBAL_KEY];
}

function normalizeUrl(url: string) {
  const value = url.trim();
  if (!value) return "about:blank";
  if (/^https?:\/\//i.test(value)) return value;
  if (value === "about:blank") return value;
  return `https://${value}`;
}

function deviceProfile(mode: LiveBrowserDeviceMode = "desktop") {
  if (mode === "mobile") {
    return {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    };
  }

  return {
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
}

function proxyServerForMode(mode: LiveBrowserNetworkMode = "direct") {
  if (mode === "direct") return undefined;

  if (mode === "tor") {
    return (
      process.env.ADMIN_LIVE_BROWSER_TOR_PROXY ||
      process.env.TOR_SOCKS_PROXY ||
      "socks5://127.0.0.1:9050"
    );
  }

  return process.env.ADMIN_LIVE_BROWSER_PROXY_SERVER;
}

async function launchBrowser(state: LiveBrowserRuntime) {
  const proxyServer = proxyServerForMode(state.networkMode || "direct");
  if (state.networkMode === "custom" && !proxyServer) {
    throw new Error("ADMIN_LIVE_BROWSER_PROXY_SERVER is required for custom proxy mode");
  }

  state.browser = await chromium.launch({
    headless: true,
    proxy: proxyServer ? { server: proxyServer } : undefined,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });
}

async function createContext(state: LiveBrowserRuntime, mode: LiveBrowserDeviceMode) {
  if (!state.browser) throw new Error("Live browser is not ready");
  const profile = deviceProfile(mode);
  const context = await state.browser.newContext({
    viewport: profile.viewport,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
    deviceScaleFactor: profile.deviceScaleFactor,
    locale: "ar-EG",
    timezoneId: "Africa/Cairo",
    userAgent: profile.userAgent,
  });
  state.context = context;
  state.deviceMode = mode;
  return context;
}

function livePages(state: LiveBrowserRuntime) {
  state.pages = (state.pages || []).filter((page) => !page.isClosed());
  const maxIndex = Math.max(0, state.pages.length - 1);
  state.activePageIndex = Math.min(Math.max(state.activePageIndex || 0, 0), maxIndex);
  return state.pages;
}

function activePage(state: LiveBrowserRuntime) {
  const pages = livePages(state);
  return pages[state.activePageIndex || 0];
}

export async function getAdminLiveBrowser() {
  const state = runtime();

  if (activePage(state) && state.context) {
    return state;
  }

  try {
    state.networkMode = state.networkMode || "direct";
    await launchBrowser(state);
    await createContext(state, state.deviceMode || "desktop");
    if (!state.context) throw new Error("Live browser context is not ready");
    const page = await state.context.newPage();
    state.pages = [page];
    state.activePageIndex = 0;
    state.startedAt = new Date().toISOString();
    state.lastError = undefined;
    await page.goto("about:blank");
    return state;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Failed to start live browser";
    throw error;
  }
}

export async function getAdminLiveBrowserStatus() {
  const state = await getAdminLiveBrowser();
  const page = activePage(state);
  if (!page || page.isClosed()) {
    return {
      ready: false,
      url: "",
      title: "",
      startedAt: state.startedAt,
      error: state.lastError || "Browser page is closed",
    };
  }

  return {
    ready: true,
    url: page.url(),
    title: await page.title().catch(() => ""),
    startedAt: state.startedAt,
    deviceMode: state.deviceMode || "desktop",
    networkMode: state.networkMode || "direct",
    activeTabIndex: state.activePageIndex || 0,
    tabs: await Promise.all(
      livePages(state).map(async (tab, index) => ({
        index,
        url: tab.url(),
        title: (await tab.title().catch(() => "")) || "تبويب جديد",
        active: index === (state.activePageIndex || 0),
      }))
    ),
  };
}

export async function runAdminLiveBrowserAction(input: BrowserAction) {
  const state = await getAdminLiveBrowser();
  let page = activePage(state);
  if (!page || page.isClosed()) {
    throw new Error("Live browser is not ready");
  }

  switch (input.action) {
    case "goto":
      await page.goto(normalizeUrl(input.url), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      break;
    case "click":
      await page.mouse.click(input.x, input.y);
      break;
    case "type":
      await page.keyboard.type(input.text, { delay: 12 });
      break;
    case "press":
      await page.keyboard.press(input.key);
      break;
    case "scroll":
      await page.mouse.wheel(input.deltaX || 0, input.deltaY || 0);
      break;
    case "reload":
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
      break;
    case "back":
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      break;
    case "forward":
      await page.goForward({ waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      break;
    case "newTab": {
      if (!state.context) throw new Error("Live browser context is not ready");
      page = await state.context.newPage();
      state.pages = livePages(state);
      state.pages.push(page);
      state.activePageIndex = state.pages.length - 1;
      await page.goto(normalizeUrl(input.url || "about:blank"), {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      }).catch(() => null);
      break;
    }
    case "switchTab": {
      const pages = livePages(state);
      if (!pages[input.index]) throw new Error("Tab is not available");
      state.activePageIndex = input.index;
      break;
    }
    case "closeTab": {
      const pages = livePages(state);
      const target = pages[input.index];
      if (!target) throw new Error("Tab is not available");
      if (pages.length === 1 && state.context) {
        await target.close().catch(() => null);
        const nextPage = await state.context.newPage();
        await nextPage.goto("about:blank");
        state.pages = [nextPage];
        state.activePageIndex = 0;
      } else {
        await target.close().catch(() => null);
        state.pages = livePages(state);
        state.activePageIndex = Math.min(input.index, state.pages.length - 1);
      }
      break;
    }
    case "setDevice": {
      const mode = input.mode === "mobile" ? "mobile" : "desktop";
      const currentPages = livePages(state);
      const urls = currentPages.map((tab) => tab.url()).filter(Boolean);
      const activeIndex = state.activePageIndex || 0;
      await state.context?.close().catch(() => null);
      await createContext(state, mode);
      if (!state.context) throw new Error("Live browser context is not ready");
      state.pages = [];
      for (const url of urls.length ? urls : ["about:blank"]) {
        const nextPage = await state.context.newPage();
        state.pages.push(nextPage);
        await nextPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      }
      state.activePageIndex = Math.min(activeIndex, state.pages.length - 1);
      break;
    }
    case "setNetwork": {
      const mode = ["direct", "tor", "custom"].includes(input.mode) ? input.mode : "direct";
      const currentPages = livePages(state);
      const urls = currentPages.map((tab) => tab.url()).filter(Boolean);
      const activeIndex = state.activePageIndex || 0;

      await state.context?.close().catch(() => null);
      await state.browser?.close().catch(() => null);
      state.browser = undefined;
      state.context = undefined;
      state.pages = [];
      state.activePageIndex = 0;
      state.networkMode = mode;

      await launchBrowser(state);
      const context = await createContext(state, state.deviceMode || "desktop");
      for (const url of urls.length ? urls : ["about:blank"]) {
        const nextPage = await context.newPage();
        state.pages.push(nextPage);
        await nextPage.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => null);
      }
      state.activePageIndex = Math.min(activeIndex, state.pages.length - 1);
      state.startedAt = new Date().toISOString();
      break;
    }
  }

  return getAdminLiveBrowserStatus();
}

export async function captureAdminLiveBrowserScreenshot() {
  const state = await getAdminLiveBrowser();
  const page = activePage(state);
  if (!page || page.isClosed()) {
    throw new Error("Live browser is not ready");
  }

  return page.screenshot({
    type: "jpeg",
    quality: 68,
    fullPage: false,
  });
}

export async function inspectAdminLiveBrowserPage(maxChars = 8_000) {
  const state = await getAdminLiveBrowser();
  const page = activePage(state);
  if (!page || page.isClosed()) {
    throw new Error("Live browser is not ready");
  }

  const snapshot = await page.evaluate((limit) => {
    const text = (document.body?.innerText || "")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, limit);
    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => {
        const element = anchor as HTMLAnchorElement;
        return {
          text: (element.innerText || element.getAttribute("aria-label") || "").trim().slice(0, 140),
          href: element.href,
        };
      })
      .filter((link) => link.href && /^https?:\/\//i.test(link.href))
      .slice(0, 80);
    return { text, links };
  }, maxChars);

  return {
    url: page.url(),
    title: await page.title().catch(() => ""),
    text: snapshot.text,
    links: snapshot.links,
  };
}

export async function closeAdminLiveBrowser() {
  const state = runtime();
  await state.context?.close().catch(() => undefined);
  await state.browser?.close().catch(() => undefined);
  state.context = undefined;
  state.browser = undefined;
  state.pages = undefined;
  state.activePageIndex = undefined;
  state.startedAt = undefined;
  state.networkMode = undefined;
}
