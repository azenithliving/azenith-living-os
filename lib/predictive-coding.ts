/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    PREDICTIVE CODING ENGINE - Pattern Analysis             ║
 * ║         Technical Intent Reading | Auto-Module Generation | World-Class  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * Analyzes the Master's (Sir Azenith) coding patterns. Starts generating the 
 * next logical functions and business modules before they are requested.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join, relative } from "path";
import { infiniteSwarm, ConsensusRequest } from "./swarm-consensus";

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface CodePattern {
  id: string;
  type: "naming" | "structure" | "imports" | "functions" | "architecture";
  pattern: string;
  frequency: number;
  examples: string[];
  confidence: number;
}

export interface PredictedModule {
  id: string;
  timestamp: Date;
  name: string;
  description: string;
  rationale: string;
  predictedFilePath: string;
  code: string;
  confidence: number;
  dependencies: string[];
  status: "predicted" | "generating" | "ready" | "approved" | "implemented";
  triggeredBy: string[];
}

export interface CodingProfile {
  author: string;
  analyzedAt: Date;
  patterns: CodePattern[];
  preferences: {
    namingConvention: string;
    architectureStyle: string;
    preferredLibraries: string[];
    codeComplexity: "minimal" | "balanced" | "comprehensive";
    documentationLevel: "inline" | "jsdoc" | "minimal";
  };
  projectContext: {
    techStack: string[];
    businessDomain: string;
    codeVolume: number;
    lastActive: Date;
  };
}

// ==========================================
// PREDICTIVE CODING ENGINE
// ==========================================

export class PredictiveCodingEngine {
  private _supabase: ReturnType<typeof createClient> | null = null;

