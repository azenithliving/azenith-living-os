// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * A switch the owner turned on must not be turned off by a missing environment variable.
 *
 * Measured live 2026-10-07: the store's own test door sent to both his chats (message ids 750 and
 * 751), yet the customer vote door sent nothing at all and left the sheet unstamped — and said
 * nothing while doing it. The difference is the fallback: when the panel row cannot be read, the
 * code asked the environment for `TELEGRAM_ENABLED === "true"`, and on the deployed app that name
 * is not set, so a feature he enabled silently stopped. The panel's own semantics are the opposite:
 * the row is on unless it says it is off.
 */
/** The panel row is forced away so these tests judge the fallback, not the live store. */
vi.mock("@/lib/supabase-service", () => ({
  supabaseService: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { message: "mocked away" } }),
        }),
      }),
    }),
  },
}));

const load = async () => {
  vi.resetModules();
  return import("@/lib/telegram-config");
};

describe("the on/off switch", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TELEGRAM_ENABLED;
    process.env.TELEGRAM_BOT_TOKEN = "FAKE_TOKEN_FOR_TEST";
    process.env.TELEGRAM_CHAT_ID = "11112222";
  });

  it("treats a missing environment flag as on, the way the panel row does", async () => {
    const mod = await load();
    const cfg = await mod.getActiveTelegramConfig();
    expect(cfg.enabled).toBe(true);
  });

  it("still obeys an explicit off", async () => {
    process.env.TELEGRAM_ENABLED = "false";
    const mod = await load();
    const cfg = await mod.getActiveTelegramConfig();
    expect(cfg.enabled).toBe(false);
  });
});

describe("silence is not an answer", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TELEGRAM_ENABLED;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it("says why it sent nothing instead of returning zero quietly", async () => {
    const seen: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
      seen.push(a.join(" "));
    });
    const mod = await load();
    const landed = await mod.broadcastTelegramMessage("رسالة اختبار");
    spy.mockRestore();
    expect(landed).toBe(0);
    expect(seen.some((l) => l.includes("[Telegram]") && /مفيش مفتاح|بدون مفتاح|لا مفتاح/i.test(l))).toBe(true);
  });
});
