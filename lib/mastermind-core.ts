/**
 * The Azenith Supreme Sovereign - Core Implementation
 * 
 * "I am the mind that perfects your empire while you breathe."
 * 
 * This file contains the core AzenithMastermind class WITHOUT 'use server'.
 * It can be imported from both server and client components.
 */

import { createClient } from "@supabase/supabase-js";
import { 
  applyCode, 
  getCodebaseOverview, 
  getSystemStatus as getArchitectSystemStatus 
} from "./supreme-architect";
import { 
  loadUserPreferences, 
  processExecutiveResponse 
} from "./executive-persona";
import { 
  startAutonomousMode as startSilentMode, 
  getStatus as getSilentStatus 
} from "./silent-architect";
import { 
  getSystemStats, 
  triggerHealing 
} from "./sovereign-os";
import { 
  startMonitoring as startProactiveMonitoring 
} from "./proactive-autonomy";

// Phase 2: Unlimited Intelligence
import { runMastermind } from "./mastermind-graph";
import { verifyCommandWithPublicKeyBase64 } from "./crypto-keys";
import { crewFactory } from "./crew-factory";
import { plannerAgent } from "./planner-agent";
import type { MastermindState } from "./mastermind-graph";

// ============================================
// TYPES - The Mastermind Intelligence
// ============================================

interface MastermindContext {
  userId?: string;
  sessionId: string;
  intent: string;
  mood: "imperial" | "rushed" | "creative" | "concerned" | "relaxed";
  brandSoul: "luxury" | "comfort" | "power" | "elegance";
  historicalPreferences: string[];
  lastActions: string[];
}

interface TripleAAction {
  id: string;
  phase: "analyze" | "preview" | "execute" | "completed" | "rolled_back";
  analysis: string;
  previewUrl?: string;
  changes: Array<{
    file: string;
    before: string;
    after: string;
  }>;
  executedAt?: Date;
  rolledBackAt?: Date;
  rollbackAvailable: boolean;
}

interface SemanticCache {
  query: string;
  response: string;
  embeddings?: number[];
  timestamp: Date;
  hitCount: number;
}

interface MobileNotification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "urgent";
}

type BrandSoulAlignment = "matte_black" | "subtle_gold_accents" | "natural_textures" | "soft_lighting" | "architectural_lines";

interface BrandSoul {
  essence: "Azenith Living - Where Luxury Meets Comfort";
  colors: string[];
  tone: string;
  forbidden: string[];
  preferred: BrandSoulAlignment[];
}

// ============================================
// THE AZENITH MASTERMIND
// ============================================

export class AzenithMastermind {
  private static instance: AzenithMastermind;
  private supabase: ReturnType<typeof createClient>;
  private semanticCache: Map<string, SemanticCache> = new Map();
  private actionHistory: Map<string, TripleAAction> = new Map();
  private isMonitoring: boolean = false;

  private brandSoul: BrandSoul = {
    essence: "Azenith Living - Where Luxury Meets Comfort",
    colors: ["#1a1a1a", "#2d2d2d", "#C5A059", "#8B7355", "#f5f5f5"],
    tone: "Luxurious, warm, powerful, understated elegance",
    forbidden: ["neon colors", "clipart", "comic sans", "stock photos", "loud patterns"],
    preferred: ["matte_black", "subtle_gold_accents", "natural_textures", "soft_lighting", "architectural_lines"],
  };

