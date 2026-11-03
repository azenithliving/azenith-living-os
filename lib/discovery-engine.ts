/**
 * Discovery Engine - Dynamic System Exploration
 *
 * "Know thy system, empower thy agent."
 *
 * Provides comprehensive system discovery capabilities:
 * 1. Database schema exploration (tables, columns, relationships)
 * 2. API endpoints discovery
 * 3. File structure analysis
 * 4. Settings and configuration discovery
 * 5. Natural language description generation (Arabic)
 */

import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchRecordInventory, type RecordInventory } from "@/lib/ops/record-inventory";
import { SECRET_MASK, isSecretSetting } from "@/lib/settings/facts";
import { arNum } from "@/lib/ops/metricLabels";
import fs from "fs";
import path from "path";

// Types for discovered resources
export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

export interface TableInfo {
  name: string;
  columns: TableColumn[];
  description: string;
  /** null means the census did not count rows — it is not a zero. */
  rowCount: number | null;
}

export interface ApiEndpoint {
  path: string;
  methods: string[];
  hasMiddleware: boolean;
  description: string;
}

export interface PageInfo {
  path: string;
  type: "page" | "layout" | "component";
  hasServerActions: boolean;
  description: string;
}

export interface SiteSetting {
  key: string;
  value: unknown;
  description: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  lastExecuted: string | null;
  isActive: boolean;
}

export interface SystemSnapshot {
  timestamp: string;
  tables: TableInfo[];
  apis: ApiEndpoint[];
  pages: PageInfo[];
  settings: SiteSetting[];
  automationRules: AutomationRule[];
  summary: string;
}

export type SchemaCensus = {
  tables: TableInfo[];
  failed: boolean;
  error: string | null;
};

/**
 * The store's own inventory, in the one read the record can answer.
 *
 * Row counts are deliberately not collected here: the inventory names 160 relations, and counting
 * each one is 160 round trips inside a single request — measured elsewhere in this store, work that
 * size does not finish.
 */
export async function discoverDatabaseSchema(preFetched?: RecordInventory): Promise<SchemaCensus> {
  const inventory = preFetched ?? (await fetchRecordInventory());
  if (!inventory.ok) {
    return { tables: [], failed: true, error: inventory.error };
  }

  const tables: TableInfo[] = inventory.tables
    .filter((table) => !table.name.startsWith("pg_") && !table.name.startsWith("_"))
    .map((table) => {
      const columns: TableColumn[] = table.columns.map((column) => ({
        name: column.name,
        type: column.type,
        nullable: !column.required,
        defaultValue: null,
      }));
      return {
        name: table.name,
        columns,
        description: generateTableDescription(table.name, columns),
        rowCount: null,
      };
    });

  return { tables, failed: false, error: null };
}

/**
 * Generate natural language description for a table (Arabic)
 */
function generateTableDescription(tableName: string, columns: TableColumn[]): string {
  const columnNames = columns.map((c) => c.name).join(", ");
  return `جدول باسم ${tableName} يحتوي على ${arNum(columns.length)} أعمدة: ${columnNames}`;
}

/**
 * Discover all API endpoints in app/api
 */
export function discoverApiEndpoints(): ApiEndpoint[] {
  const apiDir = path.join(process.cwd(), "app", "api");
  const endpoints: ApiEndpoint[] = [];

  if (!fs.existsSync(apiDir)) {
    console.warn("[Discovery] API directory not found:", apiDir);
    return endpoints;
  }

  function scanDirectory(dir: string, basePath: string = "/api") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        // Check for route.ts or route.js files
        const routeFile = ["route.ts", "route.js"].find((f) =>
          fs.existsSync(path.join(fullPath, f))
        );

        if (routeFile) {
          const content = fs.readFileSync(path.join(fullPath, routeFile), "utf-8");
          const methods = extractHttpMethods(content);
          const hasMiddleware = content.includes("middleware") || content.includes("auth");

          endpoints.push({
            path: relativePath,
            methods,
            hasMiddleware,
            description: generateEndpointDescription(relativePath, methods),
          });
        }

        // Continue scanning subdirectories
        scanDirectory(fullPath, relativePath);
      }
    }
  }

  scanDirectory(apiDir);
  return endpoints;
}

