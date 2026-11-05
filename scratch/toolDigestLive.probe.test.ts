// @vitest-environment node
import { describe, expect, it } from "vitest";

import { runUltimateTool } from "@/lib/admin-tool-bridge";
import { supabaseServer } from "@/lib/dal/unified-supabase";

/**
 * ONE-OFF probe against his live tables — read-only tools, printed, not kept.
 * Run with: npx vitest run tests/ops/toolDigestLive.test.ts
 */
describe("the desks answer in Arabic on his real data", () => {
  it("prints what draft_list and ops_world say today", async () => {
    const { data: draftRows } = await supabaseServer.from("ops_drafts").select("company_id").limit(1);
    const companyId = (draftRows?.[0] as any)?.company_id ?? undefined;

    for (const tool of ["draft_list", "ops_world"]) {
      const res: any = await runUltimateTool(tool, {}, { userId: "probe", companyId });
      const message = String(res?.message ?? "");
      // A path is an address he can press, not a machine word inside a sentence — the same rule the
      // screen applies. Only prose is counted.
      const prose = message
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/(^|\s)\/[A-Za-z0-9\-_./#%]{2,}/g, " ")
        .replace(/`[^`]*`/g, " ");
      const latin = prose.match(/[A-Za-z]{3,}/g) ?? [];
      console.log(`\n── ${tool} (success=${res?.success}) ──\n${message.slice(0, 600)}`);
      console.log(`Latin words left in the prose: ${latin.length ? latin.join(", ") : "0"}`);
      expect(latin).toEqual([]);
    }
  }, 120_000);
});
