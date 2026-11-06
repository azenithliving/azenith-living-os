// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Enrolling a door key: the browser's authenticator answers a challenge the server made, and only a
 * verified answer may reach the record — and a write that cannot be read back is not a save.
 *
 * The rules these guards hold, each learned the hard way in this store:
 *  - the challenge lives in an httpOnly cookie, because an in-process map dies with the request
 *    (measured on this platform: heavy per-request state finishes 0 of 17 times);
 *  - `requireAdminApi` is asked before anything is generated, so an anonymous caller gets nothing;
 *  - the verifier's `verified` flag decides, never the presence of a response;
 *  - a unique-key refusal is named as «this key is already enrolled», not swallowed as a zero;
 *  - the row is read back from the record before the door says it saved.
 */
const realInfo = () => ({
  // Mirrors the installed v14 type: `credential: { id, publicKey, counter, transports }`.
  fmt: "none",
  aaguid: "aag-1",
  credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 7, transports: ["internal"] },
  credentialType: "public-key",
  attestationObject: new Uint8Array(),
  userVerified: true,
  credentialDeviceType: "singleDevice",
  credentialBackedUp: false,
  origin: "https://azenith-living.vercel.app",
});

const world = vi.hoisted(() => ({
  allow: true,
  cookies: new Map<string, string>(),
  cookieOptions: [] as { name: string; options: Record<string, unknown> }[],
  cookieDeleted: [] as string[],
  verifyResult: { verified: true, registrationInfo: { fmt: "none", aaguid: "aag-1", credential: { id: "cred-1", publicKey: new Uint8Array([1, 2, 3]), counter: 7, transports: ["internal"] }, credentialType: "public-key", attestationObject: new Uint8Array(), userVerified: true, credentialDeviceType: "singleDevice", credentialBackedUp: false, origin: "https://azenith-living.vercel.app" } } as any,
  verifyCalls: [] as any[],
  insert: [] as any[],
  insertResult: { error: null } as any,
  readBack: [{ id: "row-1" }] as any[],
  existingRows: [] as any[],
  touched: [] as string[],
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

vi.mock("@/lib/admin-api-guard", () => ({
  requireAdminApi: async () =>
    world.allow
      ? { user: { id: "u-owner", email: "azenithliving@gmail.com" }, unauthorized: null }
      : { user: null, unauthorized: Response.json({ error: "ممنوع" }, { status: 401 }) },
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      world.touched.push(table);
      return {
        insert: (row: any) => {
          world.insert.push(row);
          return { select: () => ({ single: async () => ({ data: world.readBack[0] ?? null, error: world.insertResult.error }) }) };
        },
        select: () => ({
          // The real client's chain is awaitable at every step, and `.single()` is one step deeper.
          eq: () =>
            Object.assign(Promise.resolve({ data: world.existingRows, error: null }), {
              single: async () => ({ data: world.readBack[0] ?? null, error: null }),
              maybeSingle: async () => ({ data: world.readBack[0] ?? null, error: null }),
            }),
        }),
      };
    },
  }),
}));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: async (input: any) => ({
    ...input,
    challenge: "chal-123",
    rp: { id: input.rpID, name: input.rpName },
    user: { id: "d3Vt", name: input.userName, displayName: input.userDisplayName },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }],
  }),
  verifyRegistrationResponse: async (input: any) => {
    world.verifyCalls.push(input);
    return world.verifyResult;
  },
}));

const optionsRoute = await import("@/app/api/admin/passkeys/options/route");
const enrollRoute = await import("@/app/api/admin/passkeys/enroll/route");

const requestWith = (body: unknown) =>
  ({ json: async () => body, headers: new Headers({ origin: "https://azenith-living.vercel.app" }) }) as never;

const enrollmentBody = () => ({ label: "تليفوني", response: { id: "cred-1", type: "public-key", clientDataJSON: "cd" } });

beforeEach(() => {
  world.allow = true;
  world.cookies = new Map();
  world.cookieOptions.length = 0;
  world.cookieDeleted.length = 0;
  world.verifyCalls.length = 0;
  world.insert.length = 0;
  world.touched.length = 0;
  world.insertResult = { error: null };
  world.readBack = [{ id: "row-1" }];
  world.existingRows = [];
  world.verifyResult = { verified: true, registrationInfo: realInfo() } as any;
});

