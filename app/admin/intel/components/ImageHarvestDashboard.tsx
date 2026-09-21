"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Database, Image, Loader2, Play, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DistributionEntry = {
  room_type: string;
  style: string;
  active_count: number;
};

type RefreshLog = {
  id: string;
  status: string;
  duration_minutes: number | null;
  images_before: number | null;
  images_after: number | null;
  created_at: string;
};

type DashboardData = {
  success: boolean;
  stats: { total: number; distribution: DistributionEntry[] };
  recentRefreshes: RefreshLog[];
  warnings: string[];
  retrievedAt: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("ar-EG");
}

export function ImageHarvestDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/images/stats", { cache: "no-store" });
      const result = await response.json() as DashboardData & { error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر تحميل مكتبة الصور.");
      setData(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر تحميل مكتبة الصور.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  async function triggerHarvest() {
    setTriggering(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/images/trigger-harvest", { method: "POST" });
      const result = await response.json() as { success?: boolean; message?: string; error?: string };
      if (!response.ok || !result.success) throw new Error(result.error || "تعذر طلب تشغيل الحصاد.");
      setNotice(result.message || "تم قبول طلب التشغيل.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "تعذر طلب تشغيل الحصاد.");
    } finally {
      setTriggering(false);
    }
  }

  const byRoom = useMemo(() => {
    const groups = new Map<string, number>();
    for (const entry of data?.stats.distribution ?? []) {
      groups.set(entry.room_type, (groups.get(entry.room_type) ?? 0) + entry.active_count);
    }
    return [...groups.entries()].sort(([, left], [, right]) => right - left);
  }, [data]);

  const byStyle = useMemo(() => {
    const groups = new Map<string, number>();
    for (const entry of data?.stats.distribution ?? []) {
      groups.set(entry.style, (groups.get(entry.style) ?? 0) + entry.active_count);
    }
    return [...groups.entries()].sort(([, left], [, right]) => right - left);
  }, [data]);

  if (loading) {
    return <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">مكتبة الصور المنسقة</h2>
          <p className="mt-1 text-sm text-muted-foreground">تعرض هذه اللوحة الصفوف النشطة الموجودة حاليًا في قاعدة البيانات فقط.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchStats()} disabled={refreshing}>
            {refreshing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />} تحديث
          </Button>
          <Button size="sm" onClick={() => void triggerHarvest()} disabled={triggering}>
            {triggering ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Play className="ml-2 h-4 w-4" />} طلب تشغيل الحصاد
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200">{error}</div>}
      {notice && <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-800 dark:text-green-200">{notice}</div>}
      {(data?.warnings ?? []).map((warning) => <div key={warning} className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">{warning}</div>)}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">الصور النشطة</CardTitle><Image className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.stats.total.toLocaleString() ?? "—"}</div><p className="mt-1 text-xs text-muted-foreground">عدد فعلي لحظة آخر قراءة.</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">تصنيفات مسجلة</CardTitle><Database className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.stats.distribution.length ?? "—"}</div><p className="mt-1 text-xs text-muted-foreground">تركيبات الغرفة والطراز الموجودة فعليًا.</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>التوزيع حسب الغرفة</CardTitle></CardHeader>
        <CardContent>{byRoom.length ? <div className="flex flex-wrap gap-3">{byRoom.map(([room, count]) => <Badge key={room} variant="secondary">{room}: {count.toLocaleString()}</Badge>)}</div> : <p className="text-center text-sm text-muted-foreground">لا توجد صور نشطة لتجميعها.</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>التوزيع حسب الطراز</CardTitle></CardHeader>
        <CardContent>{byStyle.length ? <div className="flex flex-wrap gap-3">{byStyle.map(([style, count]) => <Badge key={style} variant="secondary">{style}: {count.toLocaleString()}</Badge>)}</div> : <p className="text-center text-sm text-muted-foreground">لا توجد صور نشطة لتجميعها.</p>}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>سجل الحصاد</CardTitle></CardHeader>
        <CardContent>{data?.recentRefreshes.length ? <div className="space-y-2">{data.recentRefreshes.map((log) => <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"><div className="flex items-center gap-3">{log.status === "success" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}<div><p className="font-medium">{log.status}</p><p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p></div></div><p className="text-sm text-muted-foreground">{log.images_before ?? "—"} ← {log.images_after ?? "—"}{log.duration_minutes !== null ? ` · ${log.duration_minutes} د` : ""}</p></div>)}</div> : <p className="text-center text-sm text-muted-foreground">لا يوجد سجل حصاد متاح.</p>}</CardContent>
      </Card>

      <p className="text-left text-xs text-muted-foreground">آخر قراءة: {data?.retrievedAt ? formatDate(data.retrievedAt) : "—"}</p>
    </div>
  );
}
