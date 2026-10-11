// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The English that the store writes about itself.
 *
 * The rendered census (scratch/census-owner-latin.mjs, 2026-10-11) left 84 Latin places on the owner's
 * screens, and the author census (scratch/census-english-authors.cjs) split them: a part is a model's
 * stored prose, and a part is sentences this repository composes itself. The second part is the one
 * that can be fixed at the source instead of patched at the render — and a fix at the render would
 * leave the next surface writing the same English.
 *
 * Four sources were named by file and line: the approval report prints the raw command it is about to
 * run; the activity feed prints the row's machine event type; the old dashboard labels two cards with
 * «AI» and «A/B»; and the command door alerts him in Telegram in English.
 */
import { commandLabel, eventLabel } from "@/lib/owner-labels";

const latin = (s: string) => s.match(/[A-Za-z]{2,}/g) ?? [];

describe("a command is named in Arabic wherever the owner reads about it", () => {
  it("knows the commands the executor actually answers to", () => {
    expect(commandLabel("send_notification تجربة التنبيه")).toBe("إرسال إشعار");
    expect(commandLabel("show_stats")).toBe("عرض الإحصائيات");
    expect(commandLabel("evolve")).toBe("تحسين الموقع الذاتي");
    expect(commandLabel("backup_db")).toBe("نسخة احتياطية من البيانات");
  });

  it("never guesses a name for a command it does not know", () => {
    // A wrong label is worse than a general one: it tells the owner something will happen that will not.
    expect(commandLabel("teleport_moon --hard")).toBe("أمر إداري");
    expect(commandLabel("")).toBe("أمر إداري");
  });

  it("carries no Latin in any label it returns", () => {
    for (const raw of ["send_notification x", "list_keys google", "clear_cache", "rate_limit /x 5"]) {
      expect(latin(commandLabel(raw)), raw).toEqual([]);
    }
  });
});

describe("an activity row's type is his words, not the column's value", () => {
  it("names the event types the feed receives", () => {
    expect(eventLabel("command")).toBe("أمر");
    expect(eventLabel("system")).toBe("النظام");
    expect(eventLabel("task")).toBe("مهمة");
  });

  it("says nothing rather than printing a value it does not know", () => {
    expect(eventLabel("quantum_leap")).toBe("");
    expect(eventLabel("")).toBe("");
  });
});

describe("the approval report stops quoting the machine", () => {
  const report = readFileSync("lib/admin-approval-report.ts", "utf8");

  it("labels the command instead of pasting its id", () => {
    expect(report).toContain("commandLabel(");
    expect(report).not.toContain("${intent.commandLine || intent.command}");
  });

  it("drops the English engine name from his sentence", () => {
    expect(report).not.toContain("عبر Genesis");
    expect(report).not.toContain("نتيجة Genesis");
  });
});

describe("the screens he opens every morning", () => {
  it("says what the assistant is, without its English abbreviation", () => {
    const dashboard = readFileSync("app/admin/page.tsx", "utf8");
    expect(dashboard).not.toContain('"تفاعلات AI"');
    expect(dashboard).not.toContain("تجارب A/B");
  });

  it("alerts him in his language when a command is refused at the gate", () => {
    const door = readFileSync("app/api/admin/command/route.ts", "utf8");
    expect(door).not.toContain("COMMAND ATTEMPT WITHOUT 2FA");
    expect(door).toContain("sendSecurityAlert");
    // Every refusal this door answers with is text he reads in the console, not a log line.
    expect(door).not.toMatch(/error:\s*"[A-Za-z][A-Za-z .,'-]{8,}"/);
  });

  it("prints the event label, not the row's raw type", () => {
    const feed = readFileSync("components/admin/agents/AgentActionsFeed.tsx", "utf8");
    expect(feed).toContain("eventLabel(item.type)");
  });
});

/**
 * One fact, one owner: the executor's own help list and the labels above must not drift apart, or the
 * day a command is renamed the owner reads a name for something that no longer runs.
 */
describe("the command names have one owner", () => {
  it("builds the help list from the same table", () => {
    const executor = readFileSync("lib/command-executor.ts", "utf8");
    expect(executor).toContain('from "./owner-labels"');
    expect(executor).toContain("COMMAND_LABELS");
  });
});