describe("the enrollment challenge", () => {
  it("hands the browser a challenge bound to the store's own address and the admin's account", async () => {
    const res = await optionsRoute.GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rp.id).toBe("azenith-living.vercel.app");
    expect(body.user.name).toBe("azenithliving@gmail.com");
    expect(body.challenge).toBe("chal-123");
  });

  it("keeps the challenge in an http-only cookie the browser cannot hand to a script", async () => {
    await optionsRoute.GET();

    const stored = world.cookieOptions.at(-1);
    expect(stored?.name).toBe("passkey_enroll_challenge");
    expect(stored?.options.httpOnly).toBe(true);
    expect(stored?.options.sameSite).toBe("strict");
    expect(Number(stored?.options.maxAge)).toBeLessThanOrEqual(300);
    expect(world.cookies.get("passkey_enroll_challenge")).toBe("chal-123");
  });

  it("refuses an anonymous caller without generating anything or setting a cookie", async () => {
    world.allow = false;

    const res = await optionsRoute.GET();

    expect(res.status).toBe(401);
    expect(world.cookieOptions).toEqual([]);
  });
});

describe("the enrollment door", () => {
  it("refuses when no challenge was issued, and never asks the verifier", async () => {
    const res = await enrollRoute.POST(requestWith(enrollmentBody()));

    expect(res.status).toBe(400);
    expect(world.verifyCalls).toEqual([]);
    expect(world.insert).toEqual([]);
  });

  it("refuses an empty label instead of storing an unnameable key", async () => {
    world.cookies.set("passkey_enroll_challenge", "chal-123");

    const res = await enrollRoute.POST(requestWith({ ...enrollmentBody(), label: "   " }));

    expect(res.status).toBe(400);
    expect(world.verifyCalls).toEqual([]);
  });

  it("refuses what the verifier did not verify, and writes nothing", async () => {
    world.cookies.set("passkey_enroll_challenge", "chal-123");
    world.verifyResult = { verified: false } as any;

    const res = await enrollRoute.POST(requestWith(enrollmentBody()));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.saved).toBe(false);
    expect(world.insert).toEqual([]);
  });

  it("stores the fields the verifier measured, and reads the row back before saying it saved", async () => {
    world.cookies.set("passkey_enroll_challenge", "chal-123");

    const res = await enrollRoute.POST(requestWith(enrollmentBody()));
    const body = await res.json();

    expect(body.saved).toBe(true);
    expect(world.insert).toHaveLength(1);
    const row = world.insert[0];
    expect(row.user_id).toBe("u-owner");
    expect(row.credential_id).toBe("cred-1");
    expect(row.public_key).toBe(Buffer.from([1, 2, 3]).toString("base64url"));
    expect(row.counter).toBe(7);
    expect(row.aaguid).toBe("aag-1");
    expect(row.device_type).toBe("singleDevice");
    expect(row.backed_up).toBe(false);
    expect(row.transports).toBe("internal");
    expect(row.origin).toBe("https://azenith-living.vercel.app");
    expect(row.label).toBe("تليفوني");
    expect(body.key.label).toBe("تليفوني");
    expect(String(body.message)).toContain("تليفوني");
  });

  it("never claims a save it could not read back", async () => {
    world.cookies.set("passkey_enroll_challenge", "chal-123");
    world.readBack = [];

    const res = await enrollRoute.POST(requestWith(enrollmentBody()));
    const body = await res.json();

    expect(body.saved).toBe(false);
    expect(String(body.message)).toContain("ما اتأكدش");
    expect(res.status).toBe(500);
  });

  it("names a key that is already enrolled instead of a silent failure", async () => {
    world.cookies.set("passkey_enroll_challenge", "chal-123");
    world.insertResult = { error: { code: "23505", message: "duplicate key value" } };

    const res = await enrollRoute.POST(requestWith(enrollmentBody()));
    const body = await res.json();

    expect(body.saved).toBe(false);
    expect(String(body.message)).toContain("مسجّل");
  });

  it("clears the challenge after one attempt so it cannot be replayed", async () => {
    world.cookies.set("passkey_enroll_challenge", "chal-123");

    await enrollRoute.POST(requestWith(enrollmentBody()));

    expect(world.cookieDeleted).toContain("passkey_enroll_challenge");
  });

  it("refuses an anonymous caller before touching the record", async () => {
    world.allow = false;
    world.cookies.set("passkey_enroll_challenge", "chal-123");

    const res = await enrollRoute.POST(requestWith(enrollmentBody()));

    expect(res.status).toBe(401);
    expect(world.touched).toEqual([]);
  });
});
