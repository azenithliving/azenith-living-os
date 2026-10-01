// @vitest-environment node
/**
 * Rotation that remembers what the desk already asked.
 *
 * The pool is not a lottery. The store has a verdict per key — asked of the company that
 * issued it, kept in `check_state` — and a request that spends itself on a key known to be
 * out of quota is a request the owner paid for twice. These are the three orders the picker
 * must keep: a key that answered alive, then one nobody has asked yet, then one whose
 * ceiling is spent, and never a key that was switched off for refusing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () =>
    ({
      from: () => ({
        select: async () => ({ data: world.rows, error: null }),
      }),
    }) as never,
}));

const row = (over: Record<string, unknown>) => ({
  provider: "google",
  cooldown_until: null,
  total_requests: 0,
  last_used_at: null,
  last_error: null,
  error_count: 0,
  is_active: true,
  is_backup: false,
  check_state: null,
  ...over,
});

describe("the picker's order", () => {
  beforeEach(() => {
    world.rows = [
      row({ key: "spent-ceiling", check_state: "quota", last_used_at: "2026-01-01T00:00:00.000Z" }),
      row({ key: "greeted-only", check_state: "alive", last_used_at: "2026-01-01T00:00:00.000Z" }),
      row({ key: "wrote-an-answer", check_state: "writes", last_used_at: "2026-01-01T00:00:00.000Z" }),
      row({ key: "never-asked", check_state: null }),
      row({ key: "revoked", check_state: "refused", is_active: false }),
      row({ key: "no-credit", check_state: "unfunded", is_active: false }),
    ];
  });

  it("asks the key that wrote first, then the unasked, then the greeter, then the spent", async () => {
    const { loadKeysFromDB, getNextAvailableKey } = await import("@/lib/api-keys-service");
    await loadKeysFromDB();

    const order = [(await getNextAvailableKey("google"))?.key, (await getNextAvailableKey("google"))?.key, (await getNextAvailableKey("google"))?.key, (await getNextAvailableKey("google"))?.key];

    expect(order).toEqual(["wrote-an-answer", "never-asked", "greeted-only", "spent-ceiling"]);
  });

  it("never puts a refused key into the work cycle, however idle it is", async () => {
    const { loadKeysFromDB, getNextAvailableKey } = await import("@/lib/api-keys-service");
    await loadKeysFromDB();
    for (let i = 0; i < 8; i++) {
      const picked = await getNextAvailableKey("google");
      if (picked) expect(picked.key).not.toBe("revoked");
    }
  });

  it("answers null when the provider has no key at all, so the surface falls to its floor", async () => {
    const { loadKeysFromDB, getNextAvailableKey } = await import("@/lib/api-keys-service");
    world.rows = [];
    await loadKeysFromDB();
    expect(await getNextAvailableKey("groq")).toBeNull();
  });
});
