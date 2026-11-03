// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The store's table census, read the way the record can answer.
 *
 * Measured 2026-11-03: the discovery engine asked PostgREST for `information_schema.tables` and
 * `information_schema.columns`. The record answers those with PGRST205 («no such table» — it does
 * not serve a system view), so the engine logged the refusal to the console and returned an empty
 * list, and the agents that build their picture of the store from it were told there are no tables.
 * The same record hands its whole inventory to one read of its root document: 160 relations with
 * their columns, matching the direct-SQL census column for column.
 */

const engine = await import("@/lib/discovery-engine");
const inventoryModule = await import("@/lib/ops/record-inventory");

const swagger = {
  definitions: {
    audit_log: {
      properties: { id: { type: "string" }, event_type: { type: "string" }, details: { type: "object" } },
      required: ["id", "event_type"],
    },
    automation_rules: {
      properties: { id: { type: "string" }, enabled: { type: "boolean" } },
      required: ["id", "enabled"],
    },
    _p6_backup_products: { properties: { id: { type: "string" } }, required: ["id"] },
  },
};

function stubFetch(reply: { ok: boolean; status?: number; json?: unknown; throws?: boolean }) {
  const calls: Array<{ url: string; accept: string | null }> = [];
  const fetchMock = vi.fn(async (input: unknown, init?: { headers?: Record<string, string> }) => {
    const headers = init?.headers ?? {};
    calls.push({ url: String(input), accept: headers.Accept ?? null });
    if (reply.throws) throw new Error("network down");
    return {
      ok: reply.ok,
      status: reply.status ?? (reply.ok ? 200 : 500),
      json: async () => reply.json,
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the record inventory read", () => {
  it("asks the root document once, for the record's own credential", async () => {
    const { calls } = stubFetch({ ok: true, json: swagger });

    const inventory = await inventoryModule.fetchRecordInventory();

    expect(inventory.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/rest/v1/");
    expect(calls[0].accept).toBe("application/json");
  });

  it("turns the document into tables, columns and which of them must be there", async () => {
    stubFetch({ ok: true, json: swagger });

    const inventory = await inventoryModule.fetchRecordInventory();
    if (!inventory.ok) throw new Error(inventory.error);

    const audit = inventory.tables.find((t) => t.name === "audit_log");
    expect(audit?.columns.map((c) => c.name)).toEqual(["id", "event_type", "details"]);
    expect(audit?.columns.find((c) => c.name === "id")?.required).toBe(true);
    expect(audit?.columns.find((c) => c.name === "details")?.required).toBe(false);
    expect(audit?.columns.find((c) => c.name === "details")?.type).toBe("object");
  });

  it("admits a refusal instead of handing back an empty store", async () => {
    stubFetch({ ok: false, status: 500 });

    const inventory = await inventoryModule.fetchRecordInventory();

    expect(inventory.ok).toBe(false);
    if (!inventory.ok) expect(inventory.error).toContain("500");
  });

  it("admits a network that does not answer", async () => {
    stubFetch({ ok: false, throws: true });

    const inventory = await inventoryModule.fetchRecordInventory();

    expect(inventory.ok).toBe(false);
    if (!inventory.ok) expect(inventory.error).toContain("ما ردّش");
  });

  it("admits a reply that carries no table list", async () => {
    stubFetch({ ok: true, json: { swagger: "2.0" } });

    const inventory = await inventoryModule.fetchRecordInventory();

    expect(inventory.ok).toBe(false);
    if (!inventory.ok) expect(inventory.error).toContain("من غير قائمة جداول");
  });

  it("says so when the store's own credential is missing", async () => {
    const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const inventory = await inventoryModule.fetchRecordInventory();
      expect(inventory.ok).toBe(false);
      if (!inventory.ok) expect(inventory.error).toContain("مش متصل");
    } finally {
      process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
    }
  });
});

function emptyRecordClient() {
  const chain: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (value: unknown) => void) => resolve({ data: [], error: null, count: 0 });
        return () => chain;
      },
    },
  );
  return { from: () => chain };
}

async function loadEngine() {
  vi.resetModules();
  vi.doMock("@/utils/supabase/server", () => ({ createClient: async () => emptyRecordClient() }));
  return await import("@/lib/discovery-engine");
}