  private constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error("Missing Supabase credentials for Mastermind");
    }
    
    this.supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  static getInstance(): AzenithMastermind {
    if (!AzenithMastermind.instance) {
      AzenithMastermind.instance = new AzenithMastermind();
    }
    return AzenithMastermind.instance;
  }

  // ==========================================
  // 1. OMNISCIENT AWARENESS - Root Access
  // ==========================================

  async getFilesystemState(): Promise<{
    totalFiles: number;
    recentChanges: string[];
    criticalFiles: string[];
  }> {
    const overview = await getCodebaseOverview();
    
    const { data: actions } = await this.supabase
      .from("architect_actions")
      .select("target_path, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    return {
      totalFiles: overview.length,
      recentChanges: actions?.map((a) => String(a.target_path)) || [],
      criticalFiles: [
        "app/page.tsx",
        "app/layout.tsx",
        "lib/sovereign-os.ts",
        "components/elite/AestheticAdvisor.tsx",
      ],
    };
  }

  async getDatabaseState(): Promise<{
    totalTables: number;
    recordCounts: Record<string, number>;
    recentActivity: string[];
  }> {
    const tables = [
      "room_sections",
      "requests",
      "intelligence_snapshots",
      "semantic_cache",
      "api_keys_arsenal",
    ];

    const recordCounts: Record<string, number> = {};
    
    for (const table of tables) {
      const { count } = await this.supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      recordCounts[table] = count || 0;
    }

    const { data: recent } = await this.supabase
      .from("system_intelligence")
      .select("metric_type, observed_at")
      .order("observed_at", { ascending: false })
      .limit(5);

    return {
      totalTables: tables.length,
      recordCounts,
      recentActivity: recent?.map((r) => `${String(r.metric_type)} at ${String(r.observed_at)}`) || [],
    };
  }

  // ==========================================
  // 2. LIVING ARSENAL - Neural Key Management
  // ==========================================

  async optimizeKeyDistribution(task: string): Promise<{
    selectedProvider: string;
    estimatedCost: number;
    estimatedTime: number;
    keysAvailable: number;
  }> {
    const isComplex = task.match(/(generate|create|design|write.*content)/i);
    const isUrgent = task.match(/(now|urgent|asap|immediate)/i);
    
    const stats = await getSystemStats();
    
    let selectedProvider = "groq";
    let estimatedCost = 0.01;
    let estimatedTime = 3000;
    
    if (isComplex && !isUrgent) {
      if (stats.providers.openrouter.active > 0) {
        selectedProvider = "openrouter";
        estimatedCost = 0.03;
        estimatedTime = 8000;
      }
    } else if (isUrgent) {
      selectedProvider = "groq";
      estimatedCost = 0.005;
      estimatedTime = 3000;
    }
    
    return {
      selectedProvider,
      estimatedCost,
      estimatedTime,
      keysAvailable: stats.providers[selectedProvider as keyof typeof stats.providers]?.active || 0,
    };
  }

  // ==========================================
  // 2b. SMART PROVIDER SELECTION
  // ==========================================

  async selectBestProvider(taskType: "translation" | "code" | "vision" | "creative"): Promise<{
    provider: "groq" | "mistral" | "openrouter";
    model: string;
    reason: string;
  }> {
    const stats = await getSystemStats();

    switch (taskType) {
      case "translation":
        // Translation: Prefer Groq (Llama) then Mistral
        if (stats.providers.groq.active > 0) {
          return {
            provider: "groq",
            model: "llama-3.3-70b-versatile",
            reason: "Fast and accurate for translation tasks",
          };
        }
        if (stats.providers.mistral.active > 0) {
          return {
            provider: "mistral",
            model: "mistral-large-latest",
            reason: "Strong multilingual capabilities",
          };
        }
        break;

      case "code":
        // Code: Prefer Mistral (Codestral) then Groq
        if (stats.providers.mistral.active > 0) {
          return {
            provider: "mistral",
            model: "codestral-latest",
            reason: "Optimized for code generation",
          };
        }
        if (stats.providers.groq.active > 0) {
          return {
            provider: "groq",
            model: "llama-3.3-70b-versatile",
            reason: "Fast code completion",
          };
        }
        break;

      case "vision":
        // Vision: Only OpenRouter (Claude)
        if (stats.providers.openrouter.active > 0) {
          return {
            provider: "openrouter",
            model: "anthropic/claude-3.5-sonnet",
            reason: "Best vision analysis capabilities",
          };
        }
        return {
          provider: "groq",
          model: "llama-3.2-90b-vision-preview",
          reason: "Fallback vision model (limited)",
        };

      case "creative":
        // Creative: Prefer OpenRouter then Mistral
        if (stats.providers.openrouter.active > 0) {
          return {
            provider: "openrouter",
            model: "anthropic/claude-3.5-sonnet",
            reason: "Superior creative writing",
          };
        }
        if (stats.providers.mistral.active > 0) {
          return {
            provider: "mistral",
            model: "mistral-large-latest",
            reason: "Strong creative capabilities",
          };
        }
        break;
    }

    // Default fallback
    return {
      provider: "groq",
      model: "llama-3.3-70b-versatile",
      reason: "Default fallback provider",
    };
  }

  // ==========================================
  // 3. HUMAN-IMPERIAL PERSONA - Brand Soul
  // ==========================================

  async understandIntent(message: string, userId?: string): Promise<{
    intent: string;
    brandSoul: BrandSoulAlignment;
    shouldAct: boolean;
    confidence: number;
  }> {
    const lower = message.toLowerCase();
    let soulAlignment: BrandSoulAlignment = "matte_black";
    
    if (lower.match(/(صور|image|photo|صورة)/)) {
      if (lower.match(/(مش عاجب|bad|poor|weak|ممل)/)) {
        soulAlignment = "matte_black";
        return {
          intent: "improve_images_to_industrial",
          brandSoul: soulAlignment,
          shouldAct: true,
          confidence: 0.95,
        };
      }
    }
    
    if (lower.match(/(فخامة|luxury|فاخر|premium)/)) {
      soulAlignment = "subtle_gold_accents";
    }
    
    if (lower.match(/(طبيعي|natural|organic|warm)/)) {
      soulAlignment = "natural_textures";
    }
    
    if (userId) {
      const prefs = await loadUserPreferences(userId);
      if (prefs.knownPreferences.includes("prefers_matte_black")) {
        soulAlignment = "matte_black";
      }
    }
    
    return {
      intent: "general",
      brandSoul: soulAlignment,
      shouldAct: false,
      confidence: 0.7,
    };
  }

  private enforceBrandSoul(content: string): string {
    for (const forbidden of this.brandSoul.forbidden) {
      if (content.toLowerCase().includes(forbidden)) {
        return `⚠️ لاحظت أن هذا الاقتراح يحتوي على "${forbidden}". هذا لا يتوافق مع روح Azenith (الفخامة الهادئة والقوة الصامتة). هل تريد تعديله؟\n\nالاقتراح الأصلي: ${content}`;
      }
    }
    return content;
  }

  async analyzeAndPropose(
    userMessage: string,
    sessionId: string,
    userId?: string
  ): Promise<TripleAAction> {
    const analysis = await this.performDeepAnalysis(userMessage, userId);
    
    const action: TripleAAction = {
      id: `aaa_${Date.now()}`,
      phase: "analyze",
      analysis,
      changes: [],
      rollbackAvailable: true,
    };
    
    this.actionHistory.set(action.id, action);
    
    const understanding = await this.understandIntent(userMessage, userId);
    
    if (understanding.confidence > 0.8) {
      action.phase = "preview";
      action.changes = await this.generateProposedChanges(userMessage, understanding);
      action.previewUrl = await this.createStagingPreview(action);
    }
    
    return action;
  }

  private async performDeepAnalysis(message: string, userId?: string): Promise<string> {
    const [intent, systemStatus] = await Promise.all([
      this.understandIntent(message, userId),
      getSystemStats(),
    ]);
    
    let analysis = `**تحليلي العميق:**\n\n`;
    analysis += `• **نية المستخدم:** ${intent.intent} (ثقة: ${(intent.confidence * 100).toFixed(0)}%)\n`;
    analysis += `• **روح البراند:** ${intent.brandSoul}\n`;
    analysis += `• **حالة النظام:** كفاءة ${systemStatus.cacheEfficiency.hitRate}%\n`;
    
    return analysis;
  }

  private async generateProposedChanges(
    message: string,
    understanding: { intent: string; brandSoul: BrandSoulAlignment; shouldAct: boolean; confidence: number }
  ): Promise<TripleAAction["changes"]> {
    const changes: TripleAAction["changes"] = [];
    
    if (understanding.intent === "improve_images_to_industrial") {
      changes.push({
        file: "components/room/RoomGallery.tsx",
        before: "// Current: Standard room display",
        after: `// Proposed: Industrial matte black aesthetic
// - Desaturated tones
// - Strong shadows
// - Minimal warm accents`,
      });
    }
    
    return changes;
  }

  private async createStagingPreview(action: TripleAAction): Promise<string> {
    return `/admin/preview/${action.id}`;
  }

  async atomicRollback(actionId: string): Promise<{
    success: boolean;
    restored: boolean;
    message: string;
  }> {
    const action = this.actionHistory.get(actionId);
    if (!action || !action.rollbackAvailable) {
      return {
        success: false,
        restored: false,
        message: "لا يوجد إجراء للتراجع عنه",
      };
    }
    
    try {
      const { data: originals } = await this.supabase
        .from("system_snapshots")
        .select("*")
        .eq("action_id", actionId)
        .eq("snapshot_type", "pre_execution");
      
      interface SnapshotRow {
        file_path: string;
        original_content: string;
      }
      
      const typedOriginals = originals as unknown as SnapshotRow[];
      
      if (typedOriginals && typedOriginals.length > 0) {
        for (const snapshot of typedOriginals) {
          await applyCode(snapshot.file_path, snapshot.original_content);
        }
        
        return {
          success: true,
          restored: true,
          message: "✨ تمت العودة عبر الزمن بنجاح. كل شيء كما كان.",
        };
      }
      
      return {
        success: false,
        restored: false,
        message: "لم يتم العثور على نسخة احتياطية",
      };
    } catch (error) {
      return {
        success: false,
        restored: false,
        message: `فشل التراجع: ${error}`,
      };
    }
  }

  private async createSystemSnapshot(type: string, actionId: string): Promise<void> {
    await this.supabase.from("system_snapshots").insert({
      action_id: actionId,
      snapshot_type: type,
      created_at: new Date().toISOString(),
    });
  }

  private async storeForRollback(actionId: string, filePath: string, content: string): Promise<void> {
    await this.supabase.from("system_snapshots").insert({
      action_id: actionId,
      file_path: filePath,
      original_content: content,
      snapshot_type: "pre_execution",
    });
  }

  // ==========================================
  // 5. ULTRA-EFFICIENCY - Semantic Redis Caching
  // ==========================================

  async getWithSemanticCache(query: string): Promise<string> {
    const cached = this.semanticCache.get(query);
    if (cached && Date.now() - cached.timestamp.getTime() < 24 * 60 * 60 * 1000) {
      cached.hitCount++;
      return cached.response;
    }
    
    const { data } = await this.supabase
      .from("semantic_cache")
      .select("*")
      .eq("content_hash", await this.computeQueryHash(query))
      .maybeSingle();
    
    if (data) {
      await this.supabase.rpc("record_cache_hit", {
        p_content_hash: data.content_hash,
      });
      
      this.semanticCache.set(query, {
        query,
        response: String(data.cached_result),
        timestamp: new Date(String(data.created_at)),
        hitCount: Number(data.hit_count || 0) + 1,
      });
      
      return String(data.cached_result);
    }
    
    return "[Would generate fresh response - not in cache]";
  }

  async saveToSemanticCache(query: string, response: string): Promise<void> {
    const hash = await this.computeQueryHash(query);
    
    await this.supabase.from("semantic_cache").upsert({
      content_hash: hash,
      content_type: "ai_response",
      source_content: query,
      cached_result: response,
      hit_count: 1,
    }, { onConflict: "content_hash" });
    
    this.semanticCache.set(query, {
      query,
      response,
      timestamp: new Date(),
      hitCount: 1,
    });
  }

  private async computeQueryHash(query: string): Promise<string> {
    const data = query.toLowerCase().trim();
    const encoder = new TextEncoder();
    const encoded = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  }

  // ==========================================
  // 6. 24/7 MONITORING & MOBILE NOTIFICATIONS
  // ==========================================

  async startSovereignMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log("[AzenithMastermind] Sovereign monitoring activated");
    
    await Promise.all([
      startSilentMode(),
      startProactiveMonitoring(),
    ]);
    
    await this.sendMobileNotification({
      title: "العقل المدبر بدأ العمل",
      body: "سيد أزينث، المدبر يعمل الآن. سأخبرك بأي شيء يستحق اهتمامك.",
      priority: "normal",
    });
  }

  async sendMobileNotification(notification: MobileNotification): Promise<void> {
    await this.supabase.from("architect_notifications").insert({
      user_id: null,
      channels: ["push", "dashboard"],
      title: notification.title,
      message: notification.body,
      priority: notification.priority,
      notification_type: "mastermind_alert",
      data: notification.data,
    });
    
    console.log(`[Mobile Push] ${notification.title}: ${notification.body}`);
  }

  async checkForProactiveOpportunities(): Promise<{
    found: boolean;
    opportunities: Array<{
      title: string;
      description: string;
      impact: string;
      autoPreview?: string;
    }>;
  }> {
    const opportunities: Array<{
      title: string;
      description: string;
      impact: string;
      autoPreview?: string;
    }> = [];
    
    const { data: seoGaps } = await this.supabase
      .from("room_sections")
      .select("id, slug")
      .is("seo_metadata", null)
      .limit(5);
    
    if (seoGaps && seoGaps.length > 0) {
      opportunities.push({
        title: `تحسين SEO لـ ${seoGaps.length} غرف`,
        description: "اكتشفت أن بعض الغرف تفتقر لبيانات SEO. يمكنني تحسينها لزيادة الظهور في Google بنسبة 40%.",
        impact: "+40% search visibility",
      });
    }
    
    const stats = await getSilentStatus();
    if (stats.predictions.length > 0) {
      const topPrediction = stats.predictions[0];
      opportunities.push({
        title: topPrediction.need,
        description: topPrediction.suggestedPreparation,
        impact: `احتمالية ${(topPrediction.probability * 100).toFixed(0)}%`,
      });
    }
    
    return {
      found: opportunities.length > 0,
      opportunities,
    };
  }

  // ==========================================
  // MAIN INTERFACE - The Sovereign Response
  // ==========================================

  async processImperialCommand(
    command: string,
    sessionId: string,
    userId?: string
  ): Promise<{
    response: string;
    action?: TripleAAction;
    notifications?: MobileNotification[];
    suggestions: string[];
  }> {
    const understanding = await this.understandIntent(command, userId);
    
    const cached = await this.getWithSemanticCache(command);
    if (!cached.includes("[Would generate")) {
      return {
        response: cached,
        suggestions: ["أريد المزيد", "طبق هذا", "عدل شيئاً"],
      };
    }
    
    const action = await this.analyzeAndPropose(command, sessionId, userId);
    
    let response = `سيد أزينث، ${action.analysis}\n\n`;
    
    if (action.phase === "preview") {
      response += `لدي مقترح جاهز. ${action.changes.length} تعديلات ستحسن الموقع بنسبة ${understanding.confidence > 0.9 ? "كبيرة" : "ملحوظة"}.\n\n`;
      response += `**هل تريد:**\n1. رؤية المعاينة؟ (${action.previewUrl})\n2. التنفيذ مباشرة؟\n3. تعديل شيء أولاً؟`;
    }
    
    response = this.enforceBrandSoul(response);
    
    response = await processExecutiveResponse(response, {
      userId,
      sessionId,
      message: command,
      isTechnical: action.phase === "execute",
      needsReassurance: action.phase === "execute",
    });
    
    await this.saveToSemanticCache(command, response);
    
    return {
      response,
      action: action.phase !== "analyze" ? action : undefined,
      suggestions: [
        "أريد رؤية المعاينة",
        "نفذ التعديلات",
        "أريد تعديل شيء",
        "أخبرني بالتفاصيل التقنية",
      ],
    };
  }

  // ==========================================
  // STATUS & DASHBOARD
  // ==========================================

  async getMastermindStatus(): Promise<{
    awareness: {
      filesystem: Awaited<ReturnType<AzenithMastermind["getFilesystemState"]>>;
      database: Awaited<ReturnType<AzenithMastermind["getDatabaseState"]>>;
    };
    arsenal: {
      keysActive: number;
      efficiency: number;
      costSavings: number;
    };
    tripleA: {
      pendingActions: number;
      executedToday: number;
      rollbacksAvailable: number;
    };
    soul: {
      brandAlignment: number;
      recentViolations: number;
    };
  }> {
    const fsState = await this.getFilesystemState();
    const dbState = await this.getDatabaseState();
    const sysStats = await getSystemStats();
    
    return {
      awareness: {
        filesystem: fsState,
        database: dbState,
      },
      arsenal: {
        keysActive: sysStats.providers.groq.active + sysStats.providers.openrouter.active + sysStats.providers.mistral.active,
        efficiency: sysStats.cacheEfficiency.hitRate,
        costSavings: sysStats.cacheEfficiency.estimatedSaved,
      },
      tripleA: {
        pendingActions: this.actionHistory.size,
        executedToday: 0,
        rollbacksAvailable: Array.from(this.actionHistory.values()).filter((a) => a.rollbackAvailable).length,
      },
      soul: {
        brandAlignment: 0.95,
        recentViolations: 0,
      },
    };
  }

  /**
   * Phase 2 & 3: Process Command with Digital Signature Verification
   * Integrates with Mastermind Graph, Crew system, and Command Executor
   */
  async processCommand(
    command: string,
    userSignature: string,
    userPublicKey: string,
    userId: string,
    userEmail?: string
  ): Promise<{ success: boolean; result?: MastermindState | unknown; error?: string; message?: string }> {
    try {
      // Determine if this is an owner bypass request
      const isOwnerBypass = userPublicKey === "owner-bypass" && userSignature === "owner-bypass";
      
      // Step 1: Verify digital signature (required for normal users)
      // Owner can bypass signature with "owner-bypass" (2FA is still required in route.ts)
      if (!isOwnerBypass) {
        // Normal users must have valid signature and public key
        if (!userPublicKey || userPublicKey === "bypass-key" || !userSignature) {
          return {
            success: false,
            error: "Digital signature required. Please set up your signing keys.",
          };
        }
        
        const isValidSignature = await verifyCommandWithPublicKeyBase64(
          userPublicKey,
          command,
          userSignature
        );

        if (!isValidSignature) {
          return {
            success: false,
            error: "Invalid command signature. Access denied.",
          };
        }
      }

      // Step 2: Check if it's a Phase 3 admin command
      const adminCommands = [
        "add_key", "remove_key", "list_keys", "rate_limit",
        "send_notification", "show_stats", "clear_cache",
        "restart_service", "backup_db", "help"
      ];
      const cmdPrefix = command.trim().split(/\s+/)[0].toLowerCase();
      
      if (adminCommands.includes(cmdPrefix)) {
        // Phase 3: Execute admin command via command-executor
        const { executeCommand } = await import("./command-executor");
        const { createClient } = await import("@supabase/supabase-js");

        // Use service_role key for owner bypass, anon key for normal users
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
        const supabaseKey = isOwnerBypass
          ? (process.env.SUPABASE_SERVICE_ROLE_KEY || "")
          : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

        const supabase = createClient(supabaseUrl, supabaseKey);

        const result = await executeCommand(command, {
          supabase,
          userId,
          userEmail: userEmail || "admin@azenithliving.com",
          bypassRls: isOwnerBypass,
        });
        
        return {
          success: result.success,
          message: result.message,
          result: result.data,
          error: result.success ? undefined : result.message,
        };
      }

      // Step 3: Create strategic plan (Phase 2 logic)
      const planResult = await plannerAgent.createPlan({
        command,
        context: { userId },
      });

      if (!planResult.success || !planResult.plan) {
        return {
          success: false,
          error: planResult.error || "Failed to create execution plan",
        };
      }

      // Step 4: Execute via Mastermind Graph
      const state = await runMastermind(command, userId, {
        plan: planResult.plan,
        signature: userSignature,
      });

      return {
        success: state.errors.length === 0,
        result: state,
        error: state.errors.length > 0 ? state.errors.join("\n") : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Command processing failed",
      };
    }
  }

  /**
   * Quick command for simple tasks (uses Crew directly)
   */
  async quickCommand(
    command: string,
    agentTypes: ("coder" | "security" | "analyst" | "ops")[]
  ): Promise<unknown> {
    const crew = crewFactory.createTaskForce(agentTypes, command);
    const tasks = agentTypes.map((type, i) => ({
      id: `quick-${i}`,
      agentType: type,
      description: command,
    }));

    const results = await crew.execute(tasks);
    return results;
  }
}

// Export the instance
export const azenithMastermind = AzenithMastermind.getInstance();
