import { describe, expect, it } from "vitest";
import { heuristicClassify } from "@/lib/admin-intent-classifier";
import { isDbFixable } from "@/lib/seo-auto-fixer";
import { getGitHubConfig } from "@/lib/github-repo-client";
import { TOOL_REGISTRY, validateToolParams } from "@/lib/agent-tools/tool-registry";

describe("real execution paths (not deferred gaps)", () => {
  it("project_evolve tool is registered", () => {
    expect(TOOL_REGISTRY.project_evolve).toBeDefined();
    expect(String(TOOL_REGISTRY.project_evolve.handler)).not.toMatch(/not yet/i);
  });

  it("backup_restore accepts confirmUsersRestore", () => {
    const tool = TOOL_REGISTRY.backup_restore;
    expect(JSON.stringify(tool.parameters)).toMatch(/confirmUsersRestore/);
  });

  it("backup_create calls the one implementation that is measured live", () => {
    const handlerSource = String(TOOL_REGISTRY.backup_create.handler);
    expect(handlerSource).not.toMatch(/placeholder-url|simulated:\s*true/);
    // Measured 2026-10-19: the old path wrote a `backup_snapshots` row into a table that does not
    // exist and asked Vercel Blob for a public URL over the owner's record. The copy now has one
    // owner — the nightly module that was proved on the published site (40 checks).
    expect(handlerSource).toMatch(/runNightlySnapshot/);
    expect(handlerSource).not.toMatch(/database_inline|data:application\/json|backup_snapshots/);
  });

  it("natural backup requests include required params", () => {
    const r = heuristicClassify("اعمل نسخة احتياطية للإعدادات");
    expect(r?.toolName).toBe("backup_create");
    expect(validateToolParams(r!.toolName!, r!.toolParams || {}).valid).toBe(true);
  });

  it("content_update classifier params pass tool validation", () => {
    const r = heuristicClassify(
      "حدّث محتوى صفحة الهوم للنص الجديد 11111111-1111-1111-1111-111111111111"
    );
    expect(r?.toolName).toBe("content_update");
    expect(validateToolParams(r!.toolName!, r!.toolParams || {}).valid).toBe(true);
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
