// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What the store calls «the owner was told».
 *
 * Measured 2026-10-06: the owner said no Telegram notice ever reached his phone, while the sheet's
 * own record said the pulse was sent and stamped it. The messenger's answer is read only as an HTTP
 * status — and the Bot API answers `200` with `ok:false` inside the body when it refuses (a blocked
 * bot, a chat that no longer exists, a malformed address). A refusal wearing a success status is the
 * worst possible shape for this channel: the sheet is stamped, the rule stays silent, and everybody
 * believes the owner was woken.
 *
 * So delivery is counted only when the body itself says so, and the chat it landed in is named.
 */
/** The only token this file is allowed to talk to: it never leaves the fixture. */
const FAKE_TOKEN = vi.hoisted(() => "123456:TEST-token-never-printed");

const world = vi.hoisted(() => ({
  response: { ok: true, status: 200, body: { ok: true, result: { message_id: 645, chat: { id: 9999991815 } } } },
  throws: false,
  /** Chat ids the messenger refuses, whatever the status line says. */
  refuses: [] as string[],
  calls: [] as any[],
}));

vi.mock("@/lib/supabase-service", () => ({
  supabaseService: {
    from: () => ({
      select: () => ({
        eq: () => ({
          // The store answers with `{ data: { value } }`; a fixture that returns the value directly
          // makes the resolver fall back to the real environment, and the test then sends real
          // messages to the owner's phone. Measured the hard way on 2026-10-06.
          maybeSingle: async () => ({
            data: {
              value: {
                botToken: FAKE_TOKEN,
                enabled: true,
                chats: [
                  { id: "admin", label: "admin", chatId: "9999991815", isDefault: true },
                  { id: "admin2", label: "Admin 2", chatId: "9999997315", isDefault: false },
                ],
              },
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

vi.mock("server-only", () => ({}));

const originalFetch = global.fetch;

beforeEach(() => {
  world.calls = [];
  world.throws = false;
  world.refuses = [];
  world.response = { ok: true, status: 200, body: { ok: true, result: { message_id: 645, chat: { id: 9999991815 } } } };
  global.fetch = (async (url: string, init: any) => {
    const address = String(url);
    /**
     * A guard, not a fixture: if the config ever resolves to anything but the token written above,
     * this file is about to message a real person from a test run.
     */
    if (!address.includes(FAKE_TOKEN)) throw new Error("a unit test must never send with a real bot token");
    const chatId = String(JSON.parse(init?.body ?? "{}").chat_id ?? "");
    world.calls.push({ url: address, chatId });
    if (world.throws) throw new Error("network down");
    const refused = world.refuses.includes(chatId);
    return {
      ok: world.response.ok,
      status: world.response.status,
      json: async () =>
        refused ? { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } : world.response.body,
    };
  }) as never;
});

afterEach(() => {
  global.fetch = originalFetch;
});

const send = async () => {
  const { sendTelegramMessage, clearTelegramConfigCache } = await import("@/lib/telegram-config");
  clearTelegramConfigCache();
  return sendTelegramMessage("عميل ساخن جداً");
};

describe("a notice is delivered only when the messenger says it was", () => {
  it("counts a body that answers ok with a message id", async () => {
    expect(await send()).toBe(true);
  });

  it("refuses to call a refusal a success — 200 with ok:false is not delivery", async () => {
    world.response = {
      ok: true,
      status: 200,
      body: { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" },
    };
    expect(await send()).toBe(false);
  });

  it("refuses an ok body that carries no message to point at", async () => {
    world.response = { ok: true, status: 200, body: { ok: true, result: null } };
    expect(await send()).toBe(false);
  });

  it("refuses a body that cannot be read at all", async () => {
    world.response = { ok: true, status: 200, body: null };
    expect(await send()).toBe(false);
  });

  it("refuses when the transport itself fails", async () => {
    world.throws = true;
    expect(await send()).toBe(false);
  });

  it("names the chat the notice landed in, without printing the whole address or the token", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
      logged.push(a.map(String).join(" "));
    });
    expect(await send()).toBe(true);
    spy.mockRestore();
    const line = logged.join("\n");
    expect(line).toContain("…1815");
    expect(line).toContain("645");
    expect(line).not.toContain("9999991815");
    expect(line).not.toContain("TEST-token-never-printed");
  });
});

/**
 * A sales notice is for every admin the owner seated, not the first one in the list — measured
 * 2026-10-06: two chats are configured, the pulse used the default alone, and the account he
 * actually reads stayed silent while the sheet said «reported».
 */
describe("a broadcast counts the chats it woke", () => {
  const shout = async () => {
    const { broadcastTelegramMessage, clearTelegramConfigCache } = await import("@/lib/telegram-config");
    clearTelegramConfigCache();
    return broadcastTelegramMessage("عميل ساخن جداً");
  };

  it("reaches every configured chat and says how many", async () => {
    expect(await shout()).toBe(2);
    expect(world.calls.map((c) => c.chatId)).toEqual(["9999991815", "9999997315"]);
  });

  it("counts only the ones that answered with a message", async () => {
    world.refuses = ["9999997315"];
    expect(await shout()).toBe(1);
  });

  it("counts zero when every chat refused — nothing was said", async () => {
    world.refuses = ["9999991815", "9999997315"];
    expect(await shout()).toBe(0);
  });

  it("keeps going after one chat refuses, so a blocked account cannot silence the other", async () => {
    world.refuses = ["9999991815"];
    expect(await shout()).toBe(1);
    expect(world.calls).toHaveLength(2);
  });

  it("the single-recipient send still goes to the default chat only", async () => {
    expect(await send()).toBe(true);
    expect(world.calls).toHaveLength(1);
    expect(world.calls[0].chatId).toBe("9999991815");
  });
});
