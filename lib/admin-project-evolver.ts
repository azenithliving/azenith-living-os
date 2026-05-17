/**
 * Full project evolution — multi-file GitHub PR or local apply (real execution).
 */

import { analyzeCommandLogs } from "@/lib/self-evolution";
import { applyRepoPatches, getGitHubConfig, readRepoFile } from "@/lib/github-repo-client";
import { queueCloudEvolutionPatch, type CloudPatchPayload } from "@/lib/admin-cloud-evolution";
import { fetchAndPatchStaticFromUrl } from "@/lib/seo-static-patcher";
import { createClient } from "@supabase/supabase-js";

const EVOLVE_ALLOWLIST = [
  "lib/command-executor.ts",
  "lib/admin-natural-brain.ts",
  "lib/admin-intent-classifier.ts",
  "lib/admin-tool-bridge.ts",
  "lib/admin-extended-handlers.ts",
  "lib/seo-auto-fixer.ts",
  "lib/agent-tools/tool-handlers.ts",
  "app/layout.tsx",
  "app/globals.css",
];

export async function executeProjectEvolutionMission(
  mission: string,
  opts?: { userId?: string }
): Promise<{ success: boolean; message: string; prUrl?: string; data?: unknown }> {
  const lower = mission.toLowerCase();

  if (/seo|meta|عنوان|وصف.*الموقع/i.test(lower)) {
    const url =
      process.env.NEXT_PUBLIC_SITE_URL || "https://azenith-living-os.vercel.app";
    const r = await fetchAndPatchStaticFromUrl(
      url,
      "Azenith Living | تصميم داخلي فاخر",
      "تصميم داخلي فاخر — Azenith Living OS"
    );
    return { success: r.success, message: r.message, prUrl: r.prUrl, data: r };
  }

  const supabase = getServiceSupabase();
  const analysis = supabase
    ? await analyzeCommandLogs(supabase)
    : {
        suggestions: [],
        totalAnalyzed: 0,
        failedCommands: 0,
        slowCommands: 0,
        patterns: [],
        report: "",
      };

  const applicable = analysis.suggestions.filter(
    (s) => s.canAutoApply && s.targetFile && s.searchPattern && s.replacement
  );

  const gh = getGitHubConfig();
  if (gh && applicable.length > 0) {
    const filePatches: Array<{ path: string; content: string; message?: string }> = [];

    for (const s of applicable.slice(0, 5)) {
      const file = s.targetFile!;
      if (!EVOLVE_ALLOWLIST.some((a) => file.endsWith(a) || file.includes(a))) continue;
      const raw = await readRepoFile(gh, file);
      if (!raw.success || !raw.content || !raw.content.includes(s.searchPattern!)) continue;
      const next = raw.content.replace(s.searchPattern!, s.replacement!);
      filePatches.push({
        path: file,
        content: next,
        message: `evolve: ${s.description.slice(0, 60)}`,
      });
    }

    if (filePatches.length > 0) {
      const pr = await applyRepoPatches(gh, filePatches, {
        prTitle: `[Agent] Project evolution: ${mission.slice(0, 60)}`,
        branchSuffix: `evo-${Date.now()}`,
      });
      if (pr.filesWritten.length > 0) {
        await storeEvolutionAudit(mission, pr, opts?.userId);
        return {
          success: true,
          message: `تم تطبيق ${pr.filesWritten.length} ملف عبر GitHub${pr.prUrl ? ` — PR: ${pr.prUrl}` : ""}`,
          prUrl: pr.prUrl,
          data: pr,
        };
      }
    }
  }

  let queued = 0;
  for (const s of applicable.slice(0, 3)) {
    const patch: CloudPatchPayload | null = s.targetFile
      ? {
          targetFile: s.targetFile,
          searchPattern: s.searchPattern!,
          replacement: s.replacement!,
          description: s.description,
          type: s.type,
        }
      : null;
    if (patch) {
      const r = await queueCloudEvolutionPatch(patch, { userId: opts?.userId });
      if (r.success) queued++;
    }
  }

  if (queued > 0) {
    return {
      success: true,
      message: `تم تجهيز ${queued} تعديل(ات) للموافقة + تنفيذ (عقل النظام). اربط GITHUB_TOKEN لـ PR فوري.`,
      data: { queued, suggestions: applicable.length },
    };
  }

  return {
    success: false,
    message:
      "لم أجد تعديلات جاهزة — شغّل أوامر ثم evolve، أو اربط GITHUB_TOKEN، أو صِف مهمة SEO/كود أوضح.",
  };
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function storeEvolutionAudit(
  mission: string,
  pr: { filesWritten: string[]; prUrl?: string },
  userId?: string
) {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  await supabase.from("agent_memory").insert({
    type: "evolution",
    category: "project_evolution_pr",
    content: mission.slice(0, 2000),
    context: { files: pr.filesWritten, prUrl: pr.prUrl },
    priority: "high",
    actor_user_id: userId || null,
  });
}
