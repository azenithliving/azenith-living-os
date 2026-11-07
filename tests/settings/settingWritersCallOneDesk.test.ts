// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * One owner of «change a store setting».
 *
 * Measured 2026-11-06: three live surfaces wrote settings, each against a shape the record does not
 * have — the employee tool and the second executor both inserted a revision into `content_revisions`
 * (no such table, PGRST205) and then tried to filter `site_settings.id` (no such column), and the
 * rollback door read the same missing drawer. So the desk is now the only place that writes a
 * setting, and these guards fail the moment a second writer reappears with the invented columns.
 *
 * Comments are stripped before scanning: the source is allowed to explain the dead shape it replaced,
 * and a guard that counts prose would force the explanation out of the only file a reader opens.
 */
const strip = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const deskSource = strip(readFileSync("lib/site-settings-desk.ts", "utf8"));
const toolHandlers = readFileSync("lib/agent-tools/tool-handlers.ts", "utf8");
const realExecutor = readFileSync("lib/real-tool-executor.ts", "utf8");
const architectTools = readFileSync("lib/architect-tools.ts", "utf8");
const rollbackDoor = strip(readFileSync("app/api/admin/agent/rollback/route.ts", "utf8"));

/** The body of one function, up to the next top-level function — not to the end of the file. */
function body(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`${signature} is gone from the file — the capability was deleted, not moved`);
  const rest = source.slice(start + signature.length);
  const nextTopLevel = rest.search(/\n(?:export )?(?:async )?function /);
  return nextTopLevel < 0 ? source.slice(start) : source.slice(start, start + signature.length + nextTopLevel);
}

describe("the agent setting writers share one desk", () => {
  it("the employee tool calls the desk and never names the invented columns", () => {
    const fn = strip(body(toolHandlers, "export async function executeSettingUpdate("));

    expect(fn).toContain("writeSiteSetting");
    expect(fn).not.toContain("content_revisions");
    expect(fn).not.toContain("current_revision_id");
    expect(fn).not.toContain('from("site_settings")');
  });

  it("the second executor calls the same desk instead of keeping its own copy", () => {
    const fn = strip(body(realExecutor, "async function executeSettingUpdate("));

    expect(fn).toContain("writeSiteSetting");
    expect(fn).not.toContain("content_revisions");
    expect(fn).not.toContain("current_revision_id");
    expect(fn).not.toContain("setting_key");
  });

  it("the architect writer calls the same desk instead of filtering a company column", () => {
    const fn = strip(body(architectTools, "export async function updateSiteSetting("));

    expect(fn).toContain("writeSiteSetting");
    expect(fn).not.toContain("company_id");
    expect(fn).not.toContain("supabaseService");
    expect(fn).not.toContain("محاكاة");
  });

  it("the rollback door asks the desk, by the execution the owner's chat actually sends", () => {
    expect(rollbackDoor).toContain("rollbackSettingsForExecution");
    expect(rollbackDoor).toContain("executionId");
    expect(rollbackDoor).not.toContain("content_revisions");
  });

  it("the rollback door refuses in the owner's own words, with no machine identifier in his sentence", () => {
    // The old door queried `site_sections` — a drawer the record does not have. Naming a table on the
    // owner's screen is forbidden here whatever the verdict; what he gets is the shape in Arabic.
    expect(rollbackDoor).not.toMatch(/from\("site_sections"\)/);
    expect(rollbackDoor).not.toMatch(/from\("content_revisions"\)/);

    const arabicCopy = [...rollbackDoor.matchAll(/["'`]([^"'`]*[؀-ۿ][^"'`]*)["'`]/g)].map((m) => m[1]);
    expect(arabicCopy.length).toBeGreaterThan(3);
    const offenders = arabicCopy.filter((line) => /content_revisions|site_sections|site_settings|page_sections|room_sections|[a-z]+_[a-z]+/.test(line));
    expect(offenders).toEqual([]);
  });
});

describe("the invented settings columns are gone from the code", () => {
  it("no source file writes a setting through the columns the record never had", () => {
    const offenders: string[] = [];
    for (const [file, source] of [
      ["lib/site-settings-desk.ts", deskSource],
      ["lib/agent-tools/tool-handlers.ts", strip(body(toolHandlers, "export async function executeSettingUpdate("))],
      ["lib/real-tool-executor.ts", strip(body(realExecutor, "async function executeSettingUpdate("))],
      ["lib/architect-tools.ts", strip(body(architectTools, "export async function updateSiteSetting("))],
      ["app/api/admin/agent/rollback/route.ts", rollbackDoor],
    ] as const) {
      for (const invented of ["current_revision_id", "setting_value", "setting_key", "setting_category"]) {
        if (source.includes(invented)) offenders.push(`${file} · ${invented}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("history rides on the drawer that already has a writer", () => {
    expect(deskSource).toContain("recordAuditEvent");
    expect(deskSource).not.toContain("content_revisions");
  });
});
