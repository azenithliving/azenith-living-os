import { getSupabaseAdminClient } from "./supabase-admin";
import { getCurrentTenant } from "./tenant";

export interface AnalyticsMetrics {
  totalLeads: number;
  totalRequests: number;
  totalBookings: number;
  acceptedBookings: number;
  conversionRate: number;
  averageLeadScore: number;
  topRoomTypes: Array<{ type: string; count: number }>;
  topStyles: Array<{ style: string; count: number }>;
  eventBreakdown: Record<string, number>;
  whatsappClicks: number;
  uniqueVisitors: number;
}

export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
}

export async function getAnalyticsMetrics(period?: AnalyticsPeriod): Promise<AnalyticsMetrics> {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      throw new Error("Tenant not configured");
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');

    // Calculate date range
    const endDate = new Date();
    const startDate = period?.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

    // Get all metrics in parallel
    const [
      usersResult,
      requestsResult,
      bookingsResult,
      acceptedBookingsResult,
      eventsResult,
      leadScoresResult,
      roomTypesResult,
      stylesResult
    ] = await Promise.all([
      supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", tenant.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString()),

      supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", tenant.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString()),

      supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", tenant.id)
        .neq("status", "new"),

      supabase
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("company_id", tenant.id)
        .eq("status", "accepted"),

      supabase
        .from("events")
        .select("type")
        .eq("company_id", tenant.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString()),

      supabase
        .from("users")
        .select("score")
        .eq("company_id", tenant.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString()),

      supabase
        .from("users")
        .select("room_type")
        .eq("company_id", tenant.id)
        .not("room_type", "is", null),

      supabase
        .from("users")
        .select("style")
        .eq("company_id", tenant.id)
        .not("style", "is", null)
    ]);

    const totalLeads = usersResult.count || 0;
    const totalRequests = requestsResult.count || 0;
    const totalBookings = bookingsResult.count || 0;
    const acceptedBookings = acceptedBookingsResult.count || 0;

    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? (totalBookings / totalLeads) * 100 : 0;

    // Calculate average lead score
    const scores = leadScoresResult.data?.map(u => u.score || 0) || [];
    const averageLeadScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Calculate event breakdown
    const eventBreakdown: Record<string, number> = {};
    eventsResult.data?.forEach(event => {
      eventBreakdown[event.type] = (eventBreakdown[event.type] || 0) + 1;
    });

    const whatsappClicks = eventBreakdown["whatsapp_click"] || 0;

    // Get top room types
    const roomTypeMap: Record<string, number> = {};
    roomTypesResult.data?.forEach(user => {
      if (user.room_type) {
        roomTypeMap[user.room_type] = (roomTypeMap[user.room_type] || 0) + 1;
      }
    });

    const topRoomTypes = Object.entries(roomTypeMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type, count]) => ({ type, count }));

    // Get top styles
    const styleMap: Record<string, number> = {};
    stylesResult.data?.forEach(user => {
      if (user.style) {
        styleMap[user.style] = (styleMap[user.style] || 0) + 1;
      }
    });

    const topStyles = Object.entries(styleMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([style, count]) => ({ style, count }));

    // Get unique visitors (using distinct session IDs)
    const { data: uniqueVisitorsData } = await supabase
      .from("users")
      .select("session_id")
      .eq("company_id", tenant.id)
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    const uniqueVisitors = new Set(uniqueVisitorsData?.map(u => u.session_id) || []).size;

    return {
      totalLeads,
      totalRequests,
      totalBookings,
      acceptedBookings,
      conversionRate: Math.round(conversionRate * 100) / 100,
      averageLeadScore: Math.round(averageLeadScore * 100) / 100,
      topRoomTypes,
      topStyles,
      eventBreakdown,
      whatsappClicks,
      uniqueVisitors
    };
  } catch (error) {
    console.error("Failed to get analytics metrics:", error);
    throw error;
  }
}

export async function getTimeSeriesData(metric: "leads" | "bookings" | "conversions", days: number = 30) {
  try {
    const tenant = await getCurrentTenant();
    if (!tenant) {
      throw new Error("Tenant not configured");
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) throw new Error('Supabase not initialized');
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    if (metric === "leads") {
      const { data } = await supabase
        .from("users")
        .select("created_at")
        .eq("company_id", tenant.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      return aggregateByDay(data || [], "created_at");
    } else if (metric === "bookings") {
      const { data } = await supabase
        .from("requests")
        .select("created_at")
        .eq("company_id", tenant.id)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      return aggregateByDay(data || [], "created_at");
    } else if (metric === "conversions") {
      const { data } = await supabase
        .from("requests")
        .select("created_at")
        .eq("company_id", tenant.id)
        .eq("status", "accepted")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      return aggregateByDay(data || [], "created_at");
    }

    return [];
  } catch (error) {
    console.error("Failed to get time series data:", error);
    throw error;
  }
}

function aggregateByDay(items: Array<Record<string, unknown>>, dateField: string): Array<{ date: string; count: number }> {
  const aggregated: Record<string, number> = {};

  items.forEach(item => {
    const date = new Date(String(item[dateField])).toISOString().split("T")[0];
    aggregated[date] = (aggregated[date] || 0) + 1;
  });

  return Object.entries(aggregated)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, count]) => ({ date, count }));
}