/**
 * Extract HTTP methods from route file content
 */
function extractHttpMethods(content: string): string[] {
  const methods: string[] = [];
  const methodPattern =
    /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g;

  let match;
  while ((match = methodPattern.exec(content)) !== null) {
    methods.push(match[1]);
  }

  return methods.length > 0 ? methods : ["GET"];
}

/**
 * Generate description for an API endpoint (Arabic)
 */
function generateEndpointDescription(path: string, methods: string[]): string {
  const methodList = methods.join(", ");
  return `نقطة نهاية API في المسار ${path} تدعم العمليات: ${methodList}`;
}

/**
 * Discover pages and components in app directory
 */
export function discoverPages(): PageInfo[] {
  const appDir = path.join(process.cwd(), "app");
  const pages: PageInfo[] = [];

  if (!fs.existsSync(appDir)) {
    console.warn("[Discovery] App directory not found:", appDir);
    return pages;
  }

  function scanDirectory(dir: string, basePath: string = "") {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith("(") && !entry.name.startsWith("_")) {
        // Check for page.tsx, layout.tsx, etc.
        const pageFile = ["page.tsx", "page.ts", "page.jsx", "page.js"].find((f) =>
          fs.existsSync(path.join(fullPath, f))
        );

        const layoutFile = ["layout.tsx", "layout.ts", "layout.jsx", "layout.js"].find((f) =>
          fs.existsSync(path.join(fullPath, f))
        );

        if (pageFile) {
          const content = fs.readFileSync(path.join(fullPath, pageFile), "utf-8");
          pages.push({
            path: relativePath || "/",
            type: "page",
            hasServerActions: content.includes("'use server'") || content.includes("action"),
            description: generatePageDescription(relativePath || "home", "page"),
          });
        }

        if (layoutFile) {
          const content = fs.readFileSync(path.join(fullPath, layoutFile), "utf-8");
          pages.push({
            path: relativePath,
            type: "layout",
            hasServerActions: content.includes("'use server'") || content.includes("action"),
            description: generatePageDescription(relativePath, "layout"),
          });
        }

        // Continue scanning
        scanDirectory(fullPath, relativePath);
      }
    }
  }

  scanDirectory(appDir);
  return pages;
}

/**
 * Generate page description (Arabic)
 */
function generatePageDescription(path: string, type: "page" | "layout"): string {
  const typeText = type === "page" ? "صفحة" : "تخطيط";
  const pathText = path === "/" || path === "home" ? "الرئيسية" : path;
  return `${typeText} ${pathText} في المسار /${path}`;
}

/**
 * Discover site settings
 *
 * The old code asked `information_schema` whether the table exists before reading it. The record
 * answers that question with PGRST205, so the check never passed and the assistant was told the
 * store has no settings — measured 2026-11-03: there are 20 settings rows behind that blind gate.
 */
export async function discoverSiteSettings(preFetched?: RecordInventory): Promise<SiteSetting[]> {
  const inventory = preFetched ?? (await fetchRecordInventory());
  if (!inventory.ok) {
    console.warn("[Discovery] Could not fetch the record inventory for site settings:", inventory.error);
    return [];
  }

  const real = inventory.tables.find((table) => table.name === "site_settings");
  if (!real) return [];

  const asked = ["key", "value"].filter((column) => real.columns.some((c) => c.name === column));
  if (asked.length === 0) return [];

  const settings: SiteSetting[] = [];

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("site_settings").select(asked.join(","));

    if (error) {
      console.warn("[Discovery] Could not fetch site_settings:", error.message);
      return settings;
    }

    for (const row of (data ?? []) as unknown as Array<{ key: string; value: unknown }>) {
      // A credential never enters the picture the agents build, nor the snapshot an admin door serves.
      if (isSecretSetting(row.key)) {
        settings.push({
          key: row.key,
          value: SECRET_MASK,
          description: `إعداد ${row.key} — قيمته سر في الخزانة، ما يتطبعش`,
        });
        continue;
      }
      settings.push({
        key: row.key,
        value: row.value,
        description: `إعداد ${row.key} بقيمة ${JSON.stringify(row.value)}`,
      });
    }
  } catch (error) {
    console.warn("[Discovery] Could not fetch site_settings:", error);
  }

  return settings;
}

