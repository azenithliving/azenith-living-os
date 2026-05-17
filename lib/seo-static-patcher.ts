/**
 * Patches static Next.js metadata in the repo (GitHub API on Vercel, local fs in dev).
 */

import fs from "fs";
import path from "path";
import {
  applyRepoPatches,
  getGitHubConfig,
  readRepoFile,
  type GitHubRepoConfig,
} from "@/lib/github-repo-client";

export interface StaticSeoPatchInput {
  title: string;
  description: string;
  canonicalUrl?: string;
  paths?: string[];
}

export interface StaticSeoPatchResult {
  success: boolean;
  message: string;
  applied: string[];
  prUrl?: string;
}

const DEFAULT_PATHS = ["app/layout.tsx"];

export async function patchStaticSeoMetadata(
  input: StaticSeoPatchInput
): Promise<StaticSeoPatchResult> {
  const paths = input.paths?.length ? input.paths : DEFAULT_PATHS;
  const applied: string[] = [];
  const patches: Array<{ path: string; content: string }> = [];

  for (const filePath of paths) {
    const patched = await patchLayoutMetadataContent(filePath, input);
    if (patched) patches.push({ path: filePath, content: patched });
  }

  if (patches.length === 0) {
    return {
      success: false,
      message: "لم أتمكن من توليد تعديلات metadata للملفات الثابتة",
      applied: [],
    };
  }

  const gh = getGitHubConfig();
  if (gh) {
    const result = await applyRepoPatches(
      gh,
      patches.map((p) => ({
        path: p.path,
        content: p.content,
        message: `seo: update metadata in ${p.path}`,
      })),
      { prTitle: "[Agent] SEO static metadata fix", branchSuffix: `seo-${Date.now()}` }
    );
    if (result.filesWritten.length > 0) {
      return {
        success: true,
        message: result.prUrl
          ? `تم فتح PR لتعديل HTML/Metadata: ${result.filesWritten.join(", ")}`
          : `تم دفع الفرع ${result.branch} — ${result.filesWritten.join(", ")}`,
        applied: result.filesWritten,
        prUrl: result.prUrl,
      };
    }
  }

  if (!isVercelReadonly()) {
    for (const p of patches) {
      const abs = path.join(process.cwd(), p.path);
      fs.writeFileSync(abs, p.content, "utf-8");
      applied.push(p.path);
    }
    return {
      success: true,
      message: `تم تحديث الملفات محلياً: ${applied.join(", ")} — أعد التشغيل أو ادفع git`,
      applied,
    };
  }

  return {
    success: false,
    message:
      "اربط GITHUB_TOKEN + GITHUB_REPO لتعديل app/layout.tsx من الإنتاج، أو شغّل محلياً",
    applied: [],
  };
}

function isVercelReadonly(): boolean {
  return process.env.VERCEL === "1" || process.env.VERCEL_ENV === "production";
}

async function readFileContent(filePath: string): Promise<string | null> {
  const gh = getGitHubConfig();
  if (gh) {
    const r = await readRepoFile(gh, filePath);
    if (r.success && r.content) return r.content;
  }
  const abs = path.join(process.cwd(), filePath);
  if (fs.existsSync(abs)) return fs.readFileSync(abs, "utf-8");
  return null;
}

function patchLayoutMetadataContent(
  filePath: string,
  input: StaticSeoPatchInput
): Promise<string | null> {
  return readFileContent(filePath).then((raw) => {
    if (!raw) return null;
    const title = escapeTs(input.title.slice(0, 70));
    const desc = escapeTs(input.description.slice(0, 160));
    const url = input.canonicalUrl || "https://azenith-living-os.vercel.app";

    let next = raw;
    next = next.replace(/title:\s*["'`][^"'`]*["'`]/, `title: "${title}"`);
    next = next.replace(
      /description:\s*["'`][^"'`]*["'`]/,
      `description: "${desc}"`
    );
    if (/openGraph:\s*\{/.test(next)) {
      next = next.replace(
        /openGraph:\s*\{[\s\S]*?title:\s*["'`][^"'`]*["'`]/,
        (m) => m.replace(/title:\s*["'`][^"'`]*["'`]/, `title: "${title}"`)
      );
      next = next.replace(
        /(openGraph:\s*\{[\s\S]*?)description:\s*["'`][^"'`]*["'`]/,
        `$1description: "${desc}"`
      );
      next = next.replace(
        /(openGraph:\s*\{[\s\S]*?)url:\s*["'`][^"'`]*["'`]/,
        `$1url: "${url}"`
      );
    }
    if (/twitter:\s*\{/.test(next)) {
      next = next.replace(
        /(twitter:\s*\{[\s\S]*?)title:\s*["'`][^"'`]*["'`]/,
        `$1title: "${title}"`
      );
      next = next.replace(
        /(twitter:\s*\{[\s\S]*?)description:\s*["'`][^"'`]*["'`]/,
        `$1description: "${desc}"`
      );
    }
    return next !== raw ? next : null;
  });
}

function escapeTs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ");
}

export async function fetchAndPatchStaticFromUrl(
  siteUrl: string,
  analysisTitle: string,
  analysisDescription: string
): Promise<StaticSeoPatchResult> {
  return patchStaticSeoMetadata({
    title: analysisTitle,
    description: analysisDescription,
    canonicalUrl: siteUrl,
    paths: ["app/layout.tsx"],
  });
}
