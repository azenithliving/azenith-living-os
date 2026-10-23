// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * One writer for the employees' memory table.
 *
 * Measured on the live record 2026-10-24: `agent_memory` answers to 13 columns —
 * id, user_id, memory_type, content, created_at, type, category, context, priority, outcome,
 * user_feedback, expires_at, updated_at. It has no company, actor or source column, and its
 * `memory_type` is required with no default. Six desks were writing to it anyway: four sent
 * invented columns, all six skipped the required one, and five of them threw the refusal away.
 * Every one of the 8 stored rows carries the record's own default category, so no row in that
 * table was ever written by any desk.
 *
 * The owner's own shelf is the sharpest case: `rememberOwnerPreference` reported success on a
 * write the record refused, and `listOwnerPreferences` filtered on `actor_user_id`, so the
 * assistant answered «حفظت تفضيلك» to a preference that was never stored.
 */

import { MEMORY_WRITE_COLUMNS } from "@/lib/ops/memory-record";

function fakeClient(reply: { data: unknown; error: unknown }) {
  const calls: unknown[] = [];
  const self: any = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") return (resolve: (value: unknown) => void) => resolve(reply);
        if (prop === "insert") return (rows: unknown) => (calls.push(rows), self);
        return () => self;
      },
    },
  );
  return { client: self as any, calls };
}

async function loadWriter(client: any) {
  vi.resetModules();
  vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => client }));
  return await import("@/lib/ops/memory-record");
}

describe("the one memory writer", () => {
  it("stamps the kind into the column the record demands, and returns its id", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "8c1f" }], error: null });
    const writer = await loadWriter(client);
    const wrote = await writer.recordMemory({
      kind: "preference",
      category: "admin_owner_memory",
      content: "اللون=بيچ",
    });

    expect(wrote).toEqual({ ok: true, id: "8c1f" });
    expect(calls[0]).toMatchObject({
      memory_type: "preference",
      type: "preference",
      category: "admin_owner_memory",
      priority: "normal",
      user_id: null,
    });
  });

  it("sends no column the record does not answer to", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "1" }], error: null });
    const writer = await loadWriter(client);
    await writer.recordMemory({ kind: "report", category: "c", content: "x" });

    const sent = Object.keys(calls[0] as Record<string, unknown>).sort();
    expect(sent).toEqual([...MEMORY_WRITE_COLUMNS].sort());
  });

  it("refuses an entry with no kind, no shelf, or no content — before the record is touched", async () => {
    const { client, calls } = fakeClient({ data: [{ id: "1" }], error: null });
    const writer = await loadWriter(client);

    expect((await writer.recordMemory({ kind: "  ", category: "c", content: "x" })).ok).toBe(false);
    expect((await writer.recordMemory({ kind: "k", category: "  ", content: "x" })).ok).toBe(false);
    expect((await writer.recordMemory({ kind: "k", category: "c", content: "   " })).ok).toBe(false);
    expect(calls.length, "a refused row must never reach the record").toBe(0);
  });

  it("reports a record that refused the row, and one that answered with nothing", async () => {
    const refused = await loadWriter(fakeClient({ data: null, error: { code: "42703" } }).client);
    expect(await refused.recordMemory({ kind: "k", category: "c", content: "x" })).toEqual({
      ok: false,
      error: "الذاكرة رفضت السطر",
    });

    const silent = await loadWriter(fakeClient({ data: [], error: null }).client);
    const wrote = await silent.recordMemory({ kind: "k", category: "c", content: "x" });
    expect(wrote.ok).toBe(false);
    expect((wrote as { error: string }).error).toContain("ما اتسجّلش");
  });

  it("says so when the store's credential is missing, instead of pretending", async () => {
    const writer = await loadWriter(null);
    const wrote = await writer.recordMemory({ kind: "k", category: "c", content: "x" });
    expect(wrote.ok).toBe(false);
  });
});

/** The file's code, with its comments stripped — a header may name the dead thing it retired. */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function touchingMemoryTable(): string[] {
  const files: string[] = [];
  for (const dir of ["app", "lib", "services", "components"]) {
    const walk = (p: string) => {
      if (!existsSync(p)) return;
      for (const entry of readdirSync(p)) {
        const full = join(p, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(full) && /from\(\s*["'`]agent_memory["'`]/.test(codeOf(full))) {
          files.push(full.replace(/\\/g, "/"));
        }
      }
    };
    walk(dir);
  }
  return files.sort();
}

/**
 * The text of each statement that names the memory table — up to the next query in the same file,
 * so a guard on memory does not indict whatever the same desk writes elsewhere.
 */
function memoryChains(code: string): string[] {
  const chains: string[] = [];
  const marker = /from\(\s*["'`]agent_memory["'`]/g;
  for (const match of code.matchAll(marker)) {
    const rest = code.slice((match.index ?? 0) + match[0].length);
    const next = rest.search(/from\(\s*["'`]/);
    chains.push(next === -1 ? rest.slice(0, 600) : rest.slice(0, next));
  }
  return chains;
}

describe("no desk writes into memory on its own", () => {
  it("only the one writer builds an insert against the table", () => {
    const inserts: string[] = [];
    for (const file of touchingMemoryTable()) {
      for (const chain of memoryChains(codeOf(file))) {
        if (/\.insert\(/.test(chain)) inserts.push(file);
      }
    }
    expect(inserts).toEqual(["lib/ops/memory-record.ts"]);
  });

  it("no read or write names a column the record does not have", () => {
    for (const file of touchingMemoryTable()) {
      for (const chain of memoryChains(codeOf(file))) {
        expect(chain, file).not.toMatch(/actor_user_id|source_table|source_id|company_id/);
      }
    }
  });

  it("nothing drops columns and retries", () => {
    expect(codeOf("lib/ultimate-agent/memory-store.ts")).not.toMatch(/42703/);
    expect(codeOf("lib/ops/memory-record.ts")).not.toMatch(/42703/);
  });

  it("the writer's list is exactly what the live record answers to", () => {
    // Measured 2026-10-24 from information_schema on the store's own database.
    const live = [
      "category",
      "content",
      "context",
      "expires_at",
      "memory_type",
      "outcome",
      "priority",
      "type",
      "user_feedback",
      "user_id",
    ];
    expect([...MEMORY_WRITE_COLUMNS].sort()).toEqual(live);
  });

  it("every desk that remembers goes through the door", () => {
    const desks = [
      "lib/admin-owner-memory.ts",
      "lib/admin-cloud-evolution.ts",
      "lib/admin-daily-report.ts",
      "lib/admin-learned-patterns.ts",
      "lib/admin-project-evolver.ts",
      "lib/ultimate-agent/memory-store.ts",
    ];
    for (const file of desks) {
      expect(codeOf(file), file).toContain("recordMemory");
    }
  });

  it("the owner's shelf reads by the shelf, and the assistant admits a refusal", () => {
    const shelf = codeOf("lib/admin-owner-memory.ts");
    expect(shelf).toMatch(/\.eq\("category", CATEGORY\)/);
    expect(shelf).toMatch(/success: false, error: written\.error/);

    const brain = codeOf("lib/admin-natural-brain.ts");
    expect(brain).toMatch(/if \(!saved\.success\)/);
    expect(brain).not.toMatch(/await rememberOwnerPreference\([^)]*\);\s*\n\s*const memHint/);
  });

  it("the health door asks the memory table about the columns the writer uses", () => {
    const door = codeOf("app/api/admin/intel/relations/health/route.ts");
    expect(door).toContain("MEMORY_WRITE_COLUMNS");
    expect(door).not.toMatch(/migration 030|030_intel_relations/);
  });
});
