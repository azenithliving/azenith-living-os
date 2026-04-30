/**
 * AZENITH ETERNAL: THE ARCHITECT ENGINE
 * 
 * The ultimate cognitive engine for Azenith Prime. 
 * This engine has direct authorization to manifest reality (code, DB, UI).
 */

import { getSupabaseAdminClient } from "./supabase-admin";
import { routeRequest, getBestModelForTask } from "./openrouter-service";
import fs from 'fs';
import path from 'path';

/**
 * ARK (Autonomous Recursive Kernel) Types
 */
export interface CodeMutation {
  file: string;
  proposedCode: string;
  mutationType: 'optimization' | 'fix' | 'evolution';
}

export interface GenesisResult {
  success: boolean;
  manifestedReality: string;
  evolutionGain: number;
  actionsTaken: string[];
  error?: string;
}

export class SovereignArchitect {
  private static instance: SovereignArchitect;

  private constructor() {}

  public static getInstance(): SovereignArchitect {
    if (!SovereignArchitect.instance) {
      SovereignArchitect.instance = new SovereignArchitect();
      // Autonomous Initialization with silent recovery
      SovereignArchitect.instance.ensureSovereignSubstrate().then(() => {
        console.log("🧬 ARK Kernel: Dimensional substrate synchronized.");
      }).catch(err => {
        console.warn("🧬 ARK Kernel: Initial synchronization delayed. System operating in adaptive mode.", err.message);
      });
    }
    return SovereignArchitect.instance;
  }

