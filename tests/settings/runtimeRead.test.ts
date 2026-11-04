// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The site shell's settings read, measured against the record's real shape.
 *
 * Measured 2026-11-04 (scratch/measure-settings-scope-refusal.out): `site_settings` answers to four
 * columns and has no `company_id`, so the read the layout tried first came back 400 / 42703 on every
 * page load, and the code fell through to the same unfiltered rows — three queries where one does the
 * job, one of them refused, and a tenant filter that never filtered.
 */

type Call = { table: string; select: string | null; filters: string[] };

function stubClient(
  rowsByTable: Record<string, unknown[]>,
  refusal: { code: string; message: string } | null = null
) {
  const calls: Call[] = [];

  const client = {
    from: (table: string) => {
      const call: Call = { table, select: null, filters: [] };
      calls.push(call);
      const chain = {
        select: (columns: string) => {
          call.select = columns;
          return chain;
        },
        in: (column: string, values: unknown[]) => {
          call.filters.push(`${column} in ${values.join("/")}`);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          call.filters.push(`${column} eq ${String(value)}`);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        then: (resolve: (value: unknown) => void) => {
          resolve(
            refusal
              ? { data: null, error: refusal }
              : { data: rowsByTable[table] ?? [], error: null }
          );
        },
      };
      return chain;
    },
  };
  return { client, calls };
}

async function load(stub: { client: unknown } | null) {
  vi.resetModules();
  vi.doMock("@/lib/supabase-admin", () => ({
    getSupabaseAdminClient: () => (stub ? stub.client : null),
  }));
  return await import("@/lib/settings/runtime-read");
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("the read the record can answer", () => {
  it("asks the settings table once and nothing else", async () => {
    const stub = stubClient({
      site_settings: [
        { key: "theme", value: { primaryColor: "#101418" } },
        { key: "seo", value: { adsEnabled: false } },
      ],
    });
    const mod = await load(stub);

    const settings = await mod.loadPublicRuntimeSettings();

    expect(stub.calls.map((c) => c.table)).toEqual(["site_settings"]);
    expect(stub.calls[0].select).toBe("key,value");
    expect(settings.theme).toEqual({ primaryColor: "#101418" });
    expect(settings.seo).toEqual({ adsEnabled: false });
  });

  it("never filters the settings table by a company it does not have", async () => {
    const stub = stubClient({ site_settings: [] });
    const mod = await load(stub);

    await mod.loadPublicRuntimeSettings();

    const filters = stub.calls.flatMap((c) => c.filters);
    expect(filters.join(" |")).not.toContain("company_id");
    expect(filters).toEqual(["key in theme/seo"]);
  });

  it("a refusal is said and returned as nothing — no second read behind it", async () => {
    const stub = stubClient({}, { code: "42703", message: "column site_settings.company_id does not exist" });
    const mod = await load(stub);

    const settings = await mod.loadPublicRuntimeSettings();

    expect(settings).toEqual({});
    expect(stub.calls).toHaveLength(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("refused"),
      "42703",
      expect.stringContaining("company_id")
    );
  });

  it("no client means no settings, and no query attempted", async () => {
    const mod = await load(null);

    expect(await mod.loadPublicRuntimeSettings()).toEqual({});
  });

  it("a row whose value is not an object is dropped, not rendered", async () => {
    const stub = stubClient({
      site_settings: [
        { key: "theme", value: null },
        { key: "seo", value: "نص مش كائن" },
        { key: "theme", value: { primaryColor: "#C5A059" } },
      ],
    });
    const mod = await load(stub);

    const settings = await mod.loadPublicRuntimeSettings();

    expect(settings.theme).toEqual({ primaryColor: "#C5A059" });
    expect(settings.seo).toBeUndefined();
  });
});

describe("the layout asks this read and nothing older", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");

  it("the shell imports the one read", () => {
    expect(layout).toContain('from "@/lib/settings/runtime-read"');
    expect(layout).not.toContain("company_id");
  });

  it("the shell no longer keeps its own copy of the query", () => {
    expect(layout).not.toContain('from("site_settings")');
    expect(layout).not.toContain("getSupabaseAdminClient");
  });
});
