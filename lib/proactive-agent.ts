/**
 * Proactive Agent - Autonomous System Monitoring & Suggestions
 *
 * "See what others don't, act before others do."
 *
 * Runs autonomously every 6 hours to:
 * 1. Scan system health and performance
 * 2. Identify anomalies and unused features
 * 3. Generate open-ended improvement suggestions
 * 4. Store suggestions in general_suggestions for admin review
 */

import {
  generateSystemSnapshot,
  getTableSample,
  discoverAutomationRules,
  type SystemSnapshot,
  type AutomationRule,
} from "./discovery-engine";
import { generateExecutionPlan, storeSuggestion } from "./general-agent";
import { createClient } from "./supabase-server";

// Types for monitoring results
interface MonitoringResult {
  timestamp: string;
  findings: Finding[];
  suggestionsGenerated: number;
}

interface Finding {
  type: "anomaly" | "unused_feature" | "performance_issue" | "opportunity" | "warning";
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  affectedResource: string;
  data?: Record<string, unknown>;
}

interface PerformanceMetrics {
  tableRowCounts: Record<string, number>;
  slowQueries: string[];
  largeTables: string[];
}

/**
 * Main autonomous monitoring function
 * Called every 6 hours via cron job
 */
export async function runAutonomousMonitoring(): Promise<MonitoringResult> {
  console.log("[ProactiveAgent] Starting autonomous monitoring...");

  const snapshot = await generateSystemSnapshot();
  const findings: Finding[] = [];

  // Run all monitoring checks
  findings.push(...(await checkAutomationRules(snapshot)));
  findings.push(...(await checkUnusedFeatures(snapshot)));
  findings.push(...(await checkPerformanceIssues(snapshot)));
  findings.push(...(await checkDataAnomalies(snapshot)));
  findings.push(...(await checkImageOptimization(snapshot)));
  findings.push(...(await checkUserBehaviorPatterns(snapshot)));

  // Generate suggestions based on findings
  let suggestionsGenerated = 0;
  for (const finding of findings) {
    if (finding.severity === "high" || finding.type === "opportunity") {
      const success = await generateSuggestionFromFinding(finding, snapshot);
      if (success) suggestionsGenerated++;
    }
  }

  const result: MonitoringResult = {
    timestamp: new Date().toISOString(),
    findings,
    suggestionsGenerated,
  };

  // Log the monitoring session
  await logMonitoringSession(result);

  console.log(
    `[ProactiveAgent] Monitoring complete: ${findings.length} findings, ${suggestionsGenerated} suggestions`
  );

  return result;
}

/**
 * Check automation rules for issues
 */
async function checkAutomationRules(snapshot: SystemSnapshot): Promise<Finding[]> {
  const findings: Finding[] = [];
  const rules = await discoverAutomationRules();

  for (const rule of rules) {
    // Check if rule hasn't run in 7 days
    if (rule.lastExecuted) {
      const lastRun = new Date(rule.lastExecuted);
      const daysSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceRun > 7) {
        findings.push({
          type: "anomaly",
          severity: "medium",
          title: `قاعدة الأتمتة "${rule.name}" لم تنفذ منذ ${Math.floor(daysSinceRun)} أيام`,
          description: `لاحظت أن قاعدة الأتمتة '${rule.name}' المفعلة على '${rule.trigger}' لم تنفذ منذ ${Math.floor(daysSinceRun)} أيام. ربما لأن الشرط غير ممكن أو البيانات المطلوبة غير متوفرة. أقترح مراجعة شروط القاعدة أو تعديلها.`,
          affectedResource: `automation_rules:${rule.id}`,
          data: { rule, daysSinceRun },
        });
      }
    } else if (rule.isActive) {
      // Rule is active but never executed
      findings.push({
        type: "warning",
        severity: "low",
        title: `قاعدة الأتمتة "${rule.name}" لم تنفذ قط`,
        description: `قاعدة الأتمتة '${rule.name}' نشطة لكن لم تنفذ منذ إنشائها. تأكد من أن الشرط يمكن تحقيقه أو حدد موعد تنفيذها.`,
        affectedResource: `automation_rules:${rule.id}`,
        data: { rule },
      });
    }
  }

  // Check for inactive rules
  const inactiveRules = rules.filter((r) => !r.isActive);
  if (inactiveRules.length > 5) {
    findings.push({
      type: "unused_feature",
      severity: "low",
      title: `${inactiveRules.length} قواعد أتمتة غير نشطة`,
      description: `يوجد ${inactiveRules.length} قواعد أتمتة غير نشطة في النظام. يمكنك مراجعة هذه القواعد وإما تفعيلها أو حذفها لتنظيف النظام.`,
      affectedResource: "automation_rules",
      data: { inactiveCount: inactiveRules.length },
    });
  }

  return findings;
}

/**
 * Check for unused features
 */
