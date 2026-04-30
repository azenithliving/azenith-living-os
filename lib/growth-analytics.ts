"use server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { askOpenRouter } from "@/lib/ai-orchestrator";
import type { WeeklyReport } from "@/components/admin/GrowthInsights";

/**
 * Growth Analytics Engine
 * Analyzes lead dossiers and Style DNA trends for CEO AI insights
 */

const DAYS_TO_ANALYZE = 7;

/**
 * Generate weekly growth report
 */
export async function generateWeeklyReport(): Promise<WeeklyReport | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error('Supabase not initialized');
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - DAYS_TO_ANALYZE);
  
  try {
    // Fetch leads from last 7 days
    const { data: leads, error: leadsError } = await supabase
      .from("users")
      .select("*, requests(*)")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .order("created_at", { ascending: false });

    if (leadsError) {
      console.error("[GrowthAnalytics] Failed to fetch leads:", leadsError);
      return null;
    }

    if (!leads || leads.length === 0) {
      return generateEmptyReport(startDate, endDate);
    }

    // Calculate summary metrics
    const typedLeads = leads as Array<{ score?: number; room_type?: string; budget?: string; full_name?: string; phone?: string }>;
    const diamondLeads = typedLeads.filter((l) => (l.score || 0) >= 60).length;
    const avgScore = typedLeads.reduce((acc, l) => acc + (l.score || 0), 0) / leads.length;
    
    // Get room type distribution
    const roomTypes: Record<string, number> = {};
    leads.forEach((l) => {
      const type = l.room_type || "Unknown";
      roomTypes[type] = (roomTypes[type] || 0) + 1;
    });
    const topRoomType = Object.entries(roomTypes)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "Not determined";

    // Get budget distribution
    const budgets = leads
      .map((l) => l.budget)
      .filter((b): b is string => !!b)
      .map(parseBudgetValue)
      .filter((b): b is number => b !== null);
    
    const avgDealSize = budgets.length > 0 
      ? budgets.reduce((a, b) => a + b, 0) / budgets.length 
      : 0;

    // Analyze Style DNA from recent leads
    const styleAnalysis = await analyzeStyleTrends(leads);

    // Identify conversion bottlenecks
    const bottlenecks = analyzeBottlenecks(leads);

    // Generate AI business advice
    const advice = await generateBusinessAdvice({
      totalLeads: leads.length,
      diamondLeads,
      topRoomType,
      avgDealSize,
      styleTrends: styleAnalysis.trends,
    });

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      summary: {
        totalLeads: leads.length,
        diamondLeads,
        conversionRate: calculateConversionRate(leads),
        avgDealSize,
        topRoomType,
      },
      trends: styleAnalysis.trends,
      bottlenecks,
      advice,
      styleDNAAnalysis: {
        dominantStyles: styleAnalysis.dominantStyles,
        colorTrends: styleAnalysis.colorTrends,
        materialPreferences: styleAnalysis.materials,
      },
    };

  } catch (error) {
    console.error("[GrowthAnalytics] Error generating report:", error);
    return null;
  }
}

/**
 * Parse budget string to numeric value
 */
function parseBudgetValue(budget: string): number | null {
  // Handle formats like "150,000 - 300,000 EGP" or "300,000+"
  const match = budget.match(/([\d,]+)/);
  if (match) {
    return parseInt(match[1].replace(/,/g, ""), 10);
  }
  return null;
}

/**
 * Calculate conversion rate from leads
 */
function calculateConversionRate(leads: unknown[]): number {
  // Simplified: leads with high scores considered "converted"
  const typedLeads = leads as Array<{ score?: number }>;
  const highIntent = typedLeads.filter((l) => (l.score || 0) >= 50).length;
  return leads.length > 0 ? highIntent / leads.length : 0;
}

/**
 * Analyze Style DNA trends from lead data
 */
