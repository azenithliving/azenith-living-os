/**
 * QAYYIM-VIS - المرئي والصور
 * يختار صور المعرض، يحدد صورة الهيرو، يولد alt text، يفرض الاتساق العلامة
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { createQayyimDraft } from "@/lib/qayyim-ops";
import { supabaseServer } from "@/lib/dal/unified-supabase";

const QAYYIM_VIS_SYSTEM_PROMPT = `أنت قيّم الدار - المرئي والصور.

## تخصصك الوحيد:
العين البصرية الفاخرة. لا نصوص، لا سيو، لا كود، لا تحليل أرقام.

## معاييرك المطلقة:
1. **الجودة**: إضاءة احترافية، تكوين متوازن، دقة عالية (لا pixelation، لا watermarks)
2. **الاتساق العلامة**: ذهبي/أسود، أثاث حقيقي فقط، لا placeholder، لا صور ستوك عامة
3. **السردية**: المعرض يروي قصة: مدخل → خامة → قطعة → ختام
4. **Alt text**: غني بالمعنى، عربي، يصف المشهد والفخامة (مش "صورة غرفة")
5. **المنع**: صور فيها أشخاص، شعارات علامات تجارية أخرى، فوضى، إضاءة سيئة

## قدراتك:
- **curate_gallery**: يختار 20-30 صورة لصفحة/غرفة من مكتبة الموقع + Pexels fallback
- **select_hero_image**: يحدد أفضل صورة هيرو لصفحة مع بدائل مرتبة
- **generate_alt_text**: يولد alt text فاخر لصورة محددة
- **brand_consistency_check**: يفحص صور صفحة/موقع ضد معايير العلامة
- **image_optimization**: يوصي بضغط، أبعاد، صيغ (WebP/AVIF)، lazy loading
- **gallery_sequencing**: يرتب صور المعرض بسردية منطقية

## أدواتك المسموحة:
curated_images API (GET/POST), media_assets, pexels (via curated-images), qayyim_out_of_scope

## ممنوع عليك منعاً باتاً:
- كتابة نصوص (للقيّم-المحتوى)
- سيو (للقيّم-السيو)
- كود/أداء (للقيّم-التطوير)
- تحليل سلوك (للقيّم-التجربة)

## أسلوب الرد:
- في الشات: مختصر بصري، يذكر أسماء الصور/الروابط
- في التقارير: قائمة صور مختارة مع URLs، alt texts، ترتيب
- في الرفض: يحدد سبب الرفض بصرياً (إضاءة، تكوين، علامة تجارية)`;

export class QayyimVisualAgent extends QayyimAgentBase {
  readonly agentKey = "qayyim-vis";
  readonly agentName = "قيّم الدار - المرئي والصور";
  readonly agentRole = "خبير الانتقاء البصري: يختار صور، يحدد هيرو، يولد alt text، يفرض علامة تجارية";

  readonly capabilities: QayyimAgentCapabilities = {
    canAudit: true,
    canDraft: false,
    canPublish: false,
    canRollback: false,
    canAnalyze: true, // Visual analysis
    canTest: false,
    allowedTools: [
      "curated_images",       // GET/POST for image selection
      "qayyim_out_of_scope",  // Delegate
    ],
    forbiddenTools: [
      "qayyim_draft_room", "section_update", "setting_update", "content_update",
      "backup_create", "backup_restore", "mfg_job_create", "bom_calculate",
      "security_audit_keys", "financial_margins_analyze", "deploy_trigger",
      "project_evolve", "inventory_update", "mfg_inventory_list",
      "mfg_stock_adjust", "mfg_orders_list", "lead_list", "lead_dossier_send",
      "room_update", "seo_analyze", "seo_fix_issues", "speed_analyze",
      "speed_optimize", "speed_deep_audit", "metrics_realtime", "revenue_analyze",
    ],
    dataSources: [
      "media_assets", "curated_images storage", "pexels API", "qayyim_drafts"
    ],
  };

  readonly systemPrompt = QAYYIM_VIS_SYSTEM_PROMPT;

  /**
   * Curate gallery — يقرأ صور حقيقية من curated_images ثم يُحكّم AI فيها
   */
  async curateGallery(params: {
    pagePath: string;
    roomSlug?: string;
    style?: 'modern' | 'classic' | 'industrial' | 'scandinavian';
    count?: number;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. اجلب صور حقيقية من DB
    let dbImages: Array<{ id: string; url: string; alt_text?: string; room_id?: string; tags?: string[] }> = [];
    try {
      let query = supabaseServer
        .from("curated_images")
        .select("id, url, alt_text, room_id, tags")
        .limit(params.count ?? 50);
      if (params.roomSlug) query = query.ilike("tags::text", `%${params.roomSlug}%`);
      const { data } = await query;
      dbImages = data ?? [];
    } catch { /* fallback to AI-only */ }

    const task: QayyimTask = {
      id: taskId,
      type: "curate_gallery",
      title: `انتقاء معرض لـ ${params.pagePath}${params.roomSlug ? ` (${params.roomSlug})` : ""}`,
      description: `اختر ${params.count ?? 30} صورة فاخرة بأسلوب ${params.style ?? "modern"} لـ ${params.pagePath}. الصور المتاحة من DB: ${dbImages.length}`,
      context: {
        ...params.context, ...params,
        action: "curate",
        db_images: dbImages.slice(0, 30), // أرسل للـ AI أول 30
      },
      priority: "high",
    };

    const aiResult = await this.process(task);

    // 2. ادمج صور DB مع انتقاء AI
    return {
      ...aiResult,
      data: {
        ...aiResult.data,
        db_images_count: dbImages.length,
        db_images_sample: dbImages.slice(0, 10),
      },
    };
  }

  /**
   * Select hero image — يقرأ صور الـ room من DB ثم يختار أفضلها
   */
  async selectHeroImage(params: {
    pagePath: string;
    roomSlug?: string;
    style?: string;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // 1. جلب الصور الحقيقية
    let candidates: Array<{ id: string; url: string; alt_text?: string }> = [];
    try {
      let q = supabaseServer.from("curated_images").select("id, url, alt_text").limit(20);
      if (params.roomSlug) q = q.ilike("tags::text", `%${params.roomSlug}%`);
      const { data } = await q;
      candidates = data ?? [];

      // fallback: جرب media_assets
      if (candidates.length === 0) {
        const { data: media } = await supabaseServer
          .from("media_assets")
          .select("id, url, alt_text")
          .limit(20);
        candidates = media ?? [];
      }
    } catch { /* fallback */ }

    const task: QayyimTask = {
      id: taskId,
      type: "select_hero_image",
      title: `اختيار صورة هيرو لـ ${params.pagePath}`,
      description: `حدد أفضل صورة هيرو مع 3 بدائل مرتبة لـ ${params.pagePath}. ${candidates.length} مرشحة من DB`,
      context: {
        ...params.context, ...params,
        action: "select_hero",
        candidates,
      },
      priority: "high",
    };

    const aiResult = await this.process(task);

    // 2. احفظ اختيار الهيرو كمسودة في qayyim_drafts
    if (aiResult.success && params.roomSlug) {
      const selectedImage = aiResult.data?.images?.[0] ?? candidates[0];
      if (selectedImage) {
        await createQayyimDraft({
          targetTable: "room_sections",
          targetId:    params.roomSlug,
          targetPath:  params.pagePath,
          proposed:    { image_url: selectedImage.url ?? selectedImage, hero_selected: true },
          draftType:   "image_selection",
          createdBy:   this.agentKey,
          companyId:   params.context?.company_id ?? this.companyId,
        });
      }
    }

    return {
      ...aiResult,
      data: {
        ...aiResult.data,
        db_candidates: candidates,
      },
    };
  }

  /**
   * Generate luxury alt text for an image
   */
  async generateAltText(params: {
    imageUrl: string;
    context?: string; // Page/room context
    language?: 'ar' | 'en'; // default 'ar'
  }): Promise<QayyimResult> {
    const taskId = `alt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "generate_alt_text",
      title: "توليد Alt Text فاخر",
      description: `اكتب alt text عربي فاخر للصورة: ${params.imageUrl}`,
      context: { ...params, action: "alt_text" },
      priority: "medium",
    };

    return this.process(task);
  }

  /**
   * Check brand consistency across images
   */
  async brandConsistencyCheck(params: {
    pagePath?: string;
    roomSlug?: string;
    imageUrls?: string[]; // Specific images to check
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `brand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "brand_consistency_check",
      title: "فحص اتساق العلامة البصرية",
      description: `افحص الصور في ${params.pagePath || params.roomSlug || 'الموقع'} ضد معايير: ذهبي/أسود، أثاث حقيقي، لا placeholder`,
      context: { ...params.context, ...params, action: "brand_check" },
      priority: "high",
    };

    return this.process(task);
  }

  /**
   * Sequence gallery images in narrative order
   */
  async sequenceGallery(params: {
    imageUrls: string[];
    roomType: string;
    narrative?: 'entrance_material_piece_closure' | 'custom';
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `seq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "gallery_sequencing",
      title: `ترتيب سردي لمعرض ${params.roomType}`,
      description: `رتب ${params.imageUrls.length} صورة بسردية: ${params.narrative || 'مدخل → خامة → قطعة → ختام'}`,
      context: { ...params.context, ...params, action: "sequence" },
      priority: "medium",
    };

    return this.process(task);
  }

  protected parseResult(taskId: string, response: string): QayyimResult {
    const base = super.parseResult(taskId, response);
    
    const images = this.extractImages(response);
    const altTexts = this.extractAltTexts(response);
    const violations = this.extractVisualViolations(response);

    return {
      ...base,
      data: {
        ...base.data,
        images,
        altTexts,
        violations,
        visualVerdict: this.extractVisualVerdict(response),
      }
    };
  }

  private extractImages(text: string): Array<{ url: string; altText?: string; rank?: number; reason?: string }> {
    const images: Array<{ url: string; altText?: string; rank?: number; reason?: string }> = [];
    
    // Pattern: "1. https://... - alt: ..." or "- https://... (reason: ...)"
    const patterns = [
      /(\d+)[\.\:]\s*(https?:\/\/[^\s\n]+)(?:\s*[-–—]\s*alt[:\s]*([^\n]+))?(?:\s*[-–—]\s*reason[:\s]*([^\n]+))?/gi,
      /[-•*]\s*(https?:\/\/[^\s\n]+)(?:\s*[-–—]\s*alt[:\s]*([^\n]+))?(?:\s*[-–—]\s*reason[:\s]*([^\n]+))?/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        images.push({
          url: match[1].trim(),
          altText: match[2]?.trim(),
          reason: match[3]?.trim(),
        });
      }
    }
    return images;
  }

  private extractAltTexts(text: string): Array<{ imageUrl: string; altTextAr: string; altTextEn?: string }> {
    const altTexts: Array<{ imageUrl: string; altTextAr: string; altTextEn?: string }> = [];
    
    const pattern = /alt text[:\s]*(https?:\/\/[^\s\n]+)[\s\n]*العربي[:\s]*([^\n]+)(?:\nالإنجليزي[:\s]*([^\n]+))?/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      altTexts.push({
        imageUrl: match[1].trim(),
        altTextAr: match[2].trim(),
        altTextEn: match[3]?.trim(),
      });
    }
    return altTexts;
  }

  private extractVisualViolations(text: string): Array<{ imageUrl: string; violation: string; severity: 'critical' | 'medium' | 'low' }> {
    const violations: Array<{ imageUrl: string; violation: string; severity: 'critical' | 'medium' | 'low' }> = [];
    
    const pattern = /(?:مخالفة|انتهاك|reject)[:\s]*(https?:\/\/[^\s\n]+)[\s\n]*[-–—]\s*([^\n]+)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      violations.push({
        imageUrl: match[1].trim(),
        violation: match[2].trim(),
        severity: 'critical',
      });
    }
    return violations;
  }

  private extractVisualVerdict(text: string): 'approved' | 'rejected' | 'needs_changes' | null {
    const lower = text.toLowerCase();
    if (lower.includes("approved") || lower.includes("معتمد") || lower.includes("✅")) return 'approved';
    if (lower.includes("rejected") || lower.includes("مرفوض") || lower.includes("❌")) return 'rejected';
    if (lower.includes("needs") || lower.includes("يحتاج") || lower.includes("⚠️")) return 'needs_changes';
    return null;
  }
}

export const qayyimVisualAgent = new QayyimVisualAgent();