// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Logging in with a key instead of a typed code.
 *
 * This is the one door in the passkey office that a stranger is allowed to knock on — it opens the
 * dashboard, so every refusal below is the point of the test, not decoration:
 *  - the credential is looked up BEFORE the verifier is asked, because without the stored public key
 *    there is nothing to verify against, and a crash there would look like a broken device;
 *  - `verified` decides, never the presence of a response;
 *  - a key that belongs to a non-admin account must not mint an admin session;
 *  - the session is minted from the verified key alone — no password crosses this door;
 *  - the counter write is read back, and its refusal is named instead of swallowed;
 *  - the challenge answers once.
 */
const world = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  cookieOptions: [] as { name: string; options: Record<string, unknown> }[],
  cookieDeleted: [] as string[],
  authOptions: null as any,
  verifyResult: { verified: true, authenticationInfo: {} } as any,
  verifyCalls: [] as any[],
  verifyThrows: false,
  credentialRow: null as any,
  credentialError: null as any,
  updates: [] as any[],
  updateReadBack: null as any,
  userById: null as any,
  userError: null as any,
  link: null as any,
  linkError: null as any,
  linkCalls: 0,
  session: null as any,
  sessionError: null as any,
  sessionInput: null as any,
  alerts: [] as string[],
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (world.cookies.has(name) ? { value: world.cookies.get(name) } : undefined),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      world.cookies.set(name, value);
      world.cookieOptions.push({ name, options });
    },
    delete: (name: string) => {
      world.cookies.delete(name);
      world.cookieDeleted.push(name);
    },
  }),
}));

vi.mock("@simplewebauthn/server", () => ({
  generateAuthenticationOptions: async (input: any) => {
    world.authOptions = input;
    return { ...input, challenge: "login-chal-123", allowCredentials: [] };
  },
  verifyAuthenticationResponse: async (input: any) => {
    world.verifyCalls.push(input);
    if (world.verifyThrows) throw new Error("The client data JSON is invalid");
    return world.verifyResult;
  },
}));

const storedKey = Buffer.from([9, 8, 7]);

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    auth: {
      admin: {
        getUserById: async () =>
          world.userError
            ? { data: null, error: world.userError }
            : { data: { user: world.userById }, error: null },
        generateLink: async () => {
          world.linkCalls += 1;
          return world.linkError
            ? { data: null, error: world.linkError }
            : { data: world.link, error: null };
        },
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          // A real `.maybeSingle()` answers {data:null,error:null} when the drawer has no such row,
          // and a refusal carries a code — the door has to tell those two apart.
          maybeSingle: async () => ({ data: world.credentialRow, error: world.credentialError }),
        }),
      }),
      update: (row: any) => {
        world.updates.push(row);
        return {
          eq: () => ({
            select: () => ({ single: async () => ({ data: world.updateReadBack, error: null }) }),
          }),
        };
      },
    }),
  }),
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      verifyOtp: async (input: any) => {
        world.sessionInput = input;
        return world.sessionError
          ? { data: null, error: world.sessionError }
          : { data: { session: world.session, user: world.userById }, error: null };
      },
    },
  }),
}));

vi.mock("@/lib/telegram-notify", () => ({
  sendSecurityAlert: async (text: string) => {
    world.alerts.push(text);
  },
}));

const optionsRoute = await import("@/app/api/admin/passkeys/authenticate/options/route");
const verifyRoute = await import("@/app/api/admin/passkeys/authenticate/verify/route");

const ADMIN_EMAIL = "azenithliving@gmail.com";
const credentialId = Buffer.from([1, 2, 3, 4]).toString("base64url");

const assertionBody = () => ({
  response: {
    id: credentialId,
    rawId: credentialId,
    type: "public-key",
    response: {
      authenticatorData: "auth-data",
      clientDataJSON: "client-data",
      signature: "sig",
      userHandle: null,
    },
  },
});

const requestWith = (body: unknown) =>
  ({
    json: async () => body,
    headers: new Headers({ "x-forwarded-for": "203.0.113.9", "user-agent": "vitest" }),
  }) as never;

beforeEach(() => {
  // The admin allow-list is read from the environment at call time (`lib/admin-access.ts`), so the
  // test states which account is the owner's instead of depending on a deployment's env file.
  process.env.ADMIN_GATE_EMAIL = ADMIN_EMAIL;
  delete process.env.ADMIN_GATE_ALLOWED_EMAILS;
  world.cookies = new Map();
  world.cookieOptions.length = 0;
  world.cookieDeleted.length = 0;
  world.verifyCalls.length = 0;
  world.verifyThrows = false;
  world.updates.length = 0;
  world.alerts.length = 0;
  world.linkCalls = 0;
  world.sessionInput = null;
  world.authOptions = null;
  world.credentialRow = {
    id: "row-1",
    user_id: "u-owner",
    credential_id: credentialId,
    public_key: storedKey.toString("base64url"),
    counter: 41,
    label: "تليفوني",
    transports: "internal",
  };
  world.credentialError = null;
  world.updateReadBack = { counter: 42, last_used_at: "2026-11-06T18:00:00.000Z" };
  world.userById = { id: "u-owner", email: ADMIN_EMAIL };
  world.userError = null;
  world.link = { properties: { hashed_token: "hashed-otp" }, user: world.userById };
  world.linkError = null;
  world.session = { access_token: "at", refresh_token: "rt" };
  world.sessionError = null;
  world.verifyResult = {
    verified: true,
    authenticationInfo: {
      credentialID: credentialId,
      newCounter: 42,
      userVerified: true,
      credentialDeviceType: "singleDevice",
      credentialBackedUp: false,
      origin: "https://azenith-living.vercel.app",
      rpID: "azenith-living.vercel.app",
    },
  } as any;
});

