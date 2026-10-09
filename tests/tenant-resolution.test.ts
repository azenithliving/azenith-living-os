import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which company a request belongs to — the decision every read on the store makes.
 *   npx vitest run tests/tenant-resolution.test.ts
 *
 * Measured 2026-10-09 on the published site: the only company is filed under `azenithliving.com`,
 * but the site is served on the deployment alias, so the host lookup found nothing and returned a
 * placeholder company that owns no rows. The owner's numbers door said `0 customers` while the
 * roll held 30 — and the taste tally could not be proven at all.
 */
const world = vi.hoisted(() => {
  const state = { companies: [] as Record<string, unknown>[] };
  const client = () => ({
    from(table: string) {
      let eqColumn: string | null = null;
      let eqValue: unknown = null;
      let limitN = 0;
      const self: any = {
        select: () => self,
        order: () => self,
        eq: (column: string, value: unknown) => {
          eqColumn = column;
          eqValue = value;
          return self;
        },
        limit: (n: number) => {
          limitN = n;
          return self;
        },
        maybeSingle: async () => {
          if (table !== "companies") return { data: null, error: null };
          const hit = state.companies.find((c) => String(c[eqColumn as string]) === String(eqValue));
          return { data: hit ?? null, error: null };
        },
        then: (resolve: any) =>
          Promise.resolve({
            data: table === "companies" ? state.companies.slice(0, limitN || state.companies.length) : null,
            error: null,
          }).then(resolve),
      };
      return self;
    },
  });
  return { state, client };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => world.client() as never }));

const COMPANY = { id: "company-real", name: "أزينث", domain: "azenithliving.com", logo: null, primary_color: "#C5A059", whatsapp: null };
const SECOND = { ...COMPANY, id: "company-two", domain: "second-store.com" };

beforeEach(() => {
  world.state.companies = [];
});

describe("a request finds its company", () => {
  it("answers by the address written on the company", async () => {
    world.state.companies = [COMPANY];
    const { getTenantByHost } = await import("@/lib/tenant");
    expect((await getTenantByHost("azenithliving.com"))?.id).toBe("company-real");
  });

  it("a one-company store answers for its own deployment alias too", async () => {
    world.state.companies = [COMPANY];
    const { getTenantByHost } = await import("@/lib/tenant");
    // This is the live case: the alias is not in the `domain` column, and the rows are real.
    expect((await getTenantByHost("azenith-living.vercel.app"))?.id).toBe("company-real");
  });

  it("stops guessing the moment a second company exists", async () => {
    world.state.companies = [COMPANY, SECOND];
    const { getTenantByHost } = await import("@/lib/tenant");
    const tenant = await getTenantByHost("some-unknown-host.example");
    expect(tenant?.id).not.toBe("company-real");
    expect(tenant?.id).not.toBe("company-two");
  });

  it("an empty store keeps the placeholder, and a hostless call still finds the one company", async () => {
    const { getTenantByHost } = await import("@/lib/tenant");
    expect((await getTenantByHost(null))?.id).toBe("00000000-0000-0000-0000-000000000001");
    world.state.companies = [COMPANY];
    expect((await getTenantByHost(null))?.id).toBe("company-real");
  });
});
