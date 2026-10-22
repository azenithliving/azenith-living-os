// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The public advisor door has no way to write the manager's memory.
 *
 * Measured 2026-10-23 on the published link (`scratch/prove-learning-mode-hole.mjs`): an anonymous POST
 * to this door, carrying an admin email in its JSON body, was accepted as the owner and saved a rule
 * into `consultant_learnings` — 51 rows before the probe, 52 after — answering
 * `Knowledge saved successfully`. Requiring the admin session closed the hole but then taught the
 * manager every question the owner typed on his own test desk. Teaching has one owner now: the guarded
 * desk door, which asks the admin gate before it writes.
 */
const doorPath = "app/api/consultant/route.ts";
const deskDoorPath = "app/api/consultant/learnings/route.ts";

describe("a stranger cannot teach the store", () => {
  const door = readFileSync(doorPath, "utf8");

  it("the public door never writes the learnings table", () => {
    // Reading the rules into the advisor's prompt is the whole point of the door; writing them is not.
    expect(door).not.toMatch(/from\("consultant_learnings"\)[\s\S]{0,40}\.insert\(/);
    expect(door).not.toMatch(/\bsaveLearning\b/);
    expect(door).not.toMatch(/\bisAdmin\(/);
  });

  it("no identity is read out of the request body to decide privilege", () => {
    const code = door.split("\n").filter((l) => !/^\s*[*/]/.test(l)).join("\n");
    expect(code).not.toMatch(/MASTER_ADMIN_EMAILS/);
    expect(code).not.toMatch(/Knowledge saved/);
  });
});

describe("the desk door that does teach asks the gate", () => {
  const deskDoor = readFileSync(deskDoorPath, "utf8");

  it("asks the admin gate on every verb that writes", () => {
    const writes = deskDoor
      .split("export async function")
      .map((part) => part.trim())
      .filter((part) => /^(POST|PATCH|DELETE)/.test(part));
    expect(writes.length).toBeGreaterThanOrEqual(3);
    for (const verb of writes) {
      expect(verb, `a writing verb has no gate: ${verb.slice(0, 24)}`).toContain("requireAdminApi()");
    }
  });
});
