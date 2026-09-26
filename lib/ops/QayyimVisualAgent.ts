/**
 * QAYYIM-VIS - المرئي والصور
 * يختار صور المعرض، يحدد صورة الهيرو، يولد alt text، يفرض الاتساق العلامة
 */

import { QayyimAgentBase, QayyimTask, QayyimResult, QayyimAgentCapabilities } from "./QayyimAgentBase";
import { agentLabel } from "./identity";
import { createQayyimDraft } from "@/lib/qayyim-ops";

const QAYYIM_VIS_SYSTEM_PROMPT = `أنت ${agentLabel("ops-visual")}.

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
curated_images API (GET/POST), media_assets, pexels (via curated-images), ops_out_of_scope

## ممنوع عليك منعاً باتاً:
- كتابة نصوص (لوكيل المحتوى)
- سيو (لوكيل الظهور)
- كود/أداء (لوكيل التطوير)
- تحليل سلوك (لوكيل التجربة)

## أسلوب الرد:
- في الشات: مختصر بصري، يذكر أسماء الصور/الروابط
- في التقارير: قائمة صور مختارة مع URLs، alt texts، ترتيب
- في الرفض: يحدد سبب الرفض بصرياً (إضاءة، تكوين، علامة تجارية)`;

export class QayyimVisualAgent extends QayyimAgentBase {
  readonly agentKey = "ops-visual";
  readonly agentName = agentLabel("ops-visual");
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
      "ops_out_of_scope",  // Delegate
    ],
    forbiddenTools: [
      "ops_draft_room", "section_update", "setting_update", "content_update",
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

  private extractRoomSlugFromPath(pagePath?: string): string | undefined {
    if (!pagePath) return undefined;
    const fragment = pagePath.match(/#([a-z0-9-]+)/i)?.[1];
    if (fragment) return fragment;
    const segment = pagePath.split("?")[0].split("/").filter(Boolean).pop();
    if (segment && /^[a-z0-9-]+$/i.test(segment)) return segment;
    return undefined;
  }

  /**
   * Load real image candidates from the same sources curated-images trusts:
   * Supabase Storage bucket "images" (curated/{room}/{style}), with the
   * verified static fallback library as last resort.
   */
  private async loadCandidateImages(params: {
    pagePath?: string;
    roomSlug?: string;
    style?: string;
  }): Promise<Array<{ url: string; alt: string; source: string }>> {
    const candidates: Array<{ url: string; alt: string; source: string }> = [];
    const seen = new Set<string>();
    const push = (url: string, alt: string, source: string) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      candidates.push({ url, alt, source });
    };

    const roomSlug = params.roomSlug || this.extractRoomSlugFromPath(params.pagePath);

    try {
      const { supabaseServer } = await import("@/lib/dal/unified-supabase");
      const storage = supabaseServer.storage.from("images");

      const startPrefix = roomSlug
        ? params.style
          ? `curated/${roomSlug}/${params.style}`
          : `curated/${roomSlug}`
        : "curated";

      const collect = async (prefix: string, depth: number): Promise<void> => {
        if (candidates.length >= 60 || depth > 3) return;
        const { data: entries } = await storage.list(prefix, { limit: 100 });
        for (const entry of entries || []) {
          if (candidates.length >= 60) break;
          const childPath = `${prefix}/${entry.name}`;
          if (entry.id) {
            await collect(childPath, depth + 1);
          } else if (entry.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            const { data: urlData } = storage.getPublicUrl(childPath);
            push(urlData.publicUrl, `${roomSlug || "page"} ${params.style || ""} curated`.trim(), "storage");
          }
        }
      };

      await collect(startPrefix, 0);
    } catch (e) {
      console.warn("[QAYYIM-VIS] candidate load from storage failed:", e);
    }

    if (candidates.length === 0 && roomSlug) {
      try {
        const { getRoomFallbackImages } = await import("@/lib/room-image-fallback");
        for (const photo of getRoomFallbackImages(roomSlug, params.style || "modern")) {
          push(photo.url, photo.alt || "", "static_fallback");
        }
      } catch (e) {
        console.warn("[QAYYIM-VIS] static fallback load failed:", e);
      }
    }

    return candidates.slice(0, 60);
  }

  /**
   * Post-filter: keep only images/violations whose URL pathname matches a
   * verified candidate. Dropped count lands in data.filteredAsUnverified.
   */
  private filterToVerifiedCandidates(
    result: QayyimResult,
    candidates: Array<{ url: string; alt: string; source: string }>
  ): QayyimResult {
    if (!result.data) return result;

    const verifiedPaths = new Set<string>();
    for (const c of candidates) {
      try {
        verifiedPaths.add(new URL(c.url).pathname);
      } catch {
        // مرشح بمسار غير صالح — يُتجاهل
      }
    }
    const isVerified = (url: unknown): boolean => {
      if (!url) return false;
      try {
        return verifiedPaths.has(new URL(String(url)).pathname);
      } catch {
        return false;
      }
    };

    let dropped = 0;
    if (Array.isArray(result.data.images)) {
      const kept = result.data.images.filter((img: any) => isVerified(img?.url));
      dropped += result.data.images.length - kept.length;
      result.data.images = kept;
    }
    if (Array.isArray(result.data.violations)) {
      const kept = result.data.violations.filter((v: any) => isVerified(v?.imageUrl));
      dropped += result.data.violations.length - kept.length;
      result.data.violations = kept;
    }
    if (dropped > 0) {
      result.data.filteredAsUnverified = dropped;
    }
    return result;
  }

  /**
   * Curate gallery for a page/room
   */
  async curateGallery(params: {
    pagePath: string;
    roomSlug?: string;
    style?: 'modern' | 'classic' | 'industrial' | 'scandinavian';
    count?: number; // default 30
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const candidateImages = await this.loadCandidateImages({
      pagePath: params.pagePath,
      roomSlug: params.roomSlug,
      style: params.style,
    });

    const task: QayyimTask = {
      id: taskId,
      type: "curate_gallery",
      title: `انتقاء معرض لـ ${params.pagePath}${params.roomSlug ? ` (${params.roomSlug})` : ''}`,
      description: `اختر ${params.count || 30} صورة فاخرة بأسلوب ${params.style || 'modern'} لـ ${params.pagePath}`,
      context: { ...params.context, ...params, action: "curate", candidateImages },
      priority: "high",
    };

    const aiResult = await this.process(task);
    this.filterToVerifiedCandidates(aiResult, candidateImages);
    if (aiResult.success && (aiResult.data?.images?.length || aiResult.output)) {
      try {
        const { supabaseServer } = await import('@/lib/dal/unified-supabase');
        let targetId: string | null = null;
        let targetTable = 'room_sections';
        let targetPath = params.pagePath;
        if (params.roomSlug) {
          const { data: room } = await supabaseServer.from('room_sections').select('id').eq('slug', params.roomSlug).maybeSingle();
          if (room) targetId = room.id;
        }
        if (!targetId) {
          const { data: anyRoom } = await supabaseServer.from('room_sections').select('id, slug').limit(1).maybeSingle();
          if (anyRoom) { targetId = anyRoom.id; targetPath = `/#${anyRoom.slug}`; }
        }
        if (targetId) {
          const draftRes = await createQayyimDraft({
            targetTable, targetId, targetPath,
            proposed: { images: aiResult.data?.images ?? [], output: aiResult.output, style: params.style, count: params.count },
            draftType: 'curate_gallery',
            createdBy: this.agentKey,
            companyId: params.context?.company_id ?? this.companyId,
            metadata: { via: 'ops-visual', taskId, evidenceUrls: aiResult.evidenceUrls ?? [] },
          });
          if (draftRes.success && aiResult.data) { aiResult.data.draftId = draftRes.data?.draft_id; aiResult.data.previewUrl = draftRes.data?.preview_url; }
        }
      } catch (e) { console.warn('[QAYYIM-VIS] draft persist failed', e); }
    }
    return aiResult;
  }

  /**
   * Select hero image with ranked alternatives
   */
  async selectHeroImage(params: {
    pagePath: string;
    roomSlug?: string;
    style?: string;
    context?: Record<string, any>;
  }): Promise<QayyimResult> {
    const taskId = `hero_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const task: QayyimTask = {
      id: taskId,
      type: "select_hero_image",
      title: `اختيار صورة هيرو لـ ${params.pagePath}`,
      description: `حدد أفضل صورة هيرو مع 3 بدائل مرتبة لـ ${params.pagePath}`,
      context: { ...params.context, ...params, action: "select_hero" },
      priority: "high",
    };

    return this.process(task);
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

    const candidateImages = await this.loadCandidateImages({
      pagePath: params.pagePath,
      roomSlug: params.roomSlug,
    });

    const task: QayyimTask = {
      id: taskId,
      type: "brand_consistency_check",
      title: "فحص اتساق العلامة البصرية",
      description: `افحص الصور في ${params.pagePath || params.roomSlug || 'الموقع'} ضد معايير: ذهبي/أسود، أثاث حقيقي، لا placeholder`,
      context: { ...params.context, ...params, action: "brand_check", candidateImages },
      priority: "high",
    };

    const result = await this.process(task);
    return this.filterToVerifiedCandidates(result, candidateImages);
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