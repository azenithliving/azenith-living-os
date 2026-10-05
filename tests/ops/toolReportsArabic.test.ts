// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The two lines the daily report borrows from the tool layer.
 *
 * Measured in the source before this file existed: `getSystemHealth` returned
 * «✅ النظام healthy» off a `const status = "healthy"` that no check ever sets, and counted
 * pending work through an empty `catch {}` — so a database that refused to answer was reported to
 * the owner as a healthy system with zero waiting tasks. `getAnalyticsReport` printed
 * «👥: 12 | 📋: 3 | ✅: 1 | 📈: 8.3% | 💬: 9»: Latin numerals, pipe separators, and five numbers
 * whose labels are emoji. Both also turned a failed read into a zero.
 *
 * The client is mocked because the failure path is the point: the live store cannot be made to
 * refuse on demand. The happy path is proven separately on the built server.
 */
const read = vi.hoisted(() => ({ fail: false }));

vi.mock("@/lib/supabase", () => {
  const chain = (table: string) => {
    const self: Record<string, unknown> = {};
    const settle = (resolve: (v: unknown) => void) =>
      resolve(
        read.fail
          ? { data: null, error: { message: `relation "${table}" is unavailable` } }
          : table === "users"
            ? { data: [{ id: "u1" }, { id: "u2" }, { id: "u3" }, { id: "u4" }, { id: "u5" }, { id: "u6" }], error: null }
            : table === "requests"
              ? { data: [{ id: "r1", status: "accepted" }, { id: "r2", status: "new" }, { id: "r3", status: "new" }], error: null }
              : { data: [{ type: "whatsapp_click" }, { type: "whatsapp_click" }], error: null }
      );
    for (const m of ["select", "gte", "eq", "order", "limit"]) self[m] = () => self;
    self.then = (resolve: (v: unknown) => void) => settle(resolve);
    return self;
  };
  return {
    getSupabaseServerClient: () => ({ from: (table: string) => chain(table) }),
    createServerClient: () => ({ from: (table: string) => chain(table) }),
  };
});

const { getSystemHealth, getAnalyticsReport } = await import("@/lib/architect-tools");

beforeEach(() => {
  read.fail = false;
});

const arabicOnly = (text: string) => expect(text.match(/[A-Za-z0-9]/g) ?? [], text).toEqual([]);

describe("the health line says what was actually measured", () => {
  it("names the store as answering, and counts waiting work in his numerals", async () => {
    const result = await getSystemHealth();
    const message = String(result.message);
    expect(message).toContain("مستنية");
    expect(message).toContain("٠");
    arabicOnly(message);
  });

  it("refuses to call the store healthy when the store did not answer", async () => {
    read.fail = true;
    const result = await getSystemHealth();
    const message = String(result.message);
    expect(result.success).toBe(false);
    expect(message).toMatch(/مش معروف|ما ردّتش/);
    expect(message).not.toContain("مستنية ٠");
    arabicOnly(message);
  });

  it("keeps the waiting count out of the message when it is unknown", async () => {
    read.fail = true;
    const { data } = await getSystemHealth();
    expect((data as { pendingTasks: number | null }).pendingTasks).toBeNull();
  });
});

describe("the analytics line reads as Arabic, not as a scoreboard of emoji", () => {
  it("labels every number in words he reads", async () => {
    const message = String((await getAnalyticsReport({ days: 30 })).message);
    for (const label of ["عملاء في الدفتر", "طلبات", "مقبولة", "نسبة التحويل", "دوسات واتساب"]) {
      expect(message, label).toContain(label);
    }
    expect(message).not.toContain("|");
    arabicOnly(message);
  });

  it("counts from the rows it got, in his numerals", async () => {
    const message = String((await getAnalyticsReport({ days: 30 })).message);
    expect(message).toContain("٦");
    expect(message).toContain("٣");
    expect(message).toContain("١");
    expect(message).toContain("٣٠");
  });

  it("says a number is unknown instead of reporting a failed read as zero", async () => {
    read.fail = true;
    const result = await getAnalyticsReport({ days: 30 });
    const message = String(result.message);
    expect(result.success).toBe(false);
    expect(message).toMatch(/مش معروف|ما ردّتش/);
    expect(message).not.toContain("عملاء في الدفتر ٠");
    arabicOnly(message);
  });
});