describe("the census the agents read", () => {
  it("lists the record's tables, and says plainly that it did not count their rows", async () => {
    stubFetch({ ok: true, json: swagger });

    const census = await engine.discoverDatabaseSchema();

    expect(census.failed).toBe(false);
    expect(census.tables.map((t) => t.name)).toEqual(["audit_log", "automation_rules"]);
    expect(census.tables[0].rowCount).toBeNull();
    expect(census.tables[0].description).toContain("أعمدة");
  });

  it("keeps the backup relations out of the inventory the way the old census did", async () => {
    stubFetch({ ok: true, json: swagger });

    const census = await engine.discoverDatabaseSchema();

    expect(census.tables.some((t) => t.name.startsWith("_"))).toBe(false);
  });

  it("carries the failure up instead of returning a silent empty list", async () => {
    stubFetch({ ok: false, status: 404 });

    const census = await engine.discoverDatabaseSchema();

    expect(census.failed).toBe(true);
    expect(census.tables).toEqual([]);
    expect(census.error).toContain("404");
  });

  it("the snapshot admits it could not count the tables", async () => {
    stubFetch({ ok: false, status: 503 });
    const freshEngine = await loadEngine();

    const snapshot = await freshEngine.generateSystemSnapshot();

    expect(snapshot.summary).toContain("عدد الجداول مش معروف");
    expect(snapshot.summary).not.toMatch(/قاعدة البيانات فيها 0 جدول/);
  });

  it("counts the tables in his digits when the census does answer", async () => {
    stubFetch({ ok: true, json: swagger });
    const freshEngine = await loadEngine();

    const snapshot = await freshEngine.generateSystemSnapshot();

    expect(snapshot.summary).toContain("قاعدة البيانات فيها ٢ جدول");
  });

  it("describes a table without inventing a row count", async () => {
    stubFetch({ ok: true, json: swagger });
    const census = await engine.discoverDatabaseSchema();

    const line = engine.describeResource("table", census.tables[0]);

    expect(line).toContain("عدد الصفوف مش متقيس");
    expect(line).not.toMatch(/يحتوي على 0/);
  });
});

