// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The picture button on a customer's room page.
 *
 * Measured in the source before this file existed: when the reader did not answer, the door
 * returned `success: true` with `detectedStyle: "modern"`, `styleAr: "مودرن"` and
 * `description: "تصميم داخلي أنيق"` — a reading invented for whatever picture the customer had
 * just liked — and an unreadable reply fell through to the same «modern» default. It also asked
 * one company by name (`askOpenRouter`) and, on its exception path, printed `error.message` at a
 * customer. The store's own law is that a measurement which did not happen is named, not guessed.
 *
 * The reader is mocked because the no-answer branch is the thing under test; the happy path is
 * asserted against the same handler with the same fake answering.
 */
const chain = vi.hoisted(() => ({ reply: null as null | { success: boolean; content: string; reader?: string } }));

vi.mock("@/lib/ai-orchestrator", () => ({
  askVisionAny: vi.fn(async () => chain.reply ?? { success: false, content: "", error: "NO_KEY" }),
  // The door's own reader: it answers when the chain answers and says so plainly when it does not.
  // A throwing mock here would only ever exercise the handler's last resort.
  askOpenRouter: vi.fn(async () => chain.reply ?? { success: false, content: "", error: "NO_KEY" }),
  askAllam: vi.fn(async () => ({ success: false, content: "", error: "NO_KEY" })),
}));

const { POST } = await import("@/app/api/analyze-image/route");

// A web `Request`, not a hand-built `NextRequest`: constructing the latter from a URL and an
// init object produced an object without `.json`, and every case then measured the harness.
const asRequest = (init: RequestInit) =>
  new Request("http://localhost/api/analyze-image", init) as unknown as NextRequest;

const post = (body: unknown) =>
  POST(asRequest({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  chain.reply = null;
});

describe("the reading a customer is shown", () => {
  it("reports the style the reader named when a reader answered", async () => {
    chain.reply = {
      success: true,
      reader: "anthropic",
      content: '{"style":"classic","styleAr":"كلاسيك","description":"خشب داكن وإضاءة دافئة"}',
    };
    const data = await (await post({ imageUrl: "https://images.unsplash.com/photo-1", currentRoomId: "living-room" })).json();
    expect(data.analysis.style).toBe("classic");
    expect(data.analysis.styleAr).toBe("كلاسيك");
    expect(data.analysis.read).toBe(true);
    expect(data.answered_by).toContain("مفاتيحك");
  });

  it("invents nothing when no reader answered", async () => {
    const data = await (await post({ imageUrl: "https://images.unsplash.com/photo-1", currentRoomId: "living-room" })).json();
    expect(data.analysis.read).toBe(false);
    expect(data.analysis.style).toBeNull();
    expect(data.analysis.styleAr).toBeNull();
    expect(JSON.stringify(data.analysis)).not.toContain("مودرن");
    expect(data.analysis.message).toMatch(/ما قدرناش|ما قرأناش/);
    expect(data.answered_by).toContain("قواعد المتجر");
  });

  it("does not fall through to a default when the answer cannot be read", async () => {
    chain.reply = { success: true, reader: "google", content: "دي صورة حلوة جداً" };
    const data = await (await post({ imageUrl: "https://images.unsplash.com/photo-1", currentRoomId: "living-room" })).json();
    expect(data.analysis.read).toBe(false);
    expect(data.analysis.style).toBeNull();
  });

  it("refuses a missing picture in Arabic, not with an English status word", async () => {
    const response = await post({ currentRoomId: "living-room" });
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(String(data.error).match(/[A-Za-z]{3,}/g) ?? []).toEqual([]);
  });

  it("refuses a body that is not JSON at all in Arabic too", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await fetchBroken();
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(String(data.error).match(/[A-Za-z]{3,}/g) ?? []).toEqual([]);
    spy.mockRestore();
  });

  /**
   * The handler's last resort, reached by making the reader itself throw — an unparseable body is
   * a bad request and answers 400 before that, which is the behaviour above, not this one.
   */
  it("answers its own failure in Arabic and never leaks an exception string", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { askOpenRouter } = await import("@/lib/ai-orchestrator");
    vi.mocked(askOpenRouter).mockRejectedValueOnce(new Error("fetch failed: ECONNRESET to 10.0.0.9"));
    const data = await (await post({ imageUrl: "https://images.unsplash.com/photo-1", currentRoomId: "kitchen" })).json();
    expect(String(data.analysis.message).match(/[A-Za-z]{3,}/g) ?? []).toEqual([]);
    expect(data.analysis.style).toBeNull();
    expect(data.answered_by).toContain("قواعد المتجر");
    spy.mockRestore();
  });
});

/** A body that is not JSON at all: the handler's own catch path. */
async function fetchBroken() {
  return POST(asRequest({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  }));
}
