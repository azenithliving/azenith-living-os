"use client";

/**
 * Proactive Dashboard Component
 *
 * Real-time dashboard showing agent status, predictions, 
 * opportunities, and anomalies with one-click actions
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Target,
  Shield,
  Activity,
  Users,
  DollarSign,
  Sparkles,
  RefreshCw,
  ChevronRight,
  Play,
  Bell
} from "lucide-react";

interface DashboardData {
  status: {
    isActive: boolean;
    mode: string;
    actionsToday: number;
    pendingApprovals: number;
    goalsActive: number;
  };
  metrics: {
    visitors: { total: number; trend: "up" | "down" | "stable" };
    conversions: { total: number; rate: number };
    inquiries: number;
    performance: { avgPageLoad: number; bounceRate: number };
  };
  anomalies: Array<{
    metric: string;
    severity: string;
    deviation: number;
    suggestedAction?: string;
  }>;
  opportunities: Array<{
    id: string;
    title: string;
    impact: string;
    effort: string;
    estimatedRoi?: number;
    category: string;
  }>;
  security: {
    pendingApprovals: number;
    criticalActionsToday: number;
  };
}

const REFRESH_INTERVAL = 60000; // 1 minute

export function ProactiveDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("overview");

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [
        statusRes,
        metricsRes,
        anomaliesRes,
        opportunitiesRes,
        securityRes,
      ] = await Promise.all([
        fetch("/api/admin/agent/ultimate?action=status"),
        fetch("/api/admin/agent/ultimate?action=metrics"),
        fetch("/api/admin/agent/ultimate?action=anomalies"),
        fetch("/api/admin/agent/ultimate?action=opportunities"),
        fetch("/api/admin/agent/ultimate?action=security"),
      ]);

      const [status, metrics, anomalies, opportunities, security] = await Promise.all([
        statusRes.json(),
        metricsRes.json(),
        anomaliesRes.json(),
        opportunitiesRes.json(),
        securityRes.json(),
      ]);

      setData({
        status: status.status,
        metrics: metrics.snapshot || {
          visitors: { total: 0, trend: "stable" },
          conversions: { total: 0, rate: 0 },
          inquiries: 0,
          performance: { avgPageLoad: 0, bounceRate: 0 },
        },
        anomalies: anomalies.anomalies || [],
        opportunities: opportunities.opportunities || [],
        security: security.stats || { pendingApprovals: 0, criticalActionsToday: 0 },
      });
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const runProactiveCheck = async () => {
    try {
      const response = await fetch("/api/admin/agent/ultimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "proactive_check",
          payload: {},
        }),
      });
      const data = await response.json();
      if (data.success) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error("Failed to run proactive check:", error);
    }
  };

  // Execute opportunity action
  const executeOpportunity = async (opportunityId: string) => {
    try {
      const response = await fetch("/api/admin/agent/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: "execute_opportunity",
          params: { opportunityId },
        }),
      });
      const result = await response.json();
      if (result.success) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error("Failed to execute opportunity:", error);
    }
  };

  // Schedule opportunity reminder
  const scheduleOpportunity = async (opportunityId: string, type: string) => {
    try {
      const response = await fetch("/api/admin/agent/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Review opportunity: ${opportunityId}`,
          description: `Reminder to review opportunity ${opportunityId}`,
          priority: "normal",
          metadata: { opportunityId, type },
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert("تم جدولة التذكير");
      }
    } catch (error) {
      console.error("Failed to schedule opportunity:", error);
    }
  };

  // Execute anomaly fix
  const executeFix = async (anomalyIdx: number) => {
    try {
      const anomaly = data?.anomalies[anomalyIdx];
      if (!anomaly) return;

      const response = await fetch("/api/admin/agent/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolName: "system_health_check",
          params: { 
            deepCheck: true, 
            includeRecommendations: true,
            targetMetric: anomaly.metric,
          },
        }),
      });
      const result = await response.json();
      if (result.success) {
        fetchDashboardData();
      }
    } catch (error) {
      console.error("Failed to execute fix:", error);
    }
  };

  // Dismiss anomaly
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Parameter reserved for future use
  const dismissAnomaly = async (_anomalyIdx: number) => {
    try {
      // In a real implementation, this would mark the anomaly as dismissed
      // For now, we'll just refresh the data
      fetchDashboardData();
    } catch (error) {
      console.error("Failed to dismiss anomaly:", error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      default: return "bg-blue-500";
    }
  };

  const getImpactBadge = (impact: string) => {
    switch (impact) {
      case "transformative": return <Badge className="bg-purple-500">تحويلي</Badge>;
      case "high": return <Badge className="bg-green-500">عالي</Badge>;
      case "medium": return <Badge variant="secondary">متوسط</Badge>;
      default: return <Badge variant="outline">منخفض</Badge>;
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">لوحة التحكم الاستباقية</h2>
          <p className="text-muted-foreground">
            آخر تحديث: {lastRefresh.toLocaleTimeString("ar-SA")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button
            size="sm"
            onClick={runProactiveCheck}
            disabled={loading}
          >
            <Zap className="h-4 w-4 mr-2" />
            فحص فوري
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>حالة الوكيل</CardDescription>
            <div className="flex items-center gap-2">
              {data?.status.isActive ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <CardTitle className="text-lg text-green-600">نشط</CardTitle>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <CardTitle className="text-lg text-red-600">متوقف</CardTitle>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data?.status.mode === "active" ? "الوضع الاستباقي" : "الوضع اليدوي"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>الزوار اليوم</CardDescription>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-2xl">
                {data?.metrics.visitors.total.toLocaleString() || 0}
              </CardTitle>
              {data?.metrics.visitors.trend === "up" && (
                <TrendingUp className="h-4 w-4 text-green-500" />
              )}
              {data?.metrics.visitors.trend === "down" && (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              معدل التحويل: {((data?.metrics.conversions.rate || 0) * 100).toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>التحويلات</CardDescription>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <CardTitle className="text-2xl">
                {data?.metrics.conversions.total || 0}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data?.metrics.inquiries || 0} استفسار جديد
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>موافقات معلقة</CardDescription>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-2xl">
                {data?.security.pendingApprovals || 0}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data?.security.criticalActionsToday || 0} إجراء حرج اليوم
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:max-w-[600px]">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="opportunities">
            الفرص
            {data?.opportunities && data.opportunities.length > 0 && (
              <Badge variant="secondary" className="mr-2">
                {data.opportunities.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="anomalies">
            الشذوذ
            {data?.anomalies && data.anomalies.length > 0 && (
              <Badge variant="destructive" className="mr-2">
                {data.anomalies.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="goals">الأهداف</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  أداء الموقع
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">سرعة التحميل</span>
                    <span className="text-sm font-medium">
                      {data?.metrics.performance.avgPageLoad.toFixed(2)}s
                    </span>
                  </div>
                  <Progress 
                    value={Math.max(0, Math.min(100, (3 - (data?.metrics.performance?.avgPageLoad || 0)) / 3 * 100))} 
                    className={(data?.metrics.performance?.avgPageLoad || 0) > 2.5 ? "bg-red-200" : ""}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm">معدل الارتداد</span>
                    <span className="text-sm font-medium">
                      {((data?.metrics.performance.bounceRate || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.max(0, Math.min(100, (1 - (data?.metrics.performance.bounceRate || 0)) * 100))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  إجراءات سريعة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  onClick={() => setActiveTab("opportunities")}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    عرض الفرص المتاحة
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  onClick={() => setActiveTab("anomalies")}
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    مراجعة الشذوذ
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  onClick={runProactiveCheck}
                >
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    فحص شامل للنظام
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4">
          {data?.opportunities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">لا توجد فرص جديدة حالياً</p>
              </CardContent>
            </Card>
          ) : (
            data?.opportunities.map((opp) => (
              <Card key={opp.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{opp.title}</CardTitle>
                    </div>
                    {getImpactBadge(opp.impact)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      الجهد: {opp.effort}
                    </span>
                    {opp.estimatedRoi && (
                      <span className="flex items-center gap-1 text-green-600">
                        <DollarSign className="h-4 w-4" />
                        عائد متوقع: {opp.estimatedRoi.toLocaleString()} درهم
                      </span>
                    )}
                    <Badge variant="outline">{opp.category}</Badge>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm"
                      onClick={() => executeOpportunity(opp.id)}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      نفذ الآن
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => scheduleOpportunity(opp.id, 'reminder')}
                    >
                      <Bell className="h-4 w-4 mr-2" />
                      ذكرني لاحقاً
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-4">
          {data?.anomalies.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <p className="text-muted-foreground">لا يوجد شذوذ - النظام يعمل بشكل طبيعي</p>
              </CardContent>
            </Card>
          ) : (
            data?.anomalies.map((anomaly, idx) => (
              <Card key={idx} className="border-l-4" style={{ borderLeftColor: getSeverityColor(anomaly.severity) }}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <CardTitle className="text-lg">{anomaly.metric}</CardTitle>
                    </div>
                    <Badge className={getSeverityColor(anomaly.severity)}>
                      {anomaly.severity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm mb-2">
                    الانحراف: {(anomaly.deviation * 100).toFixed(1)}%
                  </p>
                  {anomaly.suggestedAction && (
                    <div className="bg-muted rounded p-3 mt-2">
                      <p className="text-sm font-medium">الإجراء المقترح:</p>
                      <p className="text-sm">{anomaly.suggestedAction}</p>
                    </div>
                  )}
                  <div className="mt-4 flex gap-2">
                    <Button 
                      size="sm"
                      onClick={() => executeFix(idx)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      تنفيذ الإصلاح
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => dismissAnomaly(idx)}
                    >
                      تجاهل
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="goals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5" />
                الأهداف النشطة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  لديك {data?.status.goalsActive || 0} هدف نشط
                </p>
                <Button>
                  <Sparkles className="h-4 w-4 mr-2" />
                  إنشاء هدف جديد
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
