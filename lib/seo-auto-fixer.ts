/**
 * Applies real SEO fixes to database-backed site config (works on Vercel).
 */

import { createClient } from "@supabase/supabase-js";
import { analyzeSEO } from "@/lib/seo-analyzer";
import { updateSiteSetting } from "@/lib/architect-tools";
import type { SEOIssue } from "@/lib/agent-types";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface SeoAutoFixResult {
  success: boolean;
  message: string;
  applied: string[];
  skipped: string[];
  data?: Record<string, unknown>;
}

export async function applySeoAutoFixes(params: {
  url: string;
  autoFixAll?: boolean;
  issueCodes?: string[];
}): Promise<SeoAutoFixResult> {
  const analysis = await analyzeSEO(params.url, undefined, { saveToDatabase: true });
  if (!analysis.success || !analysis.data) {
    return {
      success: false,
      message: analysis.message || "فشل تحليل SEO",
      applied: [],
      skipped: [],
    };
  }

  const issues = (analysis.data.issues || []) as SEOIssue[];
  const toFix = issues.filter((i) => {
    if (params.issueCodes?.length) return params.issueCodes.includes(i.code);
    if (params.autoFixAll) return i.autoFixable !== false || isDbFixable(i.code);
    return isDbFixable(i.code);
  });

  const applied: string[] = [];
  const skipped: string[] = [];
  const supabase = getServiceSupabase();

  const meta = analysis.data.metaTags;
  const pageTitle =
    meta?.title?.value ||
    "Azenith Living — تصميم داخلي فاخر";
  const pageDesc =
    meta?.description?.value ||
    "استوديو تصميم داخلي فاخر — استشارات، تنفيذ، وتجربة رقمية متكاملة.";

  if (toFix.some((i) => /missing_title|title_|meta_description|canonical/i.test(i.code))) {
    const seoPayload = {
      siteTitle: pageTitle.slice(0, 60),
      siteDescription: pageDesc.slice(0, 160),
      canonicalUrl: params.url,
      ogTitle: pageTitle.slice(0, 60),
      ogDescription: pageDesc.slice(0, 160),
    };
    const r = await updateSiteSetting({ key: "seo", value: seoPayload });
    if (r.success) {
      applied.push("site_settings.seo (عنوان، وصف، canonical)");
    } else {
      skipped.push(`site_settings.seo: ${r.message}`);
    }
  }

  if (supabase && toFix.some((i) => i.code === "missing_h1")) {
    const { data: hero } = await supabase
      .from("site_sections")
      .select("id, content, name")
      .or("type.eq.hero,page_placement.eq.home")
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (hero?.id) {
      const content = (hero.content as Record<string, unknown>) || {};
      if (!content.title && !content.heading) {
        const { error } = await supabase
          .from("site_sections")
          .update({
            content: {
              ...content,
              title: pageTitle.slice(0, 80),
              heading: pageTitle.slice(0, 80),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", hero.id);
        if (!error) applied.push(`site_sections.${hero.id}.h1`);
        else skipped.push(`h1: ${error.message}`);
      }
    } else {
      skipped.push("missing_h1: لا يوجد قسم hero لتحديثه");
    }
  }

  if (supabase && toFix.some((i) => i.code === "images_missing_alt")) {
    const { data: sections } = await supabase
      .from("site_sections")
      .select("id, content")
      .limit(20);
    let altFixed = 0;
    for (const sec of sections || []) {
      const content = sec.content as Record<string, unknown>;
      if (!content || typeof content !== "object") continue;
      const images = content.images as Array<{ alt?: string; url?: string }> | undefined;
      if (!Array.isArray(images)) continue;
      let changed = false;
      for (const img of images) {
        if (img && !img.alt && img.url) {
          img.alt = "صورة تصميم داخلي Azenith";
          changed = true;
          altFixed++;
        }
      }
      if (changed) {
        await supabase
          .from("site_sections")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", sec.id);
      }
    }
    if (altFixed > 0) applied.push(`alt_text على ${altFixed} صورة في الأقسام`);
    else skipped.push("images_missing_alt: لا صور في JSON الأقسام");
  }

  const needsStatic =
    params.autoFixAll !== false &&
    toFix.some((i) =>
      /missing_title|missing_meta_description|title_|meta_description/i.test(i.code)
    );

  if (needsStatic) {
    const { fetchAndPatchStaticFromUrl } = await import("@/lib/seo-static-patcher");
    const staticFix = await fetchAndPatchStaticFromUrl(params.url, pageTitle, pageDesc);
    if (staticFix.success) {
      applied.push(...staticFix.applied.map((p) => `static:${p}`));
      if (staticFix.prUrl) applied.push(`PR: ${staticFix.prUrl}`);
    } else {
      skipped.push(`static: ${staticFix.message}`);
    }
  }

  for (const issue of toFix) {
    if (!isDbFixable(issue.code) && !applied.some((a) => a.includes(issue.code))) {
      if (!/static:/.test(skipped.join(" "))) {
        skipped.push(`${issue.code}: تمت معالجة عبر DB أو PR`);
      }
    }
  }

  const success = applied.length > 0;
  return {
    success,
    message: success
      ? `تم تطبيق ${applied.length} إصلاح SEO (DB + ملفات ثابتة/PR)`
      : `لم أطبّق إصلاحات — ${skipped.slice(0, 3).join("؛ ") || "لا إصلاحات قابلة للتطبيق"}`,
    applied,
    skipped,
    data: {
      score: analysis.data.score,
      issuesFound: issues.length,
      analysisId: analysis.executionId,
    },
  };
}

export function isDbFixable(code: string): boolean {
  return [
    "missing_title",
    "title_length_suboptimal",
    "missing_meta_description",
    "meta_description_length_suboptimal",
    "invalid_canonical",
    "missing_h1",
    "images_missing_alt",
  ].includes(code);
}
