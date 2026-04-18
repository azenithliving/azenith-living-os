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
  rowCount?: number;
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

/**
 * Fetch all tables from information_schema
 */
export async function discoverDatabaseSchema(): Promise<TableInfo[]> {
  const supabase = await createServerClient();

  try {
    // Get all tables from public schema
    const { data: tables, error: tablesError } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_type", "BASE TABLE");

    if (tablesError) {
      console.error("[Discovery] Error fetching tables:", tablesError);
      return [];
    }

    const tableInfoList: TableInfo[] = [];

    for (const table of tables || []) {
      const tableName = table.table_name;

      // Skip internal Supabase tables
      if (tableName.startsWith("pg_") || tableName.startsWith("_")) continue;

      // Get columns for this table
      const { data: columns, error: columnsError } = await supabase
        .from("information_schema.columns")
        .select("column_name, data_type, is_nullable, column_default")
        .eq("table_schema", "public")
        .eq("table_name", tableName);

      if (columnsError) {
        console.error(`[Discovery] Error fetching columns for ${tableName}:`, columnsError);
        continue;
      }

      // Get row count
      const { count } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      const columnInfo: TableColumn[] = (columns || []).map((col) => ({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === "YES",
        defaultValue: col.column_default,
      }));

      tableInfoList.push({
        name: tableName,
        columns: columnInfo,
        description: generateTableDescription(tableName, columnInfo),
        rowCount: count || 0,
      });
    }

    return tableInfoList;
  } catch (error) {
    console.error("[Discovery] Failed to discover database schema:", error);
    return [];
  }
}

/**
 * Generate natural language description for a table (Arabic)
 */
function generateTableDescription(tableName: string, columns: TableColumn[]): string {
  const columnNames = columns.map((c) => c.name).join(", ");
  return `جدول باسم ${tableName} يحتوي على ${columns.length} أعمدة: ${columnNames}`;
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
 */
export async function discoverSiteSettings(): Promise<SiteSetting[]> {
  const supabase = await createServerClient();
  const settings: SiteSetting[] = [];

  try {
    // Check if site_settings table exists
    const { data: tableExists } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_name", "site_settings")
      .single();

    if (tableExists) {
      const { data, error } = await supabase.from("site_settings").select("key, value");

      if (!error && data) {
        for (const row of data) {
          settings.push({
            key: row.key,
            value: row.value,
            description: `إعداد ${row.key} بقيمة ${JSON.stringify(row.value)}`,
          });
        }
      }
    }
  } catch (error) {
    console.warn("[Discovery] Could not fetch site_settings:", error);
  }

  return settings;
}

/**
 * Discover automation rules
 */
export async function discoverAutomationRules(): Promise<AutomationRule[]> {
  const supabase = await createServerClient();
  const rules: AutomationRule[] = [];

  try {
    // Check if automation_rules table exists
    const { data: tableExists } = await supabase
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_name", "automation_rules")
      .single();

    if (tableExists) {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("id, name, trigger, conditions, actions, last_executed, is_active, enabled");

      if (!error && data) {
        for (const row of data) {
          rules.push({
            id: row.id,
            name: row.name,
            trigger: row.trigger,
            conditions: row.conditions || {},
            actions: row.actions || {},
            lastExecuted: row.last_executed,
            isActive:
              typeof row.is_active === "boolean"
                ? row.is_active
                : typeof row.enabled === "boolean"
                ? row.enabled
                : false,
          });
        }
      }
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
  const [tables, apis, pages, settings, automationRules] = await Promise.all([
    discoverDatabaseSchema(),
    discoverApiEndpoints(),
    discoverPages(),
    discoverSiteSettings(),
    discoverAutomationRules(),
  ]);

  const summary = generateSystemSummary(tables, apis, pages, settings, automationRules);

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
  tables: TableInfo[],
  apis: ApiEndpoint[],
  pages: PageInfo[],
  settings: SiteSetting[],
  rules: AutomationRule[]
): string {
  const activeRules = rules.filter((r) => r.isActive).length;
  const inactiveRules = rules.filter((r) => !r.isActive).length;

  return `
نظرة عامة على النظام:
- قاعدة البيانات تحتوي على ${tables.length} جدول/جداول
- ${apis.length} نقطة نهاية API متاحة
- ${pages.filter((p) => p.type === "page").length} صفحة في التطبيق
- ${pages.filter((p) => p.type === "layout").length} تخطيط
- ${settings.length} إعدادات موقع
- ${activeRules} قواعد أتمتة نشطة و ${inactiveRules} غير نشطة

الجداول الرئيسية: ${tables.slice(0, 5).map((t) => t.name).join(", ")}...
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
      return `${table.description}. يحتوي على ${table.rowCount || 0} صف/صفوف.`;
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
