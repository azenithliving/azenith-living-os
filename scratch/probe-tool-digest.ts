/**
 * The two tools that read the store's own tables, run for real against the live data.
 *   npx ts-node --transpile-only -r tsconfig-paths/register scratch/probe-tool-digest.ts
 *
 * Read-only: these tools only count. This exists because the owner's screen shows what the tool
 * answers, and the answer used to carry `confirmed`, `image_fix` and `/#kitchens` inside an Arabic
 * sentence. Nothing here is asserted — it prints what the desk really says today.
 */
import { runUltimateTool } from "@/lib/admin-tool-bridge";

(async () => {
  const { supabaseServer } = await import("@/lib/dal/unified-supabase");
  const { data: draftRows } = await supabaseServer.from("ops_drafts").select("company_id").limit(1);
  const companyId = (draftRows?.[0] as any)?.company_id ?? null;
  console.log(`company ${companyId ? "from the drafts table" : "not found — tools will say so"}`);

  for (const tool of ["draft_list", "ops_world"]) {
    const res: any = await runUltimateTool(tool, {}, { userId: "probe", companyId: companyId ?? undefined });
    console.log(`\n── ${tool} (success=${res?.success}) ──\n${String(res?.message ?? res?.output ?? "").slice(0, 700)}`);
    const latin = (String(res?.message ?? "").replace(/https?:\/\/\S+/g, " ").match(/[A-Za-z]{3,}/g) ?? []);
    console.log(`   Latin words left in the answer: ${latin.length ? latin.join(", ") : "0"}`);
  }
  process.exit(0);
})();