/**
 * Discover automation rules
 *
 * Same blind pre-check, and a second blindness under it: the read asked for `last_executed` and
 * `is_active`, and the record has neither (its nine columns are id, company_id, name, trigger,
 * conditions, actions, enabled, created_at, updated_at). The flag has one owner — `enabled`.
 */
export async function discoverAutomationRules(preFetched?: RecordInventory): Promise<AutomationRule[]> {
  const inventory = preFetched ?? (await fetchRecordInventory());
  if (!inventory.ok) {
    console.warn("[Discovery] Could not fetch the record inventory for rules:", inventory.error);
    return [];
  }

  const real = inventory.tables.find((table) => table.name === "automation_rules");
  if (!real) return [];

  const wanted = ["id", "name", "trigger", "conditions", "actions", "enabled", "last_executed"];
  const asked = wanted.filter((column) => real.columns.some((c) => c.name === column));

  const rules: AutomationRule[] = [];

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from("automation_rules").select(asked.join(","));

    if (error) {
      console.warn("[Discovery] Could not fetch automation_rules:", error.message);
      return rules;
    }

    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      rules.push({
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        trigger: String(row.trigger ?? ""),
        conditions: (row.conditions as Record<string, unknown>) || {},
        actions: (row.actions as Record<string, unknown>) || {},
        lastExecuted: typeof row.last_executed === "string" ? row.last_executed : null,
        isActive: typeof row.enabled === "boolean" ? row.enabled : false,
      });
    }
  } catch (error) {
    console.warn("[Discovery] Could not fetch automation_rules:", error);
  }

  return rules;
}

/**
 * Generate comprehensive system snapshot
 */
export async function generateSystemSnapshot(): Promise<SystemSnapshot> {
  // One read of the record's inventory serves the census and both detail reads below.
  const inventory = await fetchRecordInventory();

  const [census, apis, pages, settings, automationRules] = await Promise.all([
    discoverDatabaseSchema(inventory),
    discoverApiEndpoints(),
    discoverPages(),
    discoverSiteSettings(inventory),
    discoverAutomationRules(inventory),
  ]);

  const tables = census.tables;
  const summary = generateSystemSummary(census, apis, pages, settings, automationRules);

  return {
    timestamp: new Date().toISOString(),
    tables,
    apis,
    pages,
    settings,
    automationRules,
    summary,
  };
}

/**
 * Generate natural language summary of the entire system (Arabic)
 */
function generateSystemSummary(
  census: SchemaCensus,
  apis: ApiEndpoint[],
  pages: PageInfo[],
  settings: SiteSetting[],
  rules: AutomationRule[]
): string {
  const activeRules = rules.filter((r) => r.isActive).length;
  const inactiveRules = rules.filter((r) => !r.isActive).length;
  const tablesLine = census.failed
    ? `- عدد الجداول مش معروف — السجل ما ردّش على الجرد${census.error ? ` (${census.error})` : ""}`
    : `- قاعدة البيانات فيها ${arNum(census.tables.length)} جدول`;
  const mainTables = census.failed ? "مش معروف" : census.tables.slice(0, 5).map((t) => t.name).join(", ");

  return `
نظرة عامة على النظام:
${tablesLine}
- ${arNum(apis.length)} نقطة نهاية API متاحة
- ${arNum(pages.filter((p) => p.type === "page").length)} صفحة في التطبيق
- ${arNum(pages.filter((p) => p.type === "layout").length)} تخطيط
- ${arNum(settings.length)} إعدادات موقع
- ${arNum(activeRules)} قواعد أتمتة نشطة و ${arNum(inactiveRules)} غير نشطة

الجداول الرئيسية: ${mainTables}...
الصفحات الرئيسية: ${pages.filter((p) => p.type === "page").slice(0, 5).map((p) => p.path).join(", ")}...
  `.trim();
}

/**
 * Generate natural language description of a specific resource (Arabic)
 */