async function checkUnusedFeatures(snapshot: SystemSnapshot): Promise<Finding[]> {
  const findings: Finding[] = [];
  const supabase = await createClient();

  // Check for empty tables
  for (const table of snapshot.tables) {
    if ((table.rowCount || 0) === 0 && !isSystemTable(table.name)) {
      findings.push({
        type: "unused_feature",
        severity: "low",
        title: `جدول "${table.name}" فارغ`,
        description: `الجدول '${table.name}' موجود لكن لا يحتوي على أي بيانات. ربما لم يُستخدم بعد أو يمكن حذفه إذا لم يكن ضرورياً.`,
        affectedResource: `table:${table.name}`,
        data: { table },
      });
    }
  }

  // Check for unused API endpoints (if we have usage logs)
  try {
    const { data: apiLogs } = await supabase
      .from("api_logs")
      .select("endpoint, count")
      .order("count", { ascending: true })
      .limit(10);

    if (apiLogs) {
      for (const log of apiLogs) {
        if (log.count === 0) {
          findings.push({
            type: "unused_feature",
            severity: "low",
            title: `نقطة نهاية API غير مستخدمة: ${log.endpoint}`,
            description: `نقطة النهاية ${log.endpoint} لم تُستدعى منذ فترة. يمكن مراجعة الحاجة إليها أو حذفها.`,
            affectedResource: `api:${log.endpoint}`,
            data: { endpoint: log.endpoint, count: log.count },
          });
        }
      }
    }
  } catch {
    // Table might not exist, skip
  }

  return findings;
}

/**
 * Check for performance issues
 */
async function checkPerformanceIssues(snapshot: SystemSnapshot): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Check for large tables
  for (const table of snapshot.tables) {
    const rowCount = table.rowCount || 0;

    if (rowCount > 100000) {
      findings.push({
        type: "performance_issue",
        severity: "high",
        title: `جدول "${table.name}" كبير جداً (${rowCount.toLocaleString()} صف)`,
        description: `الجدول '${table.name}' يحتوي على ${rowCount.toLocaleString()} صف. قد يؤثر على الأداء. أقترح: 1) إضافة فهارس جديدة 2) أرشفة البيانات القديمة 3) تقسيم الجدول.`,
        affectedResource: `table:${table.name}`,
        data: { table, rowCount },
      });
    } else if (rowCount > 10000) {
      findings.push({
        type: "performance_issue",
        severity: "medium",
        title: `جدول "${table.name}" يكبر (${rowCount.toLocaleString()} صف)`,
        description: `الجدول '${table.name}' يحتوي على ${rowCount.toLocaleString()} صف. يفضل مراقبة حجمه وإضافة فهارس إذا لزم الأمر.`,
        affectedResource: `table:${table.name}`,
        data: { table, rowCount },
      });
    }
  }

  return findings;
}

/**
 * Check for data anomalies
 */
async function checkDataAnomalies(snapshot: SystemSnapshot): Promise<Finding[]> {
  const findings: Finding[] = [];
  const supabase = await createClient();

  // Check for users without activity
  try {
    const { count: totalUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true });

    const { count: activeUsers } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .gte("last_active", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (totalUsers && activeUsers && totalUsers > 0) {
      const inactivePercentage = ((totalUsers - activeUsers) / totalUsers) * 100;

      if (inactivePercentage > 70) {
        findings.push({
          type: "anomaly",
          severity: "high",
          title: `${Math.floor(inactivePercentage)}% من المستخدمين غير نشطين`,
          description: `نسبة كبيرة (${Math.floor(inactivePercentage)}%) من المستخدمين لم يكونوا نشطين في آخر 30 يوماً. أقترح حملة إعادة تفعيل أو استبيان لمعرفة الأسباب.`,
          affectedResource: "users",
          data: { totalUsers, activeUsers, inactivePercentage },
        });
      }
    }
  } catch {
    // Skip if table doesn't exist
  }

  return findings;
}

/**
 * Check for image optimization opportunities
 */
async function checkImageOptimization(snapshot: SystemSnapshot): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Check curated_images table if it exists
  const curatedImagesTable = snapshot.tables.find((t) => t.name === "curated_images");

  if (curatedImagesTable && (curatedImagesTable.rowCount || 0) > 0) {
    const sample = await getTableSample("curated_images", 5);

    if (sample.success && sample.data) {
      // Check for large images
      const largeImages = (sample.data as Array<Record<string, unknown>>).filter(
        (img) => (img.file_size as number) > 1024 * 1024 // > 1MB
      );

      if (largeImages.length > 0) {
        findings.push({
          type: "performance_issue",
          severity: "medium",
          title: `صور كبيرة جداً في المعرض (${largeImages.length} صورة)`,
          description: `لاحظت أن ${largeImages.length} صور في المعرض أكبر من 1 ميجابايت. هذا قد يبطئ تحميل الصفحة. أقترح ضغطها أو استخدام WebP مع Lazy Loading.`,
          affectedResource: "curated_images",
          data: { largeImagesCount: largeImages.length },
        });
      }
    }
  }

  return findings;
}

