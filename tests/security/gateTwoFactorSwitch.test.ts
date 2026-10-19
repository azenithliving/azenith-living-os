// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";

/**
 * The gate's second step, and the one sentence that turns it back on.
 *
 * Owner's word 2026-10-19: his phone was lost and the verification code locked him out of his own
 * dashboard, so he ordered password-only entry. These guards hold two things at once — his order is
 * actually honoured, and the code path is still there, one settings row away, with the safe answer
 * (ask for the code) standing whenever the store cannot be read.
 */
const maybeSingle = vi.fn();
const select = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) }));
const from = vi.fn(() => ({ select }));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({ from }),
}));

const { adminGateRequires2FA } = await import("@/lib/admin-gate");

const gate = readFileSync("app/api/admin/gate/validate/route.ts", "utf8");
const page = readFileSync("app/gate/login/page.tsx", "utf8");

describe("the switch that decides whether the code is asked for", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_GATE_2FA_REQUIRED", "");
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("an environment value wins both ways", async () => {
    vi.stubEnv("ADMIN_GATE_2FA_REQUIRED", "true");
    expect(await adminGateRequires2FA()).toBe(true);
    vi.stubEnv("ADMIN_GATE_2FA_REQUIRED", "off");
    expect(await adminGateRequires2FA()).toBe(false);
  });

  it("the store's own settings row is what he is relying on", async () => {
    maybeSingle.mockResolvedValue({ data: { value: false }, error: null });
    expect(await adminGateRequires2FA()).toBe(false);
    maybeSingle.mockResolvedValue({ data: { value: true }, error: null });
    expect(await adminGateRequires2FA()).toBe(true);
  });

  it("no row, no reader, or a refusal all mean the code is still required", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await adminGateRequires2FA()).toBe(true);
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await adminGateRequires2FA()).toBe(true);
    maybeSingle.mockRejectedValue(new Error("closed"));
    expect(await adminGateRequires2FA()).toBe(true);
  });
});

describe("the door and the screen follow that answer, not their own guess", () => {
  it("the door leaves the session standing only when the store says no code", () => {
    expect(gate).toContain("adminGateRequires2FA()");
    expect(gate).toContain("return NextResponse.json({ success: true, signedIn: true });");
    expect(gate).toContain("return NextResponse.json({ success: true, signedIn: false });");
    // The refusal branch still signs out — a password alone must not survive a required code.
    expect(gate.indexOf("signedIn: true")).toBeLessThan(gate.indexOf("await supabase.auth.signOut();", gate.indexOf("signedIn: true")));
  });

  it("every password-only entry is recorded and announced, never quiet", () => {
    expect(gate).toContain("is_2fa_verified: false");
    expect(gate).toContain("sendSecurityAlert(");
    expect(gate).toContain("كود التحقق مقفول بأمره");
  });

  it("the screen goes in when the door says so, and asks for the code when it does not", () => {
    expect(page).toContain("if (data.signedIn === true)");
    expect(page).toContain('router.push("/admin")');
    expect(page).toContain('setStep("2fa")');
  });

  it("the second step is retired, not deleted — one row brings it back", () => {
    expect(existsSync("app/api/admin/verify-2fa/route.ts")).toBe(true);
    expect(existsSync("app/api/admin/2fa/setup/route.ts")).toBe(true);
    expect(readFileSync("lib/admin-gate.ts", "utf8")).toContain("ADMIN_GATE_2FA_SECRET");
  });
});