export function describeResource(
  type: "table" | "api" | "page" | "setting" | "rule",
  resource: unknown
): string {
  switch (type) {
    case "table": {
      const table = resource as TableInfo;
      if (table.rowCount === null || table.rowCount === undefined) {
        return `${table.description}. عدد الصفوف مش متقيس — الجرد بيسمي الجداول وأعمادها بس.`;
      }
      return `${table.description}. فيه ${arNum(table.rowCount)} صف.`;
    }
    case "api": {
      const api = resource as ApiEndpoint;
      return `${api.description}. ${api.hasMiddleware ? "محمي بـ middleware/مصادقة." : "مفتوح بدون middleware."}`;
    }
    case "page": {
      const page = resource as PageInfo;
      return `${page.description}. ${page.hasServerActions ? "يحتوي على Server Actions." : ""}`;
    }
    case "setting": {
      const setting = resource as SiteSetting;
      return setting.description;
    }
    case "rule": {
      const rule = resource as AutomationRule;
      return `قاعدة أتمتة "${rule.name}" مفعلة على ${rule.trigger}. آخر تنفيذ: ${rule.lastExecuted || "لم ينفذ بعد"}.`;
    }
    default:
      return "موارد غير معروفة";
  }
}

/**
 * Get quick system overview in Arabic
 */
export async function getSystemOverview(): Promise<string> {
  const snapshot = await generateSystemSnapshot();
  return snapshot.summary;
}

/**
 * Execute a safe SQL query (read-only by default)
 */
export async function executeSafeQuery(query: string): Promise<{
  success: boolean;
  data?: unknown[];
  error?: string;
}> {
  const supabase = await createServerClient();

  // Security: Block dangerous operations
  const dangerousPatterns = ["DROP", "TRUNCATE", "DELETE", "UPDATE", "INSERT", "ALTER"];
  const normalizedQuery = query.toUpperCase();

  for (const pattern of dangerousPatterns) {
    if (normalizedQuery.includes(pattern)) {
      return {
        success: false,
        error: `🚫 عملية ${pattern} غير مسموحة في استعلامات القراءة`,
      };
    }
  }

  try {
    // Only allow SELECT statements
    if (!normalizedQuery.trim().startsWith("SELECT")) {
      return {
        success: false,
        error: "🚫 يُسمح فقط باستعلامات SELECT للقراءة",
      };
    }

    const { data, error } = await supabase.rpc("execute_sql", { query });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "خطأ غير معروف",
    };
  }
}

/**
 * Search for specific patterns across the codebase
 */
export function searchCodebase(pattern: string): {
  file: string;
  matches: string[];
}[] {
  const results: { file: string; matches: string[] }[] = [];
  const searchDirs = ["app", "lib", "components"];

  for (const dir of searchDirs) {
    const fullDir = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullDir)) continue;

    function searchInDirectory(directory: string) {
      const entries = fs.readdirSync(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          searchInDirectory(fullPath);
        } else if (
          entry.name.endsWith(".ts") ||
          entry.name.endsWith(".tsx") ||
          entry.name.endsWith(".js") ||
          entry.name.endsWith(".jsx")
        ) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            if (content.includes(pattern)) {
              const lines = content.split("\n");
              const matches = lines
                .map((line, index) => ({ line, index: index + 1 }))
                .filter(({ line }) => line.includes(pattern))
                .map(({ line, index }) => `${index}: ${line.trim()}`);

              if (matches.length > 0) {
                results.push({
                  file: path.relative(process.cwd(), fullPath),
                  matches: matches.slice(0, 5), // Limit to 5 matches per file
                });
              }
            }
          } catch {
            // Skip files that can't be read
          }
        }
      }
    }

    searchInDirectory(fullDir);
  }

  return results;
}

/**
 * Get a specific table's data sample
 */
export async function getTableSample(tableName: string, limit: number = 5): Promise<{
  success: boolean;
  data?: unknown[];
  columns?: string[];
  error?: string;
}> {
  const supabase = await createServerClient();

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    const columns =
      data && data.length > 0 ? Object.keys(data[0] as Record<string, unknown>) : [];

    return { success: true, data: data || [], columns };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "خطأ غير معروف",
    };
  }
}
