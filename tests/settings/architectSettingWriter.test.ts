// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({
  existing: { value: { siteTitle: "قديم", adsenseEnabled: false } } as { value: Record<string, unknown> } | null,
  readError: null as { code: string; message: string } | null,
  upserts: [] as { payload: Record<string, unknown>; onConflict?: string }[],
  upsertResult: { data: { key: "seo", value: { siteTitle: "قديم", adsenseEnabled: true } }, error: null } as any,
  historyResult: { ok: true, id: "audit-arch" } as any,
  legacyTouched: false,
  companyResolved: false,
}));

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "site_settings") throw new Error(`unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: world.existing, error: world.readError }) }),
        }),
        upsert: (payload: Record<string, unknown>, options?: { onConflict?: string }) => {
          world.upserts.push({ payload, onConflict: options?.onConflict });
          return { select: () => ({ single: async () => world.upsertResult }) };
        },
      };
    },
  }),
}));

vi.mock("@/lib/ops/audit-record", () => ({
  recordAuditEvent: async () => world.historyResult,
}));

vi.mock("@/lib/supabase-service", () => ({
  supabaseService: new Proxy({}, {
    get() {
      world.legacyTouched = true;
      throw new Error("the architect setting writer must use the shared desk");
    },
  }),
}));

vi.mock("@/lib/company-resolver", () => ({
  resolvePrimaryCompanyId: async () => {
    world.companyResolved = true;
    return "company-1";
  },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseServerClient: () => {
    throw new Error("not used by the setting writer");
  },
}));

const { updateSiteSetting } = await import("@/lib/architect-tools");

beforeEach(() => {
  world.existing = { value: { siteTitle: "قديم", adsenseEnabled: false } };
  world.readError = null;
  world.upserts.length = 0;
  world.upsertResult = { data: { key: "seo", value: { siteTitle: "قديم", adsenseEnabled: true } }, error: null };
  world.historyResult = { ok: true, id: "audit-arch" };
  world.legacyTouched = false;
  world.companyResolved = false;
});

describe("the architect setting writer", () => {
  it("merges through the shared desk without asking for a company column", async () => {
    const out = await updateSiteSetting({ key: "seo", value: { adsenseEnabled: true } });

    expect(out.success).toBe(true);
    expect(world.legacyTouched).toBe(false);
    expect(world.companyResolved).toBe(false);
    expect(world.upserts).toHaveLength(1);
    expect(world.upserts[0].onConflict).toBe("key");
    expect(world.upserts[0].payload).not.toHaveProperty("company_id");
    expect(world.upserts[0].payload.value).toEqual({ siteTitle: "قديم", adsenseEnabled: true });
    expect(out.data).toEqual({ key: "seo", value: { siteTitle: "قديم", adsenseEnabled: true } });
  });

  it("refuses instead of overwriting when the current value cannot be read", async () => {
    world.readError = { code: "42501", message: "permission denied" };

    const out = await updateSiteSetting({ key: "seo", value: { adsenseEnabled: true } });

    expect(out.success).toBe(false);
    expect(world.upserts).toEqual([]);
    expect(String(out.message)).toContain("ما اتعملش");
  });

  it("does not report a simulated save when the record refuses the write", async () => {
    world.upsertResult = { data: null, error: { code: "42P01", message: "relation does not exist" } };

    const out = await updateSiteSetting({ key: "seo", value: { adsenseEnabled: true } });

    expect(out.success).toBe(false);
    expect(String(out.message)).toContain("المخزن رفض الكتابة");
    expect(String(out.message)).not.toContain("محاكاة");
    expect(out.data).toBeUndefined();
  });
});