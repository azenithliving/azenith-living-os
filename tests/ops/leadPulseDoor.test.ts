// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * The votes desk firing the golden moment.
 *
 * A second voter cannot exist unless the customer handed the link to someone else, so the desk
 * that counts votes is where the store learns the family is in the room together. These cases read
 * the real handler with only the two outside worlds replaced: the sheet's rows, and the messenger.
 */
const store = vi.hoisted(() => ({
  voters: ["أنا"],
  sheet: { id: 7, customerKey: "k", room: "living-room", city: "التجمع", hasPlan: true, pulseSentAt: null as string | null },
  stamped: false,
  returns: 0,
}));

vi.mock("@/lib/cad/family-votes", () => ({
  cleanVoter: (v: unknown) => String(v ?? "ضيف").trim().slice(0, 24) || "ضيف",
  findSketchByToken: async () => store.sheet,
  readVotes: async () => store.voters.map((voter) => ({ voter, image_key: "img-1", liked: true })),
  recordVote: async () => true,
  tallyVotes: () => ({}),
  stampPulseSent: async () => {
    store.stamped = true;
    return true;
  },
}));

/**
 * The sheet's own return counter. Mocked at the door rather than left to reach a database: the
 * votes desk has to read the real number from the store, and the arithmetic behind it is guarded
 * in `tests/cad/sheetVisits.test.ts`.
 */
vi.mock("@/lib/cad/sheet-visits", () => ({
  countReturns: async () => store.returns,
}));

const telegram = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/lib/telegram-config", () => ({
  sendTelegramMessage: (text: string) => telegram(text),
}));

const { POST } = await import("@/app/api/passport/[token]/votes/route");
const { newPassportToken } = await import("@/lib/cad/passport");

const vote = (voter: string) => {
  const request = new Request("http://localhost/api/passport/x/votes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_key: "img-1", voter, liked: true }),
  }) as unknown as NextRequest;
  return POST(request, { params: Promise.resolve({ token: newPassportToken() }) });
};

beforeEach(() => {
  store.voters = ["أنا"];
  store.sheet = { id: 7, customerKey: "k", room: "living-room", city: "التجمع", hasPlan: true, pulseSentAt: null };
  store.stamped = false;
  store.returns = 0;
  telegram.mockClear();
});

describe("the second voter wakes the owner", () => {
  it("says nothing while one person looks at a sheet with no paper on it", async () => {
    store.sheet.hasPlan = false;
    await vote("أنا");
    expect(telegram).not.toHaveBeenCalled();
  });

  /**
   * The architecture counts the paper itself as the first signal — «إذا رفع العميل صورة ورقية
   * للمقاسات... يصعد تصنيفه فوراً» — so a completed drawing wakes the owner even before a second
   * person taps. This case was written the other way round at first, which would have thrown the
   * strongest signal away.
   */
  it("wakes the owner the moment the customer's own paper is drawn", async () => {
    await vote("أنا");
    expect(telegram).toHaveBeenCalledTimes(1);
    expect(String(telegram.mock.calls[0][0])).toContain("ساخن جداً");
  });

  it("sends one pulse when a second person votes", async () => {
    store.voters = ["أنا", "مراتي"];
    await vote("مراتي");
    expect(telegram).toHaveBeenCalledTimes(1);
    const text = String(telegram.mock.calls[0][0]);
    expect(text).toContain("ساخن جداً");
    expect(text).toContain("التجمع");
    expect(text.match(/[A-Za-z]/g) ?? []).toEqual([]);
  });

  it("keeps quiet once the sheet has already been reported", async () => {
    store.voters = ["أنا", "مراتي"];
    store.sheet.pulseSentAt = "2026-10-06T00:00:00Z";
    await vote("مراتي");
    expect(telegram).not.toHaveBeenCalled();
  });

  it("does not stamp a pulse the messenger could not send", async () => {
    store.voters = ["أنا", "مراتي"];
    telegram.mockImplementationOnce(async () => false);
    await vote("مراتي");
    expect(store.stamped).toBe(false);
  });

  it("stamps the sheet once the owner was told", async () => {
    store.voters = ["أنا", "مراتي"];
    await vote("مراتي");
    expect(store.stamped).toBe(true);
  });

  /**
   * The third proof, and the only one a browser-only lead can give: he never raised a paper and
   * never shared the link, he just keeps coming back. Measured before this case: the desk passed a
   * literal zero for returns, so this branch of the rule was unreachable code.
   */
  it("wakes the owner on the fourth return, from the counter and not a guess", async () => {
    store.sheet.hasPlan = false;
    store.returns = 4;
    await vote("أنا");
    expect(telegram).toHaveBeenCalledTimes(1);
    const text = String(telegram.mock.calls[0][0]);
    expect(text).toContain("ساخن جداً");
    expect(text).toContain("٤");
    expect(text.match(/[A-Za-z]/g) ?? []).toEqual([]);
  });

  it("waits for the fourth return — the third is still just looking", async () => {
    store.sheet.hasPlan = false;
    store.returns = 3;
    await vote("أنا");
    expect(telegram).not.toHaveBeenCalled();
  });
});
