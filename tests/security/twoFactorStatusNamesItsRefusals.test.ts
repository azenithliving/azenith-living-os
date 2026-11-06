// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The protection-status door answers two questions: is the code lock on, and is a door key enrolled.
 *
 * Measured 2026-11-06 on the published site with the owner's session, it answered
 * `enabled:true, hasPublicKey:false`. The `false` was not a measurement: the keys drawer does not
 * exist in the record, the door threw the refusal away (`keyError` was never read) and reported the
 * absence as a fact. A report that says «مفيش مفتاح» while the record refused to answer is the same
 * silent refusal this phase exists to kill — and it is exactly what an owner installs a key desk to fix.
 */
const world = vi.hoisted(() => ({
  auth: { data: { user: { id: "u-owner", email: "azenithliving@gmail.com" } } },
  answers: {} as Record<string, { data: unknown; error: unknown }>,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => world.auth },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => world.answers[table] ?? { data: null, error: null },
        }),
      }),
    }),
  }),
}));

const call = async () => {
  const route = await import("@/app/api/admin/2fa/status/route");
  const res = await route.GET({} as never);
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  world.auth = { data: { user: { id: "u-owner", email: "azenithliving@gmail.com" } } };
  world.answers = {};
});

describe("the protection-status door tells measured states apart from refusals", () => {
  it("names a refused drawer instead of reporting that no key is enrolled", async () => {
    world.answers.user_public_keys = { data: null, error: { code: "PGRST205", message: 'Could not find the table' } };
    world.answers.user_2fa = { data: null, error: null };

    const { body } = await call();

    expect(body.publicKeyState).toBe("not-measured");
    expect(body.publicKeyNote).toContain("ما ردّش");
    expect(body).not.toHaveProperty("hasPublicKey");
  });

  it("reports no key when the drawer answered and held nothing", async () => {
    world.answers.user_public_keys = { data: null, error: null };

    const { body } = await call();

    expect(body.publicKeyState).toBe("none");
    expect(body.hasPublicKey).toBe(false);
  });

  it("reports the enrolled key with its date when the drawer answered", async () => {
    world.answers.user_public_keys = { data: { created_at: "2026-11-06T10:00:00Z" }, error: null };

    const { body } = await call();

    expect(body.publicKeyState).toBe("enrolled");
    expect(body.hasPublicKey).toBe(true);
    expect(body.publicKeyDate).toBe("2026-11-06T10:00:00Z");
  });

  it("says the code lock is not measured when its own drawer refused", async () => {
    world.answers.user_2fa = { data: null, error: { code: "42501", message: "permission denied" } };

    const { body } = await call();

    expect(body.twoFactorState).toBe("not-measured");
    expect(body).not.toHaveProperty("enabled");
  });

  it("refuses an anonymous caller without touching the drawers", async () => {
    world.auth = { data: { user: null } };

    const { status } = await call();

    expect(status).toBe(401);
  });
});
