// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The tenant console answers to the admin gate only.
 *
 * Measured 2026-10-23 on the published link (`scratch/prove-tenants-door.mjs`): with no cookie and no
 * session, GET returned the company's name and WhatsApp number, and POST created a row in `companies`
 * (the probe deleted it again, and the count returned to 1). The door writes with the service-role
 * client, and the same table is what resolves which company a visitor's host belongs to — so an
 * outsider could read the store's contact line and add a company the advisor would route to.
 */
const doorPath = "app/api/tenants/route.ts";

describe("the tenant door is not public", () => {
  const door = readFileSync(doorPath, "utf8");

  it("asks the admin gate on both verbs", () => {
    const verbs = door
      .split("export async function")
      .map((part) => part.trim())
      .filter((part) => /^(GET|POST)/.test(part));
    expect(verbs.length).toBe(2);
    for (const verb of verbs) {
      expect(verb, `a verb has no gate: ${verb.slice(0, 20)}`).toContain("requireAdminApi()");
      expect(verb).toContain("if (unauthorized) return unauthorized");
    }
  });

  it("answers in his language when it refuses", () => {
    const spoken = [...door.matchAll(/message:\s*"([^"]*)"/g)].map((m) => m[1]);
    expect(spoken.length).toBeGreaterThanOrEqual(5);
    for (const line of spoken) expect(line, `Latin refusal: ${line}`).toMatch(/[؀-ۿ]/);
  });
});