async function analyzeStyleTrends(leads: unknown[]) {
  // Extract all style references
  const styles: Record<string, { count: number; budgets: number[] }> = {};
  const colors: Record<string, number> = {};
  const materials: Record<string, number> = {};

  (leads as Array<{
    style?: string;
    budget?: string;
    special_requests?: string;
    requests?: Array<{ quote_snapshot?: Record<string, unknown> }>;
  }>).forEach((lead) => {
    // Parse style from lead data
    const styleList = lead.style?.split(",").map((s) => s.trim()) || ["modern"];
    const budgetValue = parseBudgetValue(lead.budget || "") || 0;

    styleList.forEach((s) => {
      if (!styles[s]) styles[s] = { count: 0, budgets: [] };
      styles[s].count++;
      styles[s].budgets.push(budgetValue);
    });

    // Extract color preferences from special requests
    const requestText = `${lead.special_requests || ""} ${JSON.stringify(lead.requests || [])}`;
    const colorMatches = requestText.match(/\b(white|black|beige|gold|gray|navy|cream|marble|wood|oak|walnut)\b/gi);
    colorMatches?.forEach((c) => {
      const color = c.toLowerCase();
      colors[color] = (colors[color] || 0) + 1;
    });

    // Material preferences
    const materialMatches = requestText.match(/\b(marble|wood|glass|metal|brass|chrome|velvet|leather|linen)\b/gi);
    materialMatches?.forEach((m) => {
      const material = m.toLowerCase();
      materials[material] = (materials[material] || 0) + 1;
    });
  });

  // Convert to trend format
  const totalLeads = leads.length;
  const trends = Object.entries(styles)
    .map(([style, data]) => ({
      style,
      mentions: data.count,
      growth: Math.round((data.count / totalLeads) * 100),
      relatedColors: Object.entries(colors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([c]) => c),
      avgBudget: data.budgets.length > 0 
        ? data.budgets.reduce((a, b) => a + b, 0) / data.budgets.length 
        : 0,
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 5);

  return {
    trends,
    dominantStyles: Object.entries(styles)
      .map(([style, data]) => ({
        style,
        percentage: Math.round((data.count / totalLeads) * 100),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5),
    colorTrends: Object.entries(colors)
      .map(([color, frequency]) => ({ color, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8),
    materials: Object.entries(materials)
      .map(([material, count]) => ({ material, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
  };
}

/**
 * Analyze conversion bottlenecks
 */
function analyzeBottlenecks(leads: unknown[]): WeeklyReport["bottlenecks"] {
  const bottlenecks: WeeklyReport["bottlenecks"] = [];

  // Check for abandonment at contact stage
  const incompleteContacts = (leads as Array<{ full_name?: string; phone?: string }>).filter(
    (l) => !l.full_name || !l.phone
  ).length;

  if (incompleteContacts > 0) {
    const rate = Math.round((incompleteContacts / leads.length) * 100);
    bottlenecks.push({
      stage: "Contact Information",
      dropoffRate: rate,
      impact: rate > 30 ? "high" : rate > 15 ? "medium" : "low",
      suggestion: "Consider simplifying contact form or adding WhatsApp quick-fill option",
    });
  }

  // Check for low-scoring leads (indicating weak qualification)
  const lowScoreLeads = (leads as Array<{ score?: number }>).filter((l) => (l.score || 0) < 30).length;
  if (lowScoreLeads > leads.length * 0.4) {
    bottlenecks.push({
      stage: "Lead Qualification",
      dropoffRate: Math.round((lowScoreLeads / leads.length) * 100),
      impact: "high",
      suggestion: "High % of low-intent leads. Review ad targeting or landing page messaging.",
    });
  }

  // Check budget specification rate
  const noBudget = (leads as Array<{ budget?: string }>).filter((l) => !l.budget).length;
  if (noBudget > 0) {
    bottlenecks.push({
      stage: "Budget Selection",
      dropoffRate: Math.round((noBudget / leads.length) * 100),
      impact: noBudget > leads.length * 0.3 ? "high" : "medium",
      suggestion: "Add investment bracket guidance earlier in the flow",
    });
  }

  return bottlenecks.sort((a, b) => b.dropoffRate - a.dropoffRate).slice(0, 4);
}

/**
 * Generate AI-powered business advice
 */
async function generateBusinessAdvice(context: {
  totalLeads: number;
  diamondLeads: number;
  topRoomType: string;
  avgDealSize: number;
  styleTrends: Array<{ style: string; mentions: number; avgBudget: number }>;
}): Promise<WeeklyReport["advice"]> {
  const prompt = `As a business strategist for Azenith Living, a luxury interior design firm in Egypt, analyze this week's data and provide 3-4 actionable business recommendations.

WEEKLY DATA:
- Total Leads: ${context.totalLeads}
- Diamond Leads (high-value): ${context.diamondLeads}
- Top Requested Room: ${context.topRoomType}
- Average Deal Size: ${context.avgDealSize.toLocaleString()} EGP
- Style Trends: ${context.styleTrends.map(s => `${s.style} (${s.mentions} leads, avg ${s.avgBudget.toLocaleString()} EGP)`).join("; ")}

OUTPUT FORMAT (JSON):
[
  {
    "category": "focus" | "expand" | "optimize" | "urgent",
    "title": "Brief actionable title",
    "description": "2-3 sentences explaining the recommendation and why it matters",
    "expectedImpact": "Expected business outcome",
    "confidence": 85
  }
]

Guidelines:
- Focus on practical, data-driven recommendations
- Consider Egyptian luxury market context
- Prioritize high-ROI actions
- Confidence should reflect data quality

Return ONLY valid JSON array.`;

  try {
    const result = await askOpenRouter(prompt, undefined, {
      model: "anthropic/claude-3.5-sonnet",
      temperature: 0.4,
      maxTokens: 800,
    });

    if (!result.success) {
      return generateDefaultAdvice(context);
    }

    const cleaned = result.content.replace(/```json\n?|```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: { category?: "focus" | "expand" | "optimize" | "urgent"; title?: string; description?: string; expectedImpact?: string; confidence?: number }) => ({
        category: item.category || "focus" as const,
        title: item.title || "Recommendation",
        description: item.description || "",
        expectedImpact: item.expectedImpact || "",
        confidence: item.confidence || 70,
      })) as WeeklyReport["advice"];
    }
  } catch (error) {
    console.error("[GrowthAnalytics] Failed to parse AI advice:", error);
  }

  return generateDefaultAdvice(context);
}

/**
 * Generate default advice when AI fails
 */
function generateDefaultAdvice(context: {
  totalLeads: number;
  diamondLeads: number;
  topRoomType: string;
}): WeeklyReport["advice"] {
  const advice: WeeklyReport["advice"] = [];

  if (context.diamondLeads >= 5) {
    advice.push({
      category: "focus" as const,
      title: "Prioritize Diamond Lead Follow-up",
      description: `${context.diamondLeads} high-value leads this week. Ensure immediate personal outreach within 24 hours.`,
      expectedImpact: "20-30% higher conversion on premium projects",
      confidence: 90,
    });
  }

  if (context.topRoomType) {
    advice.push({
      category: "focus" as const,
      title: `Capitalize on ${context.topRoomType} Demand`,
      description: `${context.topRoomType} is trending. Prepare specialized portfolio samples and targeted marketing.`,
      expectedImpact: "15% increase in qualified inquiries for this category",
      confidence: 85,
    });
  }

  if (context.totalLeads < 10) {
    advice.push({
      category: "urgent" as const,
      title: "Lead Volume Below Target",
      description: "Lead acquisition is lower than optimal. Review ad spend and organic reach strategies.",
      expectedImpact: "Restore lead flow to 15+ weekly minimum",
      confidence: 80,
    });
  }

  return advice;
}

/**
 * Generate empty report when no data
 */
function generateEmptyReport(startDate: Date, endDate: Date): WeeklyReport {
  return {
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    summary: {
      totalLeads: 0,
      diamondLeads: 0,
      conversionRate: 0,
      avgDealSize: 0,
      topRoomType: "No data",
    },
    trends: [],
    bottlenecks: [],
    advice: [{
      category: "urgent",
      title: "No Lead Data Available",
      description: "Start collecting lead data to generate meaningful insights. Check tracking implementation.",
      expectedImpact: "Enable data-driven decisions",
      confidence: 100,
    }],
    styleDNAAnalysis: {
      dominantStyles: [],
      colorTrends: [],
      materialPreferences: [],
    },
  };
}