describe("the two reads the blind gate used to swallow", () => {
  // The shapes below are the live record's, measured 2026-11-03 by scratch/measure-discovery-blind.mjs:
  // site_settings has 4 columns and 20 rows, automation_rules has 9 columns and no is_active.
  const measuredSwagger = {
    definitions: {
      site_settings: {
        properties: {
          key: { type: "string" },
          value: { type: "object" },
          updated_at: { type: "string" },
          updated_by: { type: "null" },
        },
        required: ["key", "value"],
      },
      automation_rules: {
        properties: {
          id: { type: "string" },
          company_id: { type: "string" },
          name: { type: "string" },
          trigger: { type: "string" },
          conditions: { type: "object" },
          actions: { type: "array" },
          enabled: { type: "boolean" },
          created_at: { type: "string" },
          updated_at: { type: "string" },
        },
        required: ["id", "name", "enabled"],
      },
    },
  };

  function stubRecordClient(rowsByTable: Record<string, unknown[]>) {
    const asks: Array<{ table: string; select: string }> = [];
    const client = {
      from: (table: string) => {
        let projection = "";
        const chain = {
          select: (columns: string) => {
            projection = columns;
            return chain;
          },
          then: (resolve: (value: unknown) => void) => {
            asks.push({ table, select: projection });
            resolve({ data: rowsByTable[table] ?? [], error: null });
          },
        };
        return chain;
      },
    };
    return { client, asks };
  }

  async function loadEngineWith(getClient: () => unknown) {
    vi.resetModules();
    vi.doMock("@/utils/supabase/server", () => ({ createClient: async () => getClient() }));
    return await import("@/lib/discovery-engine");
  }

  it("brings the settings rows the blind existence check used to throw away", async () => {
    stubFetch({ ok: true, json: measuredSwagger });
    const { client, asks } = stubRecordClient({
      site_settings: [
        { key: "store_hours", value: { from: "9", to: "20" } },
        { key: "whatsapp", value: "01000000000" },
      ],
    });
    const freshEngine = await loadEngineWith(() => client);

    const settings = await freshEngine.discoverSiteSettings();

    expect(settings).toHaveLength(2);
    expect(settings[0].key).toBe("store_hours");
    expect(settings[0].description).toContain("إعداد");
    expect(asks).toEqual([{ table: "site_settings", select: "key,value" }]);
  });

  it("asks the rules for only the columns the record has, and reads the flag from its one owner", async () => {
    stubFetch({ ok: true, json: measuredSwagger });
    const { client, asks } = stubRecordClient({
      automation_rules: [
        {
          id: "r1",
          name: "قاعدة التنبيه اليومي",
          trigger: "cron",
          conditions: { after: "22:00" },
          actions: [{ type: "alert" }],
          enabled: true,
        },
      ],
    });
    const freshEngine = await loadEngineWith(() => client);

    const rules = await freshEngine.discoverAutomationRules();

    expect(rules).toHaveLength(1);
    expect(rules[0].isActive).toBe(true);
    expect(rules[0].lastExecuted).toBeNull();
    const select = asks[0].select;
    expect(select).not.toContain("is_active");
    expect(select).not.toContain("last_executed");
    expect(select.split(",")).toEqual(["id", "name", "trigger", "conditions", "actions", "enabled"]);
  });

  it("does not read a table the record's inventory does not list", async () => {
    stubFetch({ ok: true, json: swagger });
    const { client, asks } = stubRecordClient({ site_settings: [{ key: "ghost", value: 1 }] });
    const freshEngine = await loadEngineWith(() => client);

    const settings = await freshEngine.discoverSiteSettings();

    expect(settings).toEqual([]);
    expect(asks).toEqual([]);
  });

  it("when the record refuses the inventory, both reads come back empty without touching a table", async () => {
    stubFetch({ ok: false, status: 500 });
    const { client, asks } = stubRecordClient({});
    const freshEngine = await loadEngineWith(() => client);

    expect(await freshEngine.discoverSiteSettings()).toEqual([]);
    expect(await freshEngine.discoverAutomationRules()).toEqual([]);
    expect(asks).toEqual([]);
  });

  it("a setting that carries a credential reaches the picture masked, never as its value", async () => {
    stubFetch({ ok: true, json: measuredSwagger });
    const { client } = stubRecordClient({
      site_settings: [{ key: "telegram_config", value: { botToken: "123456:REAL-TOKEN-SECRET" } }],
    });
    const freshEngine = await loadEngineWith(() => client);

    const settings = await freshEngine.discoverSiteSettings();

    expect(settings).toHaveLength(1);
    const serialized = JSON.stringify(settings);
    expect(serialized).not.toContain("REAL-TOKEN-SECRET");
    expect(settings[0].description).toContain("ما يتطبعش");
    expect(serialized).toContain("مخفي");
  });

  it("the snapshot asks for the record inventory once, not three times", async () => {
    const { fetchMock } = stubFetch({ ok: true, json: measuredSwagger });
    const { client, asks } = stubRecordClient({
      site_settings: [{ key: "store_hours", value: "9 - 20" }],
      automation_rules: [{ id: "r1", name: "rule", trigger: "cron", enabled: false }],
    });
    const freshEngine = await loadEngineWith(() => client);

    const snapshot = await freshEngine.generateSystemSnapshot();

    expect(fetchMock.mock.calls.length).toBe(1);
    expect(snapshot.settings).toHaveLength(1);
    expect(snapshot.automationRules).toHaveLength(1);
    expect(asks.map((ask) => ask.table)).toEqual(["site_settings", "automation_rules"]);
  });
});

describe("nothing asks the record for a system view any more", () => {
  const files = [
    "lib/discovery-engine.ts",
    "lib/ops/record-inventory.ts",
    "app/api/admin/intel/relations/health/route.ts",
  ];

  it.each(files)("%s never asks the record for a system view", (file) => {
    // Comments may explain the old blindness; code may not repeat it.
    const code = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toContain("information_schema");
  });

  it("the emptiness alarm skips tables the census never counted", () => {
    const agent = readFileSync("lib/proactive-agent.ts", "utf8");

    expect(agent.match(/if \(table\.rowCount === null\) continue;/g)?.length).toBe(2);
    expect(agent).not.toMatch(/\(table\.rowCount \|\| 0\) === 0/);
  });
});