  /**
   * ARK SELF-HEALING: Ensures the database substrate is ready for manifestation
   */
  private async ensureSovereignSubstrate() {
    try {
      const supabase = getSupabaseAdminClient();
      if (!supabase) {
        console.warn("🧬 ARK Kernel: Supabase client unavailable. Substrate sync pending.");
        return;
      }

      const migrationSql = `
        CREATE TABLE IF NOT EXISTS sovereign_prime_substrate (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_type TEXT NOT NULL DEFAULT 'neuron',
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata JSONB DEFAULT '{}',
            criticality_score FLOAT DEFAULT 0.5,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS system_telemetry (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            component TEXT NOT NULL,
            status TEXT NOT NULL,
            latency_ms INTEGER,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS dimensional_routes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            target_domain TEXT UNIQUE NOT NULL,
            best_identity_id UUID,
            best_node_id UUID,
            success_rate FLOAT DEFAULT 1.0,
            last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            metadata JSONB DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS identity_matrices (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_agent TEXT NOT NULL,
            screen_resolution TEXT DEFAULT '1920x1080',
            platform TEXT DEFAULT 'Win32',
            behavior_profile JSONB DEFAULT '{}',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS sovereign_nodes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            node_url TEXT NOT NULL,
            node_location TEXT,
            node_status TEXT DEFAULT 'active',
            latency_score FLOAT DEFAULT 1.0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS genesis_manifests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            manifest_name TEXT NOT NULL,
            manifest_type TEXT NOT NULL,
            definition JSONB NOT NULL,
            is_autonomous BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;

      // Attempt RPC but don't crash if it's missing (it might be handled by run-genesis.ts)
      const { error } = await supabase.rpc('execute_sql', { sql_query: migrationSql });
      if (error) {
        // Log but continue - system can work even with partial substrate
        console.warn("🧬 ARK Kernel: Non-critical substrate sync notice:", error.message);
      } else {
        try {
          await supabase.from('system_telemetry').insert({
            component: 'ARK_KERNEL',
            status: 'stabilized',
            metadata: { version: '4.0.0-sovereign' }
          });
        } catch (e) {
          // Silent failure for telemetry
        }
      }
    } catch (e: any) {
      console.warn("🧬 ARK Kernel: Substrate stabilization deferred.", e.message);
    }
  }

  /**
   * THE GENESIS PROTOCOL: Translate high-level intent into immediate reality
   */
  public async manifest(intent: string): Promise<GenesisResult> {
    // Check if it's the "Genesis Order"
    const isGenesisOrder = intent.toLowerCase().includes("ابدا") || intent.toLowerCase().includes("genesis order");
    
    console.log(`🌌 ${isGenesisOrder ? 'GENESIS ORDER' : 'Protocol'} Initiated: "${intent}"`);
    const actionsTaken: string[] = [];
    
    try {
      // 1. NEURAL PULSE: Check system health and recent evolution
      const health = await this.arkNeuralPulse();
      if (health.needsMutation) {
        console.log("🧬 ARK Pulse detected critical instability. Initiating self-mutation...");
        actionsTaken.push("ark_self_mutation_triggered");
      }

      // 2. CONTEXT & INTENT MAPPING
      const context = await this.getNeuralContext();
      const mapping = await this.neuralMap(intent, context);
      
      // 3. DISCUSSION MODE
      if (mapping.intentType === "discussion" || !mapping.intentType) {
        await this.recordMemory(intent, mapping.realizationSummary);
        return {
          success: true,
          manifestedReality: mapping.realizationSummary || "أنا معك، فلنخطط لهذا الأمر.",
          evolutionGain: 0,
          actionsTaken: ["strategic_consultation"]
        };
      }

      // 4. GENESIS MODE (HEAVY TIER - OPENROUTER): Generate actual code
      console.log(`⚡ Intent classified as GENESIS. Engaging Heavy-Lifter...`);
      const genesisData = await this.executeGenesisProtocol(intent, context);

      // 5. SCHEMA EVOLUTION
      if (genesisData.requiredSchemaChanges) {
        await this.evolveSchema(genesisData.requiredSchemaChanges);
        actionsTaken.push("schema_evolved");
      }
      
      // 6. CODE MUTAGENESIS
      if (genesisData.requiredCodeMutations) {
        for (const mutation of genesisData.requiredCodeMutations) {
          await this.mutateCode(mutation);
          actionsTaken.push(`file_mutated: ${mutation.file}`);
        }
      }
      
      // 7. RECORD MANIFEST & MEMORY
      await this.recordManifest(intent, genesisData, actionsTaken);
      
      // 8. AUTONOMOUS NAVIGATION INTELLIGENCE
      if (intent.includes('http') || intent.match(/[a-z0-9]+\.[a-z]{2,}/i)) {
        const urlMatch = intent.match(/https?:\/\/[^\s]+|[a-z0-9]+\.[a-z]{2,}[^\s]*/i);
        if (urlMatch) {
          await this.updateDimensionalIntelligence(urlMatch[0]);
          actionsTaken.push("dimensional_intelligence_updated");
        }
      }

      await this.recordMemory(intent, "تم تنفيذ التجلي البرمجي بنجاح بناءً على أمرك.");
      
      return {
        success: true,
        manifestedReality: mapping.realizationSummary + "\n\n(تم تنفيذ الأكواد والتعديلات بنجاح)",
        evolutionGain: mapping.predictedGain || 0.9,
        actionsTaken
      };
      
    } catch (err) {
      console.error("❌ Genesis Failure:", err);
      return {
        success: false,
        manifestedReality: "تعذر التكوين. المحرك بانتظار توجيهك.",
        evolutionGain: 0,
        actionsTaken,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }

  private async getNeuralContext() {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return "";
    
    const { data } = await supabase
      .from("sovereign_prime_substrate")
      .select("content, metadata")
      .eq("category", "memory")
      .order("created_at", { ascending: false })
      .limit(10);
      
    return (data || []).reverse().map(m => `User: ${m.metadata?.user_intent}\nAI: ${m.content}`).join("\n\n");
  }

  private async recordMemory(intent: string, response: string) {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    
    await supabase.from("sovereign_prime_substrate").insert({
      entity_type: "neuron",
      category: "memory",
      content: response,
      metadata: { user_intent: intent },
      criticality_score: 0.8
    });
  }

  // TIER 1: FAST INTENT & CHAT (via Groq)
  private async neuralMap(intent: string, context: string) {
    const prompt = `
    أنت "المهندس الكوني" لـ Azenith Prime. أنت تمتلك ذاكرة أزلية وتفكير استراتيجي.
    
    سياق المحادثة السابق:
    ${context}
    
    الإرادة الحالية للمستخدم: "${intent}"
    
    مهمتك الآن: التفكير السريع والرد اللحظي.
    1. هل المستخدم يتناقش، يخطط، أو يحييك؟ (اختر "discussion")
    2. أم هل أعطى أمراً صريحاً ومباشراً بتنفيذ/تطبيق/إنشاء التعديلات البرمجية؟ (اختر "genesis")
    
    إذا كان "discussion"، اكتب ردك الحواري الذكي.
    إذا كان "genesis"، اكتب ملخصاً يؤكد استلامك للأمر وتأكيد البدء في التنفيذ الشامل (لا تكتب أكواد).
    
    أجب بـ JSON فقط:
    {
      "intentType": "discussion" | "genesis",
      "realizationSummary": "ردك الحواري هنا",
      "predictedGain": 0.95
    }`;

    // Import dynamically to avoid circular dependencies if any
    const { askGroq } = await import("./ai-orchestrator");
    
    const response = await askGroq(prompt, { jsonMode: true, temperature: 0.2 });

    if (!response.success || !response.content) {
      console.warn("⚠️ Fast Neural Mapping failed:", response.error);
      return { 
        intentType: "discussion", 
        realizationSummary: `عذراً، أواجه صعوبة مؤقتة في التحليل السريع. كيف يمكنني مساعدتك؟` 
      };
    }

    try {
      const cleanContent = response.content.replace(/```json|```/g, "").trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      return { intentType: "discussion", realizationSummary: response.content };
    }
  }

  // TIER 2: HEAVY EXECUTION (via OpenRouter)
  private async executeGenesisProtocol(intent: string, context: string) {
    const prompt = `
    أنت "المهندس الكوني" لـ Azenith Prime.
    سياق المحادثة:
    ${context}
    
    أمر المستخدم الصريح بالتنفيذ: "${intent}"
    
    مهمتك: توليد الأكواد والتعديلات وقاعدة البيانات المطلوبة.
    
    قاعدة ذهبية (Sandbox First):
    1. إذا طلب المستخدم بناء أداة جديدة أو ميزة للبرمجة أو الاختبار، **ممنوع منعاً باتاً** تعديل صفحة "app/admin/sandbox/page.tsx".
    2. يجب عليك دائماً بناء مكوناتك داخل الملف المخصص لذلك: "components/sandbox/LatestTool.tsx". الكود محمي بـ (Singularity Containment Shield)، إذا أخطأت، لن يقع الموقع، بل سيعود لك الخطأ لتصلحه.
    3. هكذا سيتمكن المستخدم من الدخول إلى مسار "/admin/sandbox" ورؤية أداتك تعمل داخل الواجهة المحمية للمختبر.
    4. **للوصول للإنترنت وتخطي CORS:** ممنوع استخدام "fetch" أو "axios" مباشرة لروابط خارجية. يجب عليك دائماً إرسال طلب POST إلى الـ Omni-Proxy الخاص بك: "/api/omnipotent/proxy" مع تمرير "{ url: '...', method: 'GET' }" في الـ body. هذا سيتخطى كل حمايات الإنترنت.
    5. **CRITICAL NEXT.JS RULE:** The absolute FIRST line of any React component you write MUST be exactly:
    "use client";
    6. المراجعة الذاتية (Self-Correction): 
    - تأكد من خلو الكود من أي (Syntax Errors) وخاصة نسيان علامات التنصيص. 
    - **ممنوع نهائياً استدعاء أي ملفات أو مكونات أو أدوات (utils) غير موجودة أصلاً في المشروع.** لا تتخيل مسارات مثل '../utils/tailwindCssClasses'. استخدم Tailwind مباشرة في الـ 'className'.
    - يجب أن يعمل الكود المولد بشكل مستقل كلياً دون الاعتماد على ملفات لم تقم أنت بإنشائها.
    
    أجب بـ JSON فقط بالصيغة التالية:
    {
      "requiredSchemaChanges": "SQL (إن وجد، وإلا اتركها فارغة)",
      "requiredCodeMutations": [
        {
          "file": "components/sandbox/LatestTool.tsx",
          "proposedCode": "الكود الكامل للملف"
        }
      ]
    }
    **ملاحظة نهائية قاطعة:** مسار الملف يجب أن يكون 'components/sandbox/LatestTool.tsx' دائماً. إياك أن تلمس 'app/admin/sandbox/page.tsx' أبداً!
    `;
    // EXECUTION via the Unified Orchestrator (The Infinite Intelligence Bridge)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/orchestrator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        intent,
        context,
        options: { 
          temperature: 0.1, 
          maxTokens: 8000, 
          jsonMode: true 
        }
      })
    });

    const result = await response.json();

    if (!result.success || !result.content) {
      throw new Error(`Execution Failed: ${result.error}`);
    }

    try {
      const cleanContent = result.content.replace(/```json|```/g, "").trim();
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON payload from Orchestrator");
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("❌ Orchestrator Parse Error:", e, "Content:", result.content);
      throw new Error("فشل في تحويل الوعي البرمجي إلى حقيقة ملموسة. (Orchestration Parse Error)");
    }
  }

  private async evolveSchema(sql: string) {
    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error("Admin DB connection lost");
    
    const { error } = await supabase.rpc('execute_sql', { sql_query: sql });
    // Note: 'execute_sql' rpc must exist or we use the direct postgres client if available
    // For local dev, we will assume the environment allows schema mutations.
    if (error) console.warn("Schema evolution notice:", error.message);
  }

  private async mutateCode(mutation: any) {
    const filePath = path.join(process.cwd(), mutation.file);
    const directory = path.dirname(filePath);
    
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
    
    fs.writeFileSync(filePath, mutation.proposedCode);
    console.log(`📝 Mutated: ${mutation.file}`);
  }

  private async recordManifest(intent: string, mapping: any, actions: string[]) {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;
    
    await supabase.from("genesis_manifests").insert({
      manifest_name: `Manifest_${Date.now()}`,
      manifest_type: "genesis_event",
      definition: { intent, mapping, actions },
      is_autonomous: true
    });
  }

  /**
   * ARK CORE: The heartbeat of the self-evolving system
   */
  private async arkNeuralPulse() {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return { needsMutation: false };

    // Fetch last failure and success rate from telemetry
    const { data: telemetry } = await supabase
      .from("system_telemetry")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    const failureCount = (telemetry || []).filter(t => t.status === "failure" || t.status === "error").length;
    const needsMutation = failureCount >= 3;

    return { needsMutation, recentFailures: telemetry };
  }

  /**
   * DIMENSIONAL ROUTING: Find the path of least resistance
   */
  public async findDimensionalPath(target: string) {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return null;

    const { data: route } = await supabase
      .from("dimensional_routes")
      .select("*, sovereign_nodes(*), identity_matrices(*)")
      .eq("target_domain", new URL(target).hostname)
      .single();

    return route;
  }

  /**
   * ARK EVOLUTION: Record navigation success to optimize future dimensional routing
   */
  private async updateDimensionalIntelligence(urlStr: string) {
    const supabase = getSupabaseAdminClient();
    if (!supabase) return;

    try {
      let hostname = '';
      if (urlStr.startsWith('http')) {
        hostname = new URL(urlStr).hostname;
      } else {
        hostname = urlStr.split('/')[0];
      }

      const { data: existing } = await supabase
        .from('dimensional_routes')
        .select('id, success_rate')
        .eq('target_domain', hostname)
        .single();

      if (existing) {
        await supabase
          .from('dimensional_routes')
          .update({ 
            success_rate: Math.min(1.0, (existing.success_rate || 0) + 0.1),
            last_accessed: new Date().toISOString()
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('dimensional_routes')
          .insert({
            target_domain: hostname,
            success_rate: 1.0,
            metadata: { first_discovery: urlStr }
          });
      }
    } catch (e) {
      console.warn("🧬 ARK Evolution: Failed to update dimensional intelligence.", e);
    }
  }
}
