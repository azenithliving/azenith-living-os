// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The protection-status door answers two questions: is the code lock on, and is a door key enrolled.
 *
 * Measured 2026-11-06 on the published site with the owner's session, it answered
 * `enabled:true, hasPublicKey:false`. The `false` was not a measurement: the keys drawer does not
 * exist in the record, the door threw the refusal away (`keyError` was never read) and reported the
 * absence as a fact.
 *
 * The shapes below are the record's own answers, measured with the service key the same day:
 * an empty `.single()` is NOT `{data:null,error:null}` — it answers error `PGRST116` («Cannot coerce
 * the result to a single JSON object»), which means the drawer answered and held nothing. A missing
 * table answers `PGRST205`, and a locked drawer answers `42501`. Confusing the first with the others
 * is what the first version of this fix did live, and it is why the mock mirrors the real codes.
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

const EMPTY_SINGLE = { code: "PGRST116", message: "Cannot coerce the result to a single JSON object" };
const MISSING_TABLE = { code: "PGRST205", message: "Could not find the table 'public.user_public_keys' in the schema cache" };
const LOCKED = { code: "42501", message: "permission denied for table user_2fa" };

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
    world.answers.user_public_keys = { data: null, error: MISSING_TABLE };
    world.answers.user_2fa = { data: null, error: EMPTY_SINGLE };

    const { body } = await call();

    expect(body.publicKeyState).toBe("not-measured");
    expect(body.publicKeyNote).toContain("ما ردّش");
    expect(body).not.toHaveProperty("hasPublicKey");
  });

  it("reports no key when the drawer answered empty — the record's own empty answer", async () => {
    world.answers.user_public_keys = { data: null, error: EMPTY_SINGLE };

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

  it("says the code lock is off when its drawer answered empty, not unmeasured", async () => {
    world.answers.user_2fa = { data: null, error: EMPTY_SINGLE };

    const { body } = await call();

    expect(body.twoFactorState).toBe("off");
    expect(body.enabled).toBe(false);
    expect(body).not.toHaveProperty("twoFactorNote");
  });

  it("says the code lock is not measured when its drawer was refused", async () => {
    world.answers.user_2fa = { data: null, error: LOCKED };

    const { body } = await call();

    expect(body.twoFactorState).toBe("not-measured");
    expect(body).not.toHaveProperty("enabled");
  });

  it("reports the code lock on only when the row really says on", async () => {
    world.answers.user_2fa = { data: { is_enabled: true, created_at: "x", updated_at: "y" }, error: null };

    const { body } = await call();

    expect(body.twoFactorState).toBe("on");
    expect(body.enabled).toBe(true);
  });

  it("refuses an anonymous caller without touching the drawers", async () => {
    world.auth = { data: { user: null } };

    const { status } = await call();

    expect(status).toBe(401);
  });
});
