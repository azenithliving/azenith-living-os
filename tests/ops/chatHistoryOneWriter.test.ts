// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * One writer for the assistant's conversation turns.
 *
 * Measured on the live record 2026-10-24: `chat_history` answers to 6 columns and holds 0 rows.
 * Its only writer sent `session_id`, `command_executed` and `command_result` — none of which the
 * record has — so every turn was refused, and the refusal never even reached the log because
 * supabase-js returns an error instead of throwing, so the `try/catch` around it was dead code.
 * The assistant's own history read asked for `command_executed` too, so the screen was blind on
 * both ends and looked correctly empty.
 */

import { CHAT_WRITE_COLUMNS, type ChatWrite } from "@/lib/ops/chat-record";

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

async function loadDoor(client: any) {
  vi.resetModules();
  vi.doMock("@/lib/supabase-admin", () => ({ getSupabaseAdminClient: () => client }));
  return await import("@/lib/ops/chat-record");
}

describe("the one chat writer", () => {
  it("stores the turn in the columns the record answers to, and returns its id", async () => {
    const { client, calls } = fakeClient({ data: [{ id: 77 }], error: null });
    const door = await loadDoor(client);
    const wrote: ChatWrite = await door.recordChatTurn({
      userId: "03105dde-0000-4000-8000-000000000000",
      sessionId: "sess-1",
      role: "user",
      content: "كم ورقة مستنية؟",
      commandExecuted: "analytics",
    });

    expect(wrote).toEqual({ ok: true, id: 77 });
    expect(calls[0]).toMatchObject({
      user_id: "03105dde-0000-4000-8000-000000000000",
      role: "user",
      content: "كم ورقة مستنية؟",
    });
    expect(calls[0]).toMatchObject({
      metadata: { session_id: "sess-1", command_executed: "analytics", command_result: null },
    });
  });

  it("sends no column the record does not answer to", async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }], error: null });
    const door = await loadDoor(client);
    await door.recordChatTurn({ role: "assistant", content: "خمس أوراق" });

    expect(Object.keys(calls[0] as Record<string, unknown>).sort()).toEqual(
      [...CHAT_WRITE_COLUMNS].sort(),
    );
  });

  it("refuses an empty turn and a speaker outside the record's own list, before the record is touched", async () => {
    const { client, calls } = fakeClient({ data: [{ id: 1 }], error: null });
    const door = await loadDoor(client);

    expect((await door.recordChatTurn({ role: "user", content: "   " })).ok).toBe(false);
    expect((await door.recordChatTurn({ role: "bot" as never, content: "مرحبا" })).ok).toBe(false);
    expect(calls.length, "a refused turn must never reach the record").toBe(0);
  });

  it("reports a record that refused the turn, and one that answered with nothing", async () => {
    const refused = await loadDoor(fakeClient({ data: null, error: { code: "42703" } }).client);
    expect(await refused.recordChatTurn({ role: "user", content: "س" })).toEqual({
      ok: false,
      error: "سجل المحادثة رفض الكلمة",
    });

    const silent = await loadDoor(fakeClient({ data: [], error: null }).client);
    const wrote = await silent.recordChatTurn({ role: "user", content: "س" });
    expect(wrote.ok).toBe(false);
    expect((wrote as { error: string }).error).toContain("ما اتسجّلش");
  });

  it("reads the turn back out of the metadata column the record has", async () => {
    const reply = {
      data: [
        {
          role: "user",
          content: "كم ورقة مستنية؟",
          created_at: "2026-10-24T20:00:00.000Z",
          metadata: { session_id: "sess-1", command_executed: "analytics", command_result: null },
        },
      ],
      error: null,
    };
    const door = await loadDoor(fakeClient(reply).client);
    const read = await door.readChatTurns("u-1", { limit: 5 });

    expect(read.failed).toBe(false);
    expect(read.turns[0]).toMatchObject({
      role: "user",
      content: "كم ورقة مستنية؟",
      sessionId: "sess-1",
      commandExecuted: "analytics",
    });
  });

  it("says when the history could not be read instead of answering empty", async () => {
    const door = await loadDoor(fakeClient({ data: null, error: { code: "42501" } }).client);
    const read = await door.readChatTurns("u-1");
    expect(read).toEqual({ turns: [], failed: true });
  });
});

function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function chatChains(code: string): string[] {
  const chains: string[] = [];
  const marker = /from\(\s*["'`]chat_history["'`]/g;
  for (const match of code.matchAll(marker)) {
    const rest = code.slice((match.index ?? 0) + match[0].length);
    const next = rest.search(/from\(\s*["'`]/);
    chains.push(next === -1 ? rest.slice(0, 600) : rest.slice(0, next));
  }
  return chains;
}

function touchingChatTable(): string[] {
  const files: string[] = [];
  for (const dir of ["app", "lib", "services", "components"]) {
    const walk = (p: string) => {
      if (!existsSync(p)) return;
      for (const entry of readdirSync(p)) {
        const full = join(p, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(full) && /from\(\s*["'`]chat_history["'`]/.test(codeOf(full))) {
          files.push(full.replace(/\\/g, "/"));
        }
      }
    };
    walk(dir);
  }
  return files.sort();
}

describe("no desk writes the assistant's turns on its own", () => {
  it("only the one door builds a query against the table", () => {
    expect(touchingChatTable()).toEqual(["lib/ops/chat-record.ts"]);
  });

  it("the mastermind's writer returns what the record said, it does not swallow it", () => {
    const brain = codeOf("lib/mastermind-ai.ts");
    expect(brain).toContain("recordChatTurn");
    expect(brain).toContain("readChatTurns");
    expect(brain).toMatch(/async function saveMessage\(message: ChatMessage\): Promise<ChatWrite>/);
    expect(brain).not.toMatch(/Failed to save message|Failed to load history/);
  });

  it("the assistant door reads through the door and admits an unread history", () => {
    const door = codeOf("app/api/admin/assistant/route.ts");
    expect(door).toContain("readChatTurns");
    expect(door).toContain("historyFailed");
    expect(door).not.toMatch(/command_executed,\s*created_at/);
  });

  it("his screen says when the history was not read, in his own Arabic", () => {
    const ui = readFileSync("components/admin/UnifiedAssistant.tsx", "utf8");
    expect(ui).toContain("historyWarning");
    expect(ui).toMatch(/data\.historyFailed/);
    expect(ui).toMatch(/text-white\/70">\{historyWarning\}/);
  });
});
