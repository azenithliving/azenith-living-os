"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  RefreshCw, 
  Image, 
  Database, 
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play
} from "lucide-react";

interface HarvestStats {
  total: number;
  target: number;
  percentage: number;
  distribution: Array<{
    room_type: string;
    style: string;
    active_count: number;
    total_count: number;
  }>;
}

interface RefreshLog {
  id: string;
  status: string;
  duration_minutes: number;
  images_before: number;
  images_after: number;
  created_at: string;
}

interface DashboardData {
  stats: HarvestStats;
  recentRefreshes: RefreshLog[];
  lastUpdated: string;
}

export function ImageHarvestDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch stats on mount and every 30 seconds
  useEffect(() => {
    fetchStats();
    
    // Auto-refresh interval (every 30 seconds)
    const interval = setInterval(() => {
      fetchStats();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      setRefreshing(true);
      const response = await fetch("/api/admin/images/stats");
      const result = await response.json();
      
      if (result.success) {
        setData(result);
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function triggerHarvest() {
    try {
      setTriggering(true);
      setMessage(null);

      const response = await fetch("/api/admin/images/trigger-harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetCount: 15000 }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage("✅ Harvest triggered! Check back in 2-4 hours.");
      } else {
        setMessage("❌ Failed to trigger harvest: " + result.error);
      }
    } catch (error) {
      setMessage("❌ Error: " + (error as Error).message);
    } finally {
      setTriggering(false);
    }
  }

  // Group distribution by room
  const roomDistribution = data?.stats.distribution.reduce((acc, item) => {
    const room = item.room_type;
    if (!acc[room]) acc[room] = 0;
    acc[room] += item.active_count;
    return acc;
  }, {} as Record<string, number>) || {};

  // Calculate style distribution
  const styleDistribution = data?.stats.distribution.reduce((acc, item) => {
    const style = item.style;
    if (!acc[style]) acc[style] = 0;
    acc[style] += item.active_count;
    return acc;
  }, {} as Record<string, number>) || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Image Harvest Dashboard</h2>
          <p className="text-muted-foreground">
            15,000 Elite Images | Auto-Refresh Monthly
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={triggerHarvest}
            disabled={triggering || data?.stats.percentage === 100}
          >
            {triggering ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {triggering ? "Running..." : "Run Harvest"}
          </Button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.includes("✅") ? "bg-green-100" : "bg-red-100"}`}>
          <p className={message.includes("✅") ? "text-green-800" : "text-red-800"}>
            {message}
          </p>
        </div>
      )}

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.stats.total.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              of {data?.stats.target.toLocaleString()} target
            </p>
            <Progress 
              value={data?.stats.percentage || 0} 
              className="mt-2"
            />
            <p className="text-xs text-right mt-1">
              {data?.stats.percentage}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">URL-Only</div>
            <p className="text-xs text-muted-foreground">
              CDN Optimized for millions
            </p>
            <Badge variant="outline" className="mt-2">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Zero Server Storage
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Refresh</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">30 Days</div>
            <p className="text-xs text-muted-foreground">
              Auto-delete 20% + Add fresh
            </p>
            <Badge variant="outline" className="mt-2">
              <TrendingUp className="w-3 h-3 mr-1" />
              Monthly Cycle
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Distribution by Room */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution by Room</CardTitle>
          <p className="text-sm text-muted-foreground">
            Equal distribution: ~1,500 images per room
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(roomDistribution).map(([room, count]) => {
              const target = 1500;
              const percentage = Math.round((count / target) * 100);
              
              return (
                <div key={room} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{room.replace("-", " ")}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {percentage}% of target
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Distribution by Style */}
      <Card>
        <CardHeader>
          <CardTitle>Distribution by Style</CardTitle>
          <p className="text-sm text-muted-foreground">
            Equal across all styles
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            {Object.entries(styleDistribution).map(([style, count]) => (
              <div key={style} className="flex items-center gap-2">
                <Badge variant="secondary" className="capitalize">
                  {style}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {count} images
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Refreshes */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Refresh History</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recentRefreshes && data.recentRefreshes.length > 0 ? (
            <div className="space-y-2">
              {data.recentRefreshes.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {log.status === "success" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">
                        {log.status === "success" ? "Refresh Completed" : "Refresh Failed"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p>{log.images_before.toLocaleString()} → {log.images_after.toLocaleString()}</p>
                    <p className="text-muted-foreground">{log.duration_minutes} min</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No refresh history yet
            </p>
          )}
        </CardContent>
      </Card>

      {/* Last Updated */}
      <p className="text-xs text-muted-foreground text-right">
        Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "Never"}
      </p>
    </div>
  );
}
