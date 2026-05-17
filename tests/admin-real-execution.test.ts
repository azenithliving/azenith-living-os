import { describe, expect, it } from "vitest";
import { heuristicClassify } from "@/lib/admin-intent-classifier";
import { isDbFixable } from "@/lib/seo-auto-fixer";
import { getGitHubConfig } from "@/lib/github-repo-client";
import { TOOL_REGISTRY } from "@/lib/agent-tools/tool-registry";

describe("real execution paths (not deferred gaps)", () => {
  it("project_evolve tool is registered", () => {
    expect(TOOL_REGISTRY.project_evolve).toBeDefined();
    expect(String(TOOL_REGISTRY.project_evolve.handler)).not.toMatch(/not yet/i);
  });

  it("backup_restore accepts confirmUsersRestore", () => {
    const tool = TOOL_REGISTRY.backup_restore;
    expect(JSON.stringify(tool.parameters)).toMatch(/confirmUsersRestore/);
  });

  it("classifies project evolution missions", () => {
    const r = heuristicClassify("طوّر المشروع من الأخطاء وافتح PR");
    expect(r?.toolName).toBe("project_evolve");
  });

  it("seo fix includes static path eligibility", () => {
    expect(isDbFixable("missing_title")).toBe(true);
  });

  it("github config helper is callable", () => {
    const cfg = getGitHubConfig();
    expect(cfg === null || typeof cfg?.owner === "string").toBe(true);
  });
});
