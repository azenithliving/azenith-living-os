// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The cache tier obeys one measured verdict about its own storage.
 *
 * Measured 2026-11-04 against the live record: `semantic_cache` is not in the record (PGRST205),
 * `record_cache_hit` is not in the record either, and none of the four Upstash credentials is set.
 * Six files still read or write that table on real paths, so every call paid a refused round trip,
 * swallowed the refusal, and left the counters printing zero — the number an empty cache would
 * print, for a cache that has nowhere to be empty in.
 */

type Query = { table: string; methods: string[] };

function fakeClient(queries: Query[], mode: "absent" | "present") {
  const chain = (table: string) => {
    const methods: string[] = [];
    const finish = () => {
      queries.push({ table, methods: [...methods] });
      return mode === "absent"
        ? Promise.resolve({ data: null, count: 0, error: { code: "PGRST205", message: "Could not find the table 'public.semantic_cache' in the schema cache" } })
        : Promise.resolve({ data: [], count: 0, error: null });
    };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "insert", "upsert", "delete", "eq", "or", "in", "neq", "limit", "order"]) {
      builder[method] = () => {
        methods.push(method);
        return builder;
      };
    }
    builder.then = (resolve: (value: unknown) => void) => resolve(finish());
    builder.single = () => finish();
    builder.maybeSingle = () => finish();
    return builder;
  };

  return {
    from: (table: string) => chain(table),
    rpc: (name: string) => {
      queries.push({ table: name, methods: ["rpc"] });
      return Promise.resolve({ data: null, error: null });
    },
  };
}

const savedEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  delete process.env.UPSTASH_REDIS_L1_URL;
  delete process.env.UPSTASH_REDIS_L1_TOKEN;
  delete process.env.UPSTASH_REDIS_L2_URL;
  delete process.env.UPSTASH_REDIS_L2_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...savedEnv };
});

async function loadVerdict(queries: Query[], mode: "absent" | "present") {
  vi.doMock("@/lib/supabase-admin", () => ({
    getSupabaseAdminClient: () => fakeClient(queries, mode),
  }));
  const mod = await import("@/lib/ops/cache-storage");
  mod.resetCacheStorageProbe();
  return mod;
}

describe("the verdict the whole tier obeys", () => {
  it("asks the record once, and the second caller gets the same measured answer", async () => {
    const queries: Query[] = [];
    const mod = await loadVerdict(queries, "absent");

    const first = await mod.cacheStorageVerdict();
    const second = await mod.cacheStorageVerdict();

    expect(first.table).toBe("absent");
    expect(second.table).toBe("absent");
    expect(queries).toHaveLength(1);
  });

  it("says the reason in words, and counts the Redis layers it did not find", async () => {
    const queries: Query[] = [];
    const mod = await loadVerdict(queries, "absent");

    const verdict = await mod.cacheStorageVerdict();

    expect(verdict.redisLayers).toBe(0);
    expect(verdict.reason).toMatch(/السجل/);
    expect(await mod.cacheTierIsUsable()).toBe(false);
  });

  it("counts a configured Redis pair when the deployment has one", async () => {
    const queries: Query[] = [];
    const mod = await loadVerdict(queries, "absent");
    process.env.UPSTASH_REDIS_L1_URL = "https://example.invalid";
    process.env.UPSTASH_REDIS_L1_TOKEN = "token";
    mod.resetCacheStorageProbe();

    const verdict = await mod.cacheStorageVerdict();

    expect(verdict.redisLayers).toBe(1);
    expect(await mod.cacheTierIsUsable()).toBe(true);
  });

  it("does not call the tier usable when the record answers something else", async () => {
    const queries: Query[] = [];
    vi.resetModules();
    vi.doMock("@/lib/supabase-admin", () => ({
      getSupabaseAdminClient: () => null,
    }));
    const mod = await import("@/lib/ops/cache-storage");
    mod.resetCacheStorageProbe();

    const verdict = await mod.cacheStorageVerdict();

    expect(verdict.table).toBe("unknown");
    expect(verdict.reason).toContain("مش متصل");
    expect(queries).toHaveLength(0);
  });
});

async function loadCache(queries: Query[], mode: "absent" | "present") {
  vi.resetModules();
  const client = fakeClient(queries, mode);
  vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => client }));
  vi.doMock("@supabase/supabase-js", () => ({ createClient: () => client }));
  const verdict = await import("@/lib/ops/cache-storage");
  verdict.resetCacheStorageProbe();
  return await import("@/lib/semantic-cache");
}

describe("the tier itself, with nowhere to store", () => {
  // The probe reads with exactly select+limit; any other call is the tier itself paying a query.
  const tierCalls = (queries: Query[]) =>
    queries.filter((q) => q.table === "semantic_cache" && q.methods.join(".") !== "select.limit");

  it("a write pays no query and is counted as skipped, not as zero", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const queries: Query[] = [];
    const mod = await loadCache(queries, "absent");

    await mod.semanticCache.set("كم سعر الكنبة؟", "على قد الميزانية", { context: "consultant_faq" });
    const stats = mod.semanticCache.getStats();

    expect(tierCalls(queries)).toHaveLength(0);
    expect(stats.skippedWrites).toBe(1);
    expect(stats.stored).toBe(false);
    expect(stats.tableState).toBe("absent");
  });

  it("a read asks the record nothing and still answers honestly as a miss", async () => {
    const queries: Query[] = [];
    const mod = await loadCache(queries, "absent");

    const result = await mod.semanticCache.get({ query: "كم سعر الكنبة؟", context: "consultant_faq" });

    expect(result.hit).toBe(false);
    expect(result.source).toBe("miss");
    expect(tierCalls(queries)).toHaveLength(0);
  });

  it("when the record does have the table, the tier uses it", async () => {
    const queries: Query[] = [];
    const mod = await loadCache(queries, "present");

    await mod.semanticCache.set("كم سعر الكنبة؟", "على قد الميزانية");

    expect(tierCalls(queries).some((q) => q.methods.includes("upsert"))).toBe(true);
    expect(mod.semanticCache.getStats().stored).toBe(true);
  });
});

describe("every writer obeys the one verdict", () => {
  const files = [
    "lib/semantic-cache.ts",
    "lib/sovereign-os.ts",
    "lib/mastermind.ts",
    "lib/mastermind-core.ts",
  ];

  it.each(files)("%s asks the verdict before it touches the cache table", (file) => {
    const code = readFileSync(file, "utf8");
    expect(code).toContain("cacheStorageVerdict");
  });

  it("the status loop names a missing table instead of counting it as zero", () => {
    for (const file of ["lib/mastermind.ts", "lib/mastermind-core.ts"]) {
      const code = readFileSync(file, "utf8");
      expect(code, file).not.toMatch(/recordCounts\[table\] = count \|\| 0/);
      expect(code, file).toContain("missingTables");
    }
  });
});
