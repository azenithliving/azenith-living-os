// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { AUTOMATION_WRITE_COLUMNS } from "@/lib/ops/automation-shape";

/**
 * One row shape for the automation rules desk.
 *
 * Measured on the live record 2026-10-24 (scratch/measure-automation-shape.out): the desk sent
 * eight names and the record answers to six of them — `is_active`, `created_by` and `updated_by`
 * have never existed in `automation_rules`. The record refused the payload with PGRST204, the desk
 * stripped one name and tried again, so every save paid refused round trips before it landed, and
 * `is_active` was a second name for the fact `enabled` already owns.
 */

const doorPath = "app/api/admin/automation/route.ts";
const codeOf = (path: string) => readFileSync(path, "utf8");

function fakeService(reply: { data: unknown; error: unknown }) {
  const attempts: Array<{ method: string; payload: unknown }> = [];
  const tail: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "select") return () => ({ single: () => Promise.resolve(reply) });
        return () => tail;
      },
    },
  );
  const client: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "insert" || prop === "update") {
          return (payload: unknown) => {
            attempts.push({ method: prop, payload });
            return tail;
          };
        }
        return () => client;
      },
    },
  );
  return { client, attempts };
}

async function loadDoor(client: unknown) {
  vi.resetModules();
  vi.doMock("@/lib/supabase-service", () => ({ supabaseService: client }));
  vi.doMock("@/lib/company-resolver", () => ({
    resolvePrimaryCompanyId: async () => "00000000-0000-4000-8000-000000000000",
  }));
  return await import("@/app/api/admin/automation/route");
}

const storedRule = {
  id: "9c1f1e00-0000-4000-8000-000000000000",
  name: "سبب القياس",
  trigger: "manual",
  conditions: {},
  actions: {},
  enabled: true,
};

function request(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-admin-user-id": "admin-test" },
    body: JSON.stringify(body),
  }) as never;
}

describe("the rules desk writes one shape", () => {
  it("sends exactly the columns the record answers to, in one trip", async () => {
    const { client, attempts } = fakeService({ data: storedRule, error: null });
    const { POST } = await loadDoor(client);

    const json = await (
      await POST(request("http://localhost/api/admin/automation", "POST", { name: "سبب القياس", trigger: "manual" }))
    ).json();

    expect(attempts).toHaveLength(1);
    expect(Object.keys(attempts[0].payload as Record<string, unknown>).sort()).toEqual(
      [...AUTOMATION_WRITE_COLUMNS].sort(),
    );
    expect(json.success).toBe(true);
  });

  it("carries the flag in the one column that owns it", async () => {
    const { client, attempts } = fakeService({ data: storedRule, error: null });
    const { POST } = await loadDoor(client);

    await POST(
      request("http://localhost/api/admin/automation", "POST", {
        name: "سبب القياس",
        trigger: "manual",
        enabled: false,
      }),
    );

    const payload = attempts[0].payload as Record<string, unknown>;
    expect(payload.enabled).toBe(false);
    expect(payload).not.toHaveProperty("is_active");
    expect(payload).not.toHaveProperty("created_by");
  });

  it("reads the flag back from that same column", async () => {
    const { client } = fakeService({ data: { ...storedRule, enabled: false }, error: null });
    const { POST } = await loadDoor(client);

    const json = await (
      await POST(request("http://localhost/api/admin/automation", "POST", { name: "سبب القياس", trigger: "manual" }))
    ).json();

    expect(json.rule.enabled).toBe(false);
  });

  it("hands the record's refusal back once, without trying again with fewer names", async () => {
    const { client, attempts } = fakeService({
      data: null,
      error: { code: "PGRST204", message: "Could not find the 'is_active' column" },
    });
    const { POST } = await loadDoor(client);

    const response = await POST(
      request("http://localhost/api/admin/automation", "POST", { name: "سبب القياس", trigger: "manual" }),
    );

    expect(response.status).toBe(500);
    expect(attempts).toHaveLength(1);
  });

  it("updates with declared names only, in one trip", async () => {
    const { client, attempts } = fakeService({ data: { ...storedRule, enabled: false }, error: null });
    const { PUT } = await loadDoor(client);

    const json = await (
      await PUT(
        request(`http://localhost/api/admin/automation?id=${storedRule.id}`, "PUT", { enabled: false }),
      )
    ).json();

    expect(attempts).toHaveLength(1);
    const payload = attempts[0].payload as Record<string, unknown>;
    expect(payload).toEqual({ enabled: false });
    expect(json.rule.enabled).toBe(false);
  });

  it("names the phantom columns nowhere in the desk", () => {
    const door = codeOf(doorPath);

    for (const phantom of ["is_active", "created_by", "updated_by"]) {
      expect(door, phantom).not.toContain(phantom);
    }
    expect(door).not.toMatch(/42703|PGRST204/);
    expect(door).toContain("AUTOMATION_WRITE_COLUMNS");
  });

  it("the relations door asks the rules table about the desk's own column list", () => {
    const health = codeOf("app/api/admin/intel/relations/health/route.ts");

    expect(health).toContain("AUTOMATION_WRITE_COLUMNS");
  });
});
