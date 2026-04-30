import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { TenantRecord } from "@/lib/tenant";

export interface MasterDashboardSnapshot {
  // System overview
  totalTenants: number;
  totalLeads: number;
  totalRequests: number;
  totalBookings: number;
  totalSubscribers: number;
  totalWhatsAppClicks: number;

  // Activity (last 30 days)
  recentLeads: number;
  recentRequests: number;
  recentSubscribers: number;

  // Breakdowns
  tenants: TenantSummary[];
  topRoomTypes: Array<{ type: string; count: number }>;
  topStyles: Array<{ style: string; count: number }>;
  intentDistribution: Array<{ intent: string; count: number }>;
  recentActivity: ActivityItem[];
}

export interface TenantSummary {
  id: string;
  name: string;
  domain: string;
  whatsapp: string | null;
  leadCount: number;
  requestCount: number;
  bookingCount: number;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: "lead" | "request" | "booking" | "subscriber";
  tenantName: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: "active" | "unsubscribed" | "bounced" | "complained";
  createdAt: string;
  updatedAt: string;
  metadata: {
    source?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    subscribed_at?: string;
    resubscribed_at?: string;
  };
}

export interface FactoryStatus {
  totalRequests: number;
  byStatus: Record<string, number>;
  pendingPayment: number;
  inProduction: number;
  delivered: number;
  recentCompletions: Array<{
    requestId: string;
    tenantName: string;
    roomType: string;
    completedAt: string;
  }>;
}

/**
 * Get master dashboard snapshot - cross-tenant view
 */
export async function getMasterDashboardSnapshot(): Promise<MasterDashboardSnapshot> {
  const supabase = getSupabaseAdminClient();
  
  if (!supabase) {
    console.warn("[admin-data] Supabase not available, returning default snapshot");
    return {
      totalTenants: 0,
      totalLeads: 0,
      totalRequests: 0,
      totalBookings: 0,
      totalSubscribers: 0,
      totalWhatsAppClicks: 0,
      recentLeads: 0,
      recentRequests: 0,
      recentSubscribers: 0,
      tenants: [],
      topRoomTypes: [],
      topStyles: [],
      intentDistribution: [],
      recentActivity: [],
    };
  }

  // Get all tenants
  const { data: tenants } = await supabase
    .from("companies")
    .select("id, name, domain, whatsapp, created_at")
    .order("created_at", { ascending: false });

  // Get counts per tenant
  const tenantSummaries: TenantSummary[] = [];
  let totalLeads = 0;
  let totalRequests = 0;
  let totalBookings = 0;

  for (const tenant of tenants || []) {
    const [
      { count: leadCount },
      { count: requestCount },
      { count: bookingCount },
    ] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }).eq("company_id", tenant.id),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("company_id", tenant.id),
      supabase.from("requests").select("id", { count: "exact", head: true }).eq("company_id", tenant.id).neq("status", "new"),
    ]);

    tenantSummaries.push({
      id: tenant.id,
      name: tenant.name,
      domain: tenant.domain,
      whatsapp: tenant.whatsapp,
      leadCount: leadCount || 0,
      requestCount: requestCount || 0,
      bookingCount: bookingCount || 0,
      createdAt: tenant.created_at,
    });

    totalLeads += leadCount || 0;
    totalRequests += requestCount || 0;
    totalBookings += bookingCount || 0;
  }

  // Get newsletter subscribers count
  const { count: subscriberCount } = await supabase
    .from("newsletter_subscribers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Get WhatsApp clicks
  const { count: whatsappCount } = await supabase
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("type", "whatsapp_click");

  // Get recent activity (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    { count: recentLeads },
    { count: recentRequests },
    { count: recentSubscribers },
  ] = await Promise.all([
    supabase.from("users").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("requests").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo.toISOString()),
  ]);

  // Get top room types across all tenants
  const { data: roomTypes } = await supabase
    .from("users")
    .select("room_type")
    .not("room_type", "is", null);

  const roomTypeMap: Record<string, number> = {};
  roomTypes?.forEach((user) => {
    if (user.room_type) {
      roomTypeMap[user.room_type] = (roomTypeMap[user.room_type] || 0) + 1;
    }
  });

  const topRoomTypes = Object.entries(roomTypeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([type, count]) => ({ type, count }));

  // Get top styles
  const { data: styles } = await supabase
    .from("users")
    .select("style")
    .not("style", "is", null);

  const styleMap: Record<string, number> = {};
  styles?.forEach((user) => {
    if (user.style) {
      styleMap[user.style] = (styleMap[user.style] || 0) + 1;
    }
  });

  const topStyles = Object.entries(styleMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([style, count]) => ({ style, count }));

  // Get intent distribution
  const { data: intents } = await supabase.from("users").select("intent");

  const intentMap: Record<string, number> = {};
  intents?.forEach((user) => {
    const intent = user.intent || "browsing";
    intentMap[intent] = (intentMap[intent] || 0) + 1;
  });

  const intentDistribution = Object.entries(intentMap)
    .sort((a, b) => b[1] - a[1])
    .map(([intent, count]) => ({ intent, count }));

  // Build recent activity feed
  const recentActivity: ActivityItem[] = [];

  // Recent leads
  const { data: recentLeadsData } = await supabase
    .from("users")
    .select("id, company_id, room_type, service_type, created_at, intent")
    .order("created_at", { ascending: false })
    .limit(5);

  for (const lead of recentLeadsData || []) {
    const tenant = tenantSummaries.find((t) => t.id === lead.company_id);
    recentActivity.push({
      id: lead.id,
      type: "lead",
      tenantName: tenant?.name || "Unknown",
      description: `${lead.room_type || "Unknown room"} - ${lead.service_type || "Unknown service"} (${lead.intent || "browsing"})`,
      timestamp: lead.created_at,
    });
  }

  // Recent subscribers
  const { data: recentSubsData } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, created_at, metadata")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(5);

  for (const sub of recentSubsData || []) {
    recentActivity.push({
      id: sub.id,
      type: "subscriber",
      tenantName: "Newsletter",
      description: sub.email,
      timestamp: sub.created_at,
      metadata: sub.metadata,
    });
  }

  // Sort by timestamp
  recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    totalTenants: tenants?.length || 0,
    totalLeads,
    totalRequests,
    totalBookings,
    totalSubscribers: subscriberCount || 0,
    totalWhatsAppClicks: whatsappCount || 0,
    recentLeads: recentLeads || 0,
    recentRequests: recentRequests || 0,
    recentSubscribers: recentSubscribers || 0,
    tenants: tenantSummaries,
    topRoomTypes,
    topStyles,
    intentDistribution,
    recentActivity: recentActivity.slice(0, 10),
  };
}