describe("the login challenge", () => {
  it("is handed to an anonymous browser — this door is how you get in", async () => {
    const res = await optionsRoute.POST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.challenge).toBe("login-chal-123");
  });

  it("asks for the owner's own device and never for a typed password", async () => {
    await optionsRoute.POST();

    expect(world.authOptions.userVerification).toBe("required");
    expect(world.authOptions.allowCredentials).toEqual([]);
    expect(world.authOptions.rpID).toBe("azenith-living.vercel.app");
  });

  it("keeps the challenge in an http-only cookie scoped to the passkey doors", async () => {
    await optionsRoute.POST();

    const stored = world.cookieOptions.at(-1);
    expect(stored?.name).toBe("passkey_login_challenge");
    expect(stored?.options.httpOnly).toBe(true);
    expect(stored?.options.sameSite).toBe("strict");
    expect(stored?.options.path).toBe("/api/admin/passkeys");
    expect(Number(stored?.options.maxAge)).toBeLessThanOrEqual(300);
  });
});

describe("the login door", () => {
  it("refuses when no challenge was issued, and never asks the verifier", async () => {
    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(String(body.message)).toContain("تحدي");
    expect(world.verifyCalls).toEqual([]);
    expect(world.sessionInput).toBeNull();
  });

  it("looks the key up before verifying, and refuses one that was never enrolled", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.credentialRow = null;

    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(String(body.message)).toContain("مش مسجّل");
    expect(world.verifyCalls).toEqual([]);
  });

  it("names a record that refused the lookup instead of calling it an unknown key", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.credentialError = { code: "PGRST205", message: "Could not find the table" };

    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(String(body.message)).toContain("ما ردّش");
    expect(String(body.message)).not.toContain("مش مسجّل");
  });

  it("refuses an enrolled key that carries no public key text", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.credentialRow = { ...world.credentialRow, public_key: null };

    const res = await verifyRoute.POST(requestWith(assertionBody()));

    expect(res.status).toBe(401);
    expect(world.verifyCalls).toEqual([]);
  });

  it("verifies against the store's own origin and rp id, with the stored counter", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");

    await verifyRoute.POST(requestWith(assertionBody()));

    const call = world.verifyCalls[0];
    expect(call.expectedChallenge).toBe("login-chal-123");
    expect(call.expectedOrigin).toBe("https://azenith-living.vercel.app");
    expect(call.expectedRPID).toBe("azenith-living.vercel.app");
    expect(call.requireUserVerification).toBe(true);
    expect(call.credential.id).toBe(credentialId);
    expect(Buffer.from(call.credential.publicKey).equals(storedKey)).toBe(true);
    expect(call.credential.counter).toBe(41);
  });

  it("refuses what the verifier did not verify, and mints no session", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.verifyResult = { verified: false, authenticationInfo: {} } as any;

    const res = await verifyRoute.POST(requestWith(assertionBody()));

    expect(res.status).toBe(401);
    expect(world.sessionInput).toBeNull();
  });

  it("refuses a device answer the browser could not make, and says the device failed", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.verifyThrows = true;

    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(String(json.message)).toContain("الجهاز");
    expect(world.sessionInput).toBeNull();
  });

  it("never opens the dashboard for a key that belongs to a non-admin account", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.userById = { id: "u-customer", email: "customer@example.com" };

    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.success).toBe(false);
    expect(world.linkCalls).toBe(0);
    expect(world.sessionInput).toBeNull();
  });

  it("mints the session from the verified key alone — no password is asked or sent", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");

    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.signedIn).toBe(true);
    expect(world.sessionInput).toEqual({ token_hash: "hashed-otp", type: "email" });
    expect(json.message).toContain("تليفوني");
    expect(JSON.stringify(json)).not.toContain(credentialId);
  });

  it("records the new counter and reads it back from the record", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");

    await verifyRoute.POST(requestWith(assertionBody()));

    expect(world.updates[0].counter).toBe(42);
    expect(typeof world.updates[0].last_used_at).toBe("string");
  });

  it("says so when the counter write was refused, without revoking a login that really happened", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.updateReadBack = null;

    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.counterNote).toContain("ما اتأكدش");
  });

  it("fails loudly when the session could not be minted, and never claims a login", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");
    world.sessionError = { message: "otp expired" };

    const res = await verifyRoute.POST(requestWith(assertionBody()));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.success).toBe(false);
    expect(String(json.message)).toContain("الدخول ما كملش");
  });

  it("clears the challenge after the attempt so the same answer cannot be replayed", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");

    await verifyRoute.POST(requestWith(assertionBody()));

    expect(world.cookieDeleted).toContain("passkey_login_challenge");
  });

  it("alerts the owner in Arabic with the key's own name and no machine identifier", async () => {
    world.cookies.set("passkey_login_challenge", "login-chal-123");

    await verifyRoute.POST(requestWith(assertionBody()));

    expect(world.alerts).toHaveLength(1);
    expect(world.alerts[0]).toContain("تليفوني");
    expect(world.alerts[0]).not.toContain(credentialId);
  });
});
