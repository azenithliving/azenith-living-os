/**
 * Production-safe code evolution — queues patches for approval + optional GitHub PR / Vercel deploy.
 * Works when Vercel filesystem is read-only.
 */

import { createClient } from "@supabase/supabase-js";
import type { EvolutionSuggestion } from "@/lib/self-evolution";

export interface CloudPatchPayload {
  targetFile: string;
  searchPattern: string;
  replacement: string;
  description: string;
  type?: string;
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isVercelProduction(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

export function isSelfExecutionEnabled(): boolean {
  if (process.env.ENABLE_SELF_EXECUTION === "true") return true;
  if (process.env.ENABLE_SELF_EXECUTION === "false") return false;
  return !isVercelProduction();
}

export async function queueCloudEvolutionPatch(
  suggestion: CloudPatchPayload,
  opts?: { userId?: string; userEmail?: string }
): Promise<{ success: boolean; message: string; requestId?: string; prUrl?: string }> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return { success: false, message: "قاعدة البيانات غير متاحة لحفظ التعديل" };
  }

  const patchId = crypto.randomUUID();
  await supabase.from("agent_memory").insert({
    type: "code_patch",
    category: "cloud_evolution",
    content: suggestion.description.slice(0, 2000),
    context: { patchId, ...suggestion },
    priority: "high",
    actor_user_id: opts?.userId || null,
    company_id: process.env.MASTER_COMPANY_ID || null,
  });

  let prUrl: string | undefined;
  const gh = await tryGitHubPatch(suggestion, patchId);
  if (gh.success) prUrl = gh.prUrl;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      action_id: patchId,
      action_type: "code_evolution_patch",
      description: `تعديل كود: ${suggestion.description}\n\nالملف: ${suggestion.targetFile}`,
      risk_level: "high",
      requested_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      status: "pending",
      metadata: {
        executor: "cloud_evolution",
        patch: suggestion,
        prUrl,
        userId: opts?.userId,
        userEmail: opts?.userEmail,
      },
      actor_user_id: opts?.userId || null,
      company_id: process.env.MASTER_COMPANY_ID || null,
    })
    .select("id")
    .single();

  if (error) {
    return {
      success: true,
      message:
        `تم حفظ التعديل في الذاكرة (patch ${patchId}).` +
        (prUrl ? `\nPR: ${prUrl}` : "\nاربط GITHUB_TOKEN لإنشاء PR تلقائي."),
    };
  }

  return {
    success: true,
    message:
      `✅ **تطوير سحابي** — التعديل في قائمة الموافقة.\n` +
      `📁 \`${suggestion.targetFile}\`\n` +
      (prUrl ? `🔗 [Pull Request](${prUrl})\n` : "💡 أضف `GITHUB_TOKEN` + `GITHUB_REPO=owner/repo` لـ PR تلقائي.\n") +
      `🛡️ وافق من «عقل النظام» ثم نفّذ deploy.`,
    requestId: data?.id,
    prUrl,
  };
}

async function tryGitHubPatch(
  patch: CloudPatchPayload,
  branchSuffix: string
): Promise<{ success: boolean; prUrl?: string }> {
  const { getGitHubConfig, readRepoFile, applyRepoPatches } = await import("./github-repo-client");
  const cfg = getGitHubConfig();
  if (!cfg) return { success: false };

  const raw = await readRepoFile(cfg, patch.targetFile);
  if (!raw.success || !raw.content || !raw.content.includes(patch.searchPattern)) {
    return { success: false };
  }
  const next = raw.content.replace(patch.searchPattern, patch.replacement);
  const pr = await applyRepoPatches(
    cfg,
    [{ path: patch.targetFile, content: next, message: patch.description }],
    { branchSuffix, prTitle: `[Agent] ${patch.description.slice(0, 80)}` }
  );
  return { success: pr.filesWritten.length > 0, prUrl: pr.prUrl };
}

export async function triggerVercelDeploy(): Promise<{ success: boolean; message: string }> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!hook) {
    return {
      success: false,
      message: "أضف VERCEL_DEPLOY_HOOK_URL لتفعيل النشر بعد الموافقة",
    };
  }
  const res = await fetch(hook, { method: "POST" });
  if (!res.ok) {
    return { success: false, message: `فشل deploy hook: ${res.status}` };
  }
  return { success: true, message: "تم طلب نشر Vercel — راقب لوحة Vercel خلال دقائق" };
}

export async function applyCloudEvolutionFromApproval(metadata: {
  patch: CloudPatchPayload;
  prUrl?: string;
}): Promise<{ success: boolean; message: string }> {
  if (metadata.prUrl) {
    const deploy = await triggerVercelDeploy();
    return {
      success: true,
      message: `تمت الموافقة. الدمج عبر PR: ${metadata.prUrl}\n${deploy.message}`,
    };
  }
  if (!isSelfExecutionEnabled()) {
    return queueCloudEvolutionPatch(metadata.patch).then((r) => ({
      success: r.success,
      message: r.message,
    }));
  }
  const { applySuggestion } = await import("@/lib/sandbox-executor");
  return applySuggestion({
    type: metadata.patch.type || "patch",
    targetFile: metadata.patch.targetFile,
    searchPattern: metadata.patch.searchPattern,
    replacement: metadata.patch.replacement,
    description: metadata.patch.description,
  });
}

export function suggestionToCloudPatch(s: EvolutionSuggestion): CloudPatchPayload | null {
  if (!s.targetFile || !s.searchPattern || !s.replacement) return null;
  return {
    targetFile: s.targetFile,
    searchPattern: s.searchPattern,
    replacement: s.replacement,
    description: s.description,
    type: s.type,
  };
}
