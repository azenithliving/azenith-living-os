// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The owner's chat history is not a scratch pad.
 *
 * Measured 2026-10-15: a measurement instrument cleaned up after itself with
 * `delete from agent_messages where conversation_id = …` — and the conversation it matched was the
 * owner's own, so it erased 306 of his rows (1,741 → 1,435) instead of the 3 it made. There is no
 * backup to restore from on this plan. Nothing in the store may delete a chat row by its conversation,
 * and this guard is what keeps that from coming back as a feature.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

const files = [...walk("app"), ...walk("lib")];

describe("no door deletes the swarm's chat history", () => {
  it("walks the doors, not nothing", () => {
    expect(files.length, "server sources walked").toBeGreaterThan(500);
    expect(files.some((f) => f.endsWith(join("app", "api", "admin", "agents", "messages", "route.ts"))), "the chat door walked").toBe(true);
  });

  it("nothing removes a chat row by its conversation", () => {
    const hits = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /from\(["']agent_messages["']\)\s*[\s\S]{0,120}?\.delete\(/.test(source);
    });
    expect(hits, `أبواب بتمسح من تاريخ الشات: ${hits.join(", ")}`).toEqual([]);
  });

  it("no SQL in the repository deletes those rows wholesale either", () => {
    const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql"));
    const hits = migrations.filter((f) => /delete\s+from\s+(public\.)?agent_messages/i.test(readFileSync(join("supabase/migrations", f), "utf8")));
    expect(hits, `سكريبتات بتمسح الشات: ${hits.join(", ")}`).toEqual([]);
  });
});