  private get supabase() {
    if (!this._supabase) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) throw new Error("Missing Supabase credentials");
      this._supabase = createClient(url, key);
    }
    return this._supabase;
  }
  
  private patterns: Map<string, CodePattern> = new Map();
  private predictedModules: Map<string, PredictedModule> = new Map();
  private codingProfile: CodingProfile | null = null;
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  // Files to monitor for pattern analysis
  private readonly MONITOR_PATHS = [
    "app/**/*.tsx",
    "app/**/*.ts",
    "lib/**/*.ts",
    "components/**/*.tsx",
    "hooks/**/*.ts",
  ];

  constructor() {
    this.loadHistoricalData();
  }

  private async loadHistoricalData() {
    const { data: patterns } = await this.supabase
      .from("code_patterns")
      .select("*")
      .order("frequency", { ascending: false })
      .limit(100);

    if (patterns) {
      for (const p of patterns) {
        this.patterns.set(p.id, {
          ...p,
          examples: p.examples || [],
        });
      }
    }

    const { data: modules } = await this.supabase
      .from("predicted_modules")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(50);

    if (modules) {
      for (const m of modules) {
        this.predictedModules.set(m.id, {
          ...m,
          timestamp: new Date(m.timestamp),
          triggeredBy: m.triggered_by || [],
        });
      }
    }
  }

  // ==========================================
  // PATTERN ANALYSIS
  // ==========================================

  async analyzeCodebase(): Promise<CodingProfile> {
    console.log("[PredictiveCoding] Analyzing codebase patterns...");

    const allFiles = this.getAllSourceFiles();
    const patterns: CodePattern[] = [];

    // Analyze naming patterns
    const namingPatterns = this.extractNamingPatterns(allFiles);
    patterns.push(...namingPatterns);

    // Analyze import patterns
    const importPatterns = this.extractImportPatterns(allFiles);
    patterns.push(...importPatterns);

    // Analyze function patterns
    const functionPatterns = this.extractFunctionPatterns(allFiles);
    patterns.push(...functionPatterns);

    // Analyze architectural patterns
    const archPatterns = this.extractArchitecturalPatterns(allFiles);
    patterns.push(...archPatterns);

    // Build coding profile
    const profile: CodingProfile = {
      author: "Sir Azenith",
      analyzedAt: new Date(),
      patterns: patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 50),
      preferences: this.inferPreferences(patterns),
      projectContext: {
        techStack: this.extractTechStack(allFiles),
        businessDomain: "luxury_interior_design",
        codeVolume: allFiles.length,
        lastActive: new Date(),
      },
    };

    this.codingProfile = profile;
    
    // Store patterns
    await this.storePatterns(patterns);

    return profile;
  }

  private getAllSourceFiles(): string[] {
    const files: string[] = [];
    const basePath = resolve(process.cwd());

    const scanDir = (dir: string) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
            scanDir(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
            files.push(fullPath);
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    };

    scanDir(basePath);
    return files.slice(0, 200); // Limit to avoid overwhelming
  }

  private extractNamingPatterns(files: string[]): CodePattern[] {
    const patterns: CodePattern[] = [];
    const componentNames: string[] = [];
    const functionNames: string[] = [];
    const variableNames: string[] = [];

    for (const file of files) {
      try {
        const content = readFileSync(file, "utf-8");
        
        // Extract component names (PascalCase)
        const components = content.match(/(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g);
        if (components) {
          componentNames.push(...components.map(c => c.split(/\s+/).pop() || ""));
        }

        // Extract function names
        const functions = content.match(/(?:function|const)\s+([a-z][a-zA-Z0-9]*)/g);
        if (functions) {
          functionNames.push(...functions.map(f => f.split(/\s+/).pop() || ""));
        }
      } catch {
        // Skip files that can't be read
      }
    }

    // Analyze naming conventions
    const namingConventions = this.analyzeNamingConventions(componentNames, functionNames);
    patterns.push(...namingConventions);

    return patterns;
  }

  private analyzeNamingConventions(components: string[], functions: string[]): CodePattern[] {
    const patterns: CodePattern[] = [];

    // Check for common prefixes/suffixes
    const prefixes: Record<string, number> = {};
    const suffixes: Record<string, number> = {};

    for (const name of [...components, ...functions]) {
      const prefix = name.split(/(?=[A-Z])/)[0];
      const suffix = name.split(/(?=[A-Z])/).pop() || "";
      
      prefixes[prefix] = (prefixes[prefix] || 0) + 1;
      suffixes[suffix] = (suffixes[suffix] || 0) + 1;
    }

    // Create pattern entries
    for (const [prefix, count] of Object.entries(prefixes)) {
      if (count > 5) {
        patterns.push({
          id: `naming_prefix_${prefix}`,
          type: "naming",
          pattern: `${prefix}* naming convention`,
          frequency: count,
          examples: [...components, ...functions].filter(n => n.startsWith(prefix)).slice(0, 5),
          confidence: Math.min(100, count * 5),
        });
      }
    }

    return patterns;
  }

  private extractImportPatterns(files: string[]): CodePattern[] {
    const imports: Record<string, number> = {};

    for (const file of files) {
      try {
        const content = readFileSync(file, "utf-8");
        const importMatches = content.match(/from\s+["']([^"']+)["']/g);
        
        if (importMatches) {
          for (const imp of importMatches) {
            const source = imp.replace(/from\s+["']/, "").replace(/["']$/, "");
            imports[source] = (imports[source] || 0) + 1;
          }
        }
      } catch {
        // Skip
      }
    }

    return Object.entries(imports)
      .filter(([_, count]) => count > 3)
      .map(([source, count], idx) => ({
        id: `import_${idx}`,
        type: "imports",
        pattern: `Import from ${source.split("/")[0]}`,
        frequency: count,
        examples: [source],
        confidence: Math.min(100, count * 3),
      }));
  }

  private extractFunctionPatterns(files: string[]): CodePattern[] {
    const asyncPattern: CodePattern = {
      id: "pattern_async_functions",
      type: "functions",
      pattern: "Heavy use of async/await",
      frequency: 0,
      examples: [],
      confidence: 0,
    };

    let asyncCount = 0;

    for (const file of files) {
      try {
        const content = readFileSync(file, "utf-8");
        const asyncMatches = content.match(/async\s+function|async\s+\(|async\s+\w+\s*=>/g);
        if (asyncMatches) {
          asyncCount += asyncMatches.length;
        }
      } catch {
        // Skip
      }
    }

    asyncPattern.frequency = asyncCount;
    asyncPattern.confidence = Math.min(100, asyncCount / 2);

    return [asyncPattern];
  }

  private extractArchitecturalPatterns(files: string[]): CodePattern[] {
    const patterns: CodePattern[] = [];

    // Check for specific architectural patterns
    const hasServerActions = files.some(f => {
      try {
        return readFileSync(f, "utf-8").includes('"use server"');
      } catch {
        return false;
      }
    });

    if (hasServerActions) {
      patterns.push({
        id: "arch_server_actions",
        type: "architecture",
        pattern: "Next.js Server Actions pattern",
        frequency: files.filter(f => {
          try {
            return readFileSync(f, "utf-8").includes('"use server"');
          } catch {
            return false;
          }
        }).length,
        examples: ["use server"],
        confidence: 95,
      });
    }

    return patterns;
  }

  private inferPreferences(patterns: CodePattern[]): CodingProfile["preferences"] {
    const namingPatterns = patterns.filter(p => p.type === "naming");
    const importPatterns = patterns.filter(p => p.type === "imports");

    // Infer naming convention
    const hasPascalCase = namingPatterns.some(p => 
      p.examples.some(e => /^[A-Z]/.test(e))
    );
    const hasCamelCase = namingPatterns.some(p => 
      p.examples.some(e => /^[a-z]/.test(e))
    );

    const namingConvention = hasPascalCase ? "PascalCase for components, camelCase for functions" : "camelCase";

    // Infer libraries
    const preferredLibraries = importPatterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10)
      .map(p => p.examples[0]?.split("/")[0])
      .filter(Boolean);

    return {
      namingConvention,
      architectureStyle: "Next.js App Router with Server Actions",
      preferredLibraries: [...new Set(preferredLibraries)],
      codeComplexity: "comprehensive",
      documentationLevel: "jsdoc",
    };
  }

  private extractTechStack(files: string[]): string[] {
    const techStack = new Set<string>();

    // Check package.json
    try {
      const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf-8");
      const pkg = JSON.parse(packageJson);
      
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      if (deps["next"]) techStack.add("Next.js 16");
      if (deps["react"]) techStack.add("React 19");
      if (deps["typescript"]) techStack.add("TypeScript");
      if (deps["tailwindcss"]) techStack.add("Tailwind CSS v4");
      if (deps["@supabase/supabase-js"]) techStack.add("Supabase");
      if (deps["framer-motion"]) techStack.add("Framer Motion");
    } catch {
      // Fallback
    }

    return Array.from(techStack);
  }

  private async storePatterns(patterns: CodePattern[]): Promise<void> {
    const records = patterns.map(p => ({
      id: p.id,
      type: p.type,
      pattern: p.pattern,
      frequency: p.frequency,
      examples: p.examples,
      confidence: p.confidence,
      analyzed_at: new Date().toISOString(),
    }));

    await this.supabase.from("code_patterns").upsert(records);
  }

  // ==========================================
  // PREDICTIVE MODULE GENERATION
  // ==========================================

  async predictNextModules(): Promise<PredictedModule[]> {
    if (!this.codingProfile) {
      await this.analyzeCodebase();
    }

    const profile = this.codingProfile!;
    const recentChanges = this.detectRecentChanges();
    
    const predictions: PredictedModule[] = [];

    // Generate predictions based on patterns and recent changes
    for (const change of recentChanges) {
      const prediction = await this.generateModulePrediction(change, profile);
      if (prediction) {
        predictions.push(prediction);
      }
    }

    // Also generate based on project gaps
    const gapPredictions = await this.predictBasedOnGaps(profile);
    predictions.push(...gapPredictions);

    // Store predictions
    for (const pred of predictions) {
      this.predictedModules.set(pred.id, pred);
    }
    
    await this.storePredictions(predictions);

    return predictions;
  }

  private detectRecentChanges(): Array<{ type: string; file: string; content: string }> {
    // In production, this would use git diff or file watching
    // For now, return recent file modifications
    return [];
  }

  private async generateModulePrediction(
    change: { type: string; file: string; content: string },
    profile: CodingProfile
  ): Promise<PredictedModule | null> {
    // Use AI to predict next logical module
    const request: ConsensusRequest = {
      prompt: `Based on this code change:
File: ${change.file}
Change type: ${change.type}

And the developer's profile:
- Preferred naming: ${profile.preferences.namingConvention}
- Architecture: ${profile.preferences.architectureStyle}
- Libraries: ${profile.preferences.preferredLibraries.join(", ")}

What is the next logical module/function to implement? 

Provide:
1. Module name
2. File path (following project conventions)
3. Purpose
4. Full TypeScript implementation
5. Why this is the logical next step`,
      taskType: "code_generation",
      complexity: 75,
      urgency: "normal",
      requireConsensus: true,
      maxParallelNodes: 4,
    };

    try {
      const result = await infiniteSwarm.executeConsensus(request);
      return this.parsePredictionResult(result.response, change);
    } catch (error) {
      console.error("[PredictiveCoding] Prediction generation failed:", error);
      return null;
    }
  }

  private async predictBasedOnGaps(profile: CodingProfile): Promise<PredictedModule[]> {
    // Identify missing modules based on project structure
    const gaps: PredictedModule[] = [];

    // Common modules for this type of project
    const commonModules = [
      { name: "analytics-dashboard", path: "app/admin/analytics/page.tsx" },
      { name: "user-preferences", path: "lib/user-preferences.ts" },
      { name: "notification-system", path: "lib/notifications.ts" },
      { name: "api-rate-limiter", path: "lib/rate-limiter.ts" },
    ];

    for (const mod of commonModules) {
      // Check if already exists
      const exists = this.checkFileExists(mod.path);
      
      if (!exists) {
        gaps.push({
          id: `gap_${mod.name}_${Date.now()}`,
          timestamp: new Date(),
          name: mod.name,
          description: `Missing ${mod.name} module detected in project structure`,
          rationale: "Common module for this architecture not yet implemented",
          predictedFilePath: mod.path,
          code: "// Would be generated based on patterns",
          confidence: 70,
          dependencies: [],
          status: "predicted",
          triggeredBy: ["gap_analysis"],
        });
      }
    }

    return gaps;
  }

  private checkFileExists(path: string): boolean {
    try {
      statSync(resolve(process.cwd(), path));
      return true;
    } catch {
      return false;
    }
  }

  private parsePredictionResult(response: string, trigger: any): PredictedModule | null {
    try {
      // Extract structured data from AI response
      const nameMatch = response.match(/(?:Module name|Name):\s*(.+)/i);
      const pathMatch = response.match(/(?:File path|Path):\s*(.+)/i);
      const purposeMatch = response.match(/(?:Purpose|Description):\s*(.+)/i);
      
      // Extract code block
      const codeMatch = response.match(/```(?:typescript|tsx|ts)?\n([\s\S]*?)```/);

      if (nameMatch && pathMatch) {
        return {
          id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          name: nameMatch[1].trim(),
          description: purposeMatch?.[1].trim() || "Auto-generated module",
          rationale: `Predicted based on ${trigger.type} in ${trigger.file}`,
          predictedFilePath: pathMatch[1].trim(),
          code: codeMatch?.[1].trim() || "// Implementation needed",
          confidence: 85,
          dependencies: this.extractDependencies(codeMatch?.[1] || ""),
          status: "predicted",
          triggeredBy: [trigger.file],
        };
      }
    } catch {
      // Parsing failed
    }

    return null;
  }

  private extractDependencies(code: string): string[] {
    const deps: string[] = [];
    const importMatches = code.match(/from\s+["']([^"']+)["']/g);
    
    if (importMatches) {
      for (const imp of importMatches) {
        const source = imp.replace(/from\s+["']/, "").replace(/["']$/, "");
        if (!source.startsWith(".") && !source.startsWith("@/")) {
          deps.push(source.split("/")[0]);
        }
      }
    }

    return [...new Set(deps)];
  }

  private async storePredictions(predictions: PredictedModule[]): Promise<void> {
    const records = predictions.map(p => ({
      id: p.id,
      timestamp: p.timestamp.toISOString(),
      name: p.name,
      description: p.description,
      predicted_file_path: p.predictedFilePath,
      code: p.code,
      confidence: p.confidence,
      dependencies: p.dependencies,
      status: p.status,
      triggered_by: p.triggeredBy,
    }));

    await this.supabase.from("predicted_modules").upsert(records);
  }

  // ==========================================
  // CONTINUOUS MONITORING
  // ==========================================

  startPredictiveMonitoring(): void {
    if (this.isMonitoring) return;
    this.isMonitoring = true;

    console.log("[PredictiveCoding] Starting pattern monitoring...");

    // Analyze every 10 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.analyzeCodebase();
      await this.predictNextModules();
    }, 10 * 60 * 1000);

    // Initial analysis
    this.analyzeCodebase().then(() => this.predictNextModules());
  }

  stopPredictiveMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  getCodingProfile(): CodingProfile | null {
    return this.codingProfile;
  }

  getPredictedModules(options?: {
    status?: PredictedModule["status"];
    minConfidence?: number;
    limit?: number;
  }): PredictedModule[] {
    let modules = Array.from(this.predictedModules.values());

    if (options?.status) {
      modules = modules.filter(m => m.status === options.status);
    }

    if (options?.minConfidence) {
      modules = modules.filter(m => m.confidence >= options.minConfidence!);
    }

    modules.sort((a, b) => b.confidence - a.confidence);

    return modules.slice(0, options?.limit || 20);
  }

  async approveModule(moduleId: string): Promise<boolean> {
    const module = this.predictedModules.get(moduleId);
    if (!module) return false;

    module.status = "approved";

    await this.supabase
      .from("predicted_modules")
      .update({ status: "approved" })
      .eq("id", moduleId);

    return true;
  }

  async markImplemented(moduleId: string): Promise<boolean> {
    const module = this.predictedModules.get(moduleId);
    if (!module) return false;

    module.status = "implemented";

    await this.supabase
      .from("predicted_modules")
      .update({ status: "implemented" })
      .eq("id", moduleId);

    return true;
  }

  getTopPatterns(limit: number = 10): CodePattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }
}

// Export singleton
export const predictiveCoding = new PredictiveCodingEngine();
