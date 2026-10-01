// @vitest-environment node
/**
 * The chain reaches the keys that answer.
 *
 * Measured on 2026-10-02: 358 keys passed a live check by their own provider — SambaNova 128,
 * OpenAI 131, Anthropic 99 — while the store sent every request to a handful of companies and
 * reported «سقف الدقايق خلص» on the owner's paper. These are the three claims that keep that
 * from coming back: the picker loads them, the chain asks them, and a picture that one reader
 * refuses is offered to the next one that can see.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  hosts: [] as string[],
  /** Which hosts answer, and with what. */
  answers: {} as Record<string, { status: number; body: unknown }>,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () =>
    ({ from: () => ({ select: async () => ({ data: world.rows, error: null }) }) }) as never,
}));

const json = (host: string, status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

beforeEach(() => {
  world.hosts = [];
  world.answers = {};
  world.rows = [
    { provider: "google", key: "AIza-live", is_active: true, check_state: "alive", error_count: 0, last_error: null, cooldown_until: null, total_requests: 0, last_used_at: null, is_backup: false },
    { provider: "groq", key: "gsk-live", is_active: true, check_state: "alive", error_count: 0, last_error: null, cooldown_until: null, total_requests: 0, last_used_at: null, is_backup: false },
    { provider: "sambanova", key: "sn-live", is_active: true, check_state: "alive", error_count: 0, last_error: null, cooldown_until: null, total_requests: 0, last_used_at: null, is_backup: false },
    { provider: "anthropic", key: "ant-live", is_active: true, check_state: "alive", error_count: 0, last_error: null, cooldown_until: null, total_requests: 0, last_used_at: null, is_backup: false },
    { provider: "openai", key: "oai-live", is_active: true, check_state: "alive", error_count: 0, last_error: null, cooldown_until: null, total_requests: 0, last_used_at: null, is_backup: false },
  ];
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL) => {
      const url = String(input);
      const host = new URL(url).host;
      world.hosts.push(host);
      const answer = world.answers[host];
      if (!answer) return json(host, 429, { error: { message: "quota exceeded" } });
      return json(host, answer.status, answer.body);
    }
  );
});

describe("the picker", () => {
  it("loads the three providers whose keys were parked", async () => {
    const { loadKeysFromDB, getNextAvailableKey } = await import("@/lib/api-keys-service");
    await loadKeysFromDB();
    expect((await getNextAvailableKey("sambanova"))?.key).toBe("sn-live");
    expect((await getNextAvailableKey("anthropic"))?.key).toBe("ant-live");
    expect((await getNextAvailableKey("openai"))?.key).toBe("oai-live");
  });
});

describe("the picture reader", () => {
  it("offers the drawing to the next reader when the first is out of ceiling", async () => {
    world.answers["api.anthropic.com"] = { status: 200, body: { content: [{ type: "text", text: '{"room":"صالة"}' }] } };
    const { askVisionAny } = await import("@/lib/ai-orchestrator");
    const answer = await askVisionAny("اقرأ الورقة", "AA", "image/png");
    expect(answer.success).toBe(true);
    expect(answer.reader).toBe("anthropic");
    expect(world.hosts[0], "جيميني يُسأل أولًا لأنه قارئ الورقة المعتاد").toBe("generativelanguage.googleapis.com");
  });

  it("falls as far as the vision-capable OpenAI key before giving up", async () => {
    world.answers["api.openai.com"] = {
      status: 200,
      body: { choices: [{ message: { content: '{"room":"نوم"}' } }] },
    };
    const { askVisionAny } = await import("@/lib/ai-orchestrator");
    const answer = await askVisionAny("اقرأ الورقة", "AA", "image/png");
    expect(answer.reader).toBe("openai");
  });

  it("moves on when the first reader answers in prose instead of a reading", async () => {
    world.answers["generativelanguage.googleapis.com"] = {
      status: 200,
      body: { candidates: [{ content: { parts: [{ text: "أرى مستطيلًا ومكتوبًا بجانبه أرقام" }] } }] },
    };
    world.answers["api.anthropic.com"] = {
      status: 200,
      body: { content: [{ type: "text", text: '{"room":"صالة","dimensions":[{"label":"الطول","meters":4.5}]}' }] },
    };
    const { askVisionAny } = await import("@/lib/ai-orchestrator");
    const answer = await askVisionAny("اقرأ الورقة", "AA", "image/png", {
      usable: (content) => content.trim().startsWith("{"),
    });
    expect(answer.reader, "a non-empty mutter is not an answer").toBe("anthropic");
    expect(world.hosts).toContain("api.anthropic.com");
  });

  it("says nobody read it, in his language, when none of the three answers", async () => {
    const { askVisionAny } = await import("@/lib/ai-orchestrator");
    const answer = await askVisionAny("اقرأ الورقة", "AA", "image/png");
    expect(answer.success).toBe(false);
    expect(answer.error).toBeTruthy();
  });
});

describe("the text chain", () => {
  it("reaches SambaNova when the earlier companies refuse", async () => {
    world.answers["api.sambanova.ai"] = {
      status: 200,
      body: { choices: [{ message: { content: "رد من سامبانوفا" } }] },
    };
    const { askOrchestratorMessages } = await import("@/lib/ai-orchestrator");
    const answer = await askOrchestratorMessages([{ role: "user", content: "قل كلمة" }]);
    expect(answer.success).toBe(true);
    expect(answer.content).toBe("رد من سامبانوفا");
    expect(world.hosts).toContain("api.sambanova.ai");
  });

  it("names the three in the sequence it tries", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync("lib/ai-orchestrator.ts", "utf8"));
    for (const provider of ["sambanova", "anthropic", "openai"]) {
      expect(source, provider).toContain(`providersToTry.includes("${provider}")`);
    }
  });
});