/**
 * Check user behavior patterns
 */
async function checkUserBehaviorPatterns(snapshot: SystemSnapshot): Promise<Finding[]> {
  const findings: Finding[] = [];
  const supabase = await createClient();

  // Check for high traffic at specific times (if we have analytics)
  try {
    const { data: hourlyStats } = await supabase
      .from("analytics_hourly")
      .select("hour, visits")
      .order("visits", { ascending: false })
      .limit(5);

    if (hourlyStats && hourlyStats.length > 0) {
      const peakHour = hourlyStats[0].hour;
      const isNightTime = peakHour >= 20 || peakHour <= 5;

      if (isNightTime) {
        findings.push({
          type: "opportunity",
          severity: "medium",
          title: "كثرة الزيارات في ساعات المساء",
          description: `لاحظت أن معظم الزيارات تأتي في ساعة ${peakHour}:00. أقترح إنشاء قاعدة أتمتة ترسل عروض مسائية للزوار النشطين في هذه الفترة.`,
          affectedResource: "analytics",
          data: { peakHour, visits: hourlyStats[0].visits },
        });
      }
    }
  } catch {
    // Skip if table doesn't exist
  }

  // Check for furniture page interest
  const furnitureTable = snapshot.tables.find((t) => t.name === "furniture_interests");
  if (furnitureTable && (furnitureTable.rowCount || 0) > 100) {
    findings.push({
      type: "opportunity",
      severity: "low",
      title: "اهتمام كبير بالأثاث",
      description: `هناك ${furnitureTable.rowCount} سجل اهتمام بالأثاث. أقترح إضافة خاصية المقارنة بين القطع أو إنشاء كتالوج PDF قابل للتحميل.`,
      affectedResource: "furniture_interests",
      data: { rowCount: furnitureTable.rowCount },
    });
  }

  return findings;
}

/**
 * Generate suggestion from a finding using LLM
 */
async function generateSuggestionFromFinding(
  finding: Finding,
  snapshot: SystemSnapshot
): Promise<boolean> {
  try {
    const plan = await generateExecutionPlan(finding.description);

    const result = await storeSuggestion(
      finding.title,
      finding.description,
      plan,
      "proactive_agent"
    );

    return result.success;
  } catch (error) {
    console.error("[ProactiveAgent] Failed to generate suggestion:", error);
    return false;
  }
}

/**
 * Log monitoring session to database
 */
async function logMonitoringSession(result: MonitoringResult): Promise<void> {
  const supabase = await createClient();

  try {
    await supabase.from("monitoring_logs").insert({
      timestamp: result.timestamp,
      findings_count: result.findings.length,
      suggestions_generated: result.suggestionsGenerated,
      findings: result.findings,
    });
  } catch (error) {
    console.warn("[ProactiveAgent] Could not log monitoring session:", error);
  }
}

/**
 * Check if a table is a system table that should be ignored
 */
function isSystemTable(tableName: string): boolean {
  const systemTables = [
    "migrations",
    "schema_migrations",
    "spatial_ref_sys",
    "general_suggestions",
    "monitoring_logs",
    "api_logs",
  ];

  return systemTables.includes(tableName) || tableName.startsWith("pg_");
}

/**
 * Manual trigger for testing
 */
export async function runManualCheck(checkType: string): Promise<Finding[]> {
  const snapshot = await generateSystemSnapshot();

  switch (checkType) {
    case "automation":
      return checkAutomationRules(snapshot);
    case "performance":
      return checkPerformanceIssues(snapshot);
    case "unused":
      return checkUnusedFeatures(snapshot);
    case "anomalies":
      return checkDataAnomalies(snapshot);
    case "images":
      return checkImageOptimization(snapshot);
    case "behavior":
      return checkUserBehaviorPatterns(snapshot);
    default:
      return [];
  }
}

/**
 * Get recent suggestions for the admin panel
 */
export async function getRecentSuggestions(
  limit: number = 20,
  status?: string
): Promise<{
  id: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
  risk_level: string;
}[]> {
  const supabase = await createClient();

  try {
    let query = supabase
      .from("general_suggestions")
      .select("id, title, description, status, created_at, proposed_plan")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[ProactiveAgent] Failed to get suggestions:", error);
      return [];
    }

    return (data || []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      status: s.status,
      created_at: s.created_at,
      risk_level: (s.proposed_plan as { estimatedRisk?: string })?.estimatedRisk || "low",
    }));
  } catch (error) {
    console.error("[ProactiveAgent] Error getting suggestions:", error);
    return [];
  }
}
