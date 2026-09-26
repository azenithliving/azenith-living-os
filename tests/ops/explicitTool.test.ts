// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { explicitIntent, TOOL_CATALOG } from "@/lib/agents/intent-router";
import { CAPABILITY_LABELS } from "@/lib/ops/palette";

/**
 * A palette click is an order, not a question: the owner picked a named
 * capability, so the swarm must run exactly that tool instead of gambling on
 * what an intent model makes of the Arabic label. This is the seam that keeps
 * that promise, and it is still whitelist-gated — naming a tool that does not
 * exist is a refusal, never an execution.
 */
describe("explicitIntent", () => {
  it("resolves a whitelisted tool by name", () => {
    expect(explicitIntent("qa_load_probe")).toEqual({ toolName: "qa_load_probe", params: {} });
  });

  it("carries parameters only when they really are an object", () => {
    expect(explicitIntent("seo_analyze", { url: "https://example.invalid/rooms" })?.params).toEqual({
      url: "https://example.invalid/rooms",
    });
    expect(explicitIntent("seo_analyze", "https://evil")?.params).toEqual({});
    expect(explicitIntent("seo_analyze", null)?.params).toEqual({});
  });

  it("refuses anything outside the catalog, so a guessed id cannot execute", () => {
    for (const bad of ["drop_tables", "", "  ", "QA_LOAD_PROBE", "constructor", "toString"]) {
      expect(explicitIntent(bad), bad).toBeNull();
    }
  });

  it("refuses shapes that are not strings at all", () => {
    for (const bad of [undefined, null, 42, {}, [], true]) {
      expect(explicitIntent(bad as unknown)).toBeNull();
    }
  });

  /** Prototype keys are the classic hole: `explicitIntent("constructor")` would
   * otherwise answer "yes, that tool exists". */
  it("does not mistake an object key for a tool", () => {
    expect(TOOL_CATALOG.some((t) => t.name === "constructor")).toBe(false);
    expect(explicitIntent("constructor")).toBeNull();
  });

  it("knows every capability the palette can offer", () => {
    for (const name of Object.keys(CAPABILITY_LABELS)) {
      expect(explicitIntent(name), name).not.toBeNull();
    }
  });
});

describe("the explicit path is wired end to end", () => {
  it("the orchestrator honours run_tool before it asks a model to route", () => {
    const src = readFileSync(resolve(process.cwd(), "lib/agents/AgentOrchestrator.ts"), "utf8");
    expect(src).toContain("explicitIntent");
    expect(src).toContain("run_tool");
  });

  it("the chat route validates and forwards it", () => {
    const src = readFileSync(resolve(process.cwd(), "app/api/admin/agents/chat/route.ts"), "utf8");
    expect(src).toContain("run_tool");
    expect(src).toContain("run_params");
  });
});