/**
 * Get all newsletter subscribers
 */
export async function getAllSubscribers(limit = 100, offset = 0): Promise<NewsletterSubscriber[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("newsletter_subscribers")
    .select("id, email, status, created_at, updated_at, metadata")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return (data || []).map((row) => ({
    id: row.id,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata || {},
  }));
}

/**
 * Get factory/production status across all tenants
 */
export async function getFactoryStatus(): Promise<FactoryStatus> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      totalRequests: 0,
      byStatus: {},
      pendingPayment: 0,
      inProduction: 0,
      delivered: 0,
      recentCompletions: [],
    };
  }

  // Get all requests with their status
  const { data: requests } = await supabase
    .from("requests")
    .select("id, company_id, room_type, status, updated_at")
    .order("updated_at", { ascending: false });

  const byStatus: Record<string, number> = {};
  let pendingPayment = 0;
  let inProduction = 0;
  let delivered = 0;

  for (const req of requests || []) {
    byStatus[req.status] = (byStatus[req.status] || 0) + 1;

    if (req.status === "pending_payment") pendingPayment++;
    if (["in_production", "manufacturing", "sourcing"].includes(req.status)) inProduction++;
    if (req.status === "delivered") delivered++;
  }

  // Get recent completions (delivered in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: completed } = await supabase
    .from("requests")
    .select("id, company_id, room_type, updated_at")
    .eq("status", "delivered")
    .gte("updated_at", thirtyDaysAgo.toISOString())
    .order("updated_at", { ascending: false })
    .limit(10);

  // Get tenant names for completions
  const { data: companies } = await supabase.from("companies").select("id, name");
  const companyMap = new Map(companies?.map((c) => [c.id, c.name]));

  const recentCompletions = (completed || []).map((req) => ({
    requestId: req.id,
    tenantName: companyMap.get(req.company_id) || "Unknown",
    roomType: req.room_type || "Unknown",
    completedAt: req.updated_at,
  }));

  return {
    totalRequests: requests?.length || 0,
    byStatus,
    pendingPayment,
    inProduction,
    delivered,
    recentCompletions,
  };
}

/**
 * Get leads for a specific tenant (or all if tenantId is null)
 */
export async function getLeads(tenantId?: string, limit = 50): Promise<Array<{
  id: string;
  tenantName: string;
  sessionId: string;
  score: number;
  intent: string;
  roomType: string;
  budget: string;
  style: string;
  serviceType: string;
  createdAt: string;
}>> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  let query = supabase
    .from("users")
    .select("id, company_id, session_id, score, intent, room_type, budget, style, service_type, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tenantId) {
    query = query.eq("company_id", tenantId);
  }

  const { data } = await query;

  // Get tenant names
  const { data: companies } = await supabase.from("companies").select("id, name");
  const companyMap = new Map(companies?.map((c) => [c.id, c.name]));

  return (data || []).map((lead) => ({
    id: lead.id,
    tenantName: companyMap.get(lead.company_id) || "Unknown",
    sessionId: lead.session_id,
    score: lead.score,
    intent: lead.intent,
    roomType: lead.room_type || "Unknown",
    budget: lead.budget || "Unknown",
    style: lead.style || "Unknown",
    serviceType: lead.service_type || "Unknown",
    createdAt: lead.created_at,
  }));
}
