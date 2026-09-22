"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Database, Image, Loader2, Play, RefreshCw, Key, X, ExternalLink, ShieldCheck } from "lucide-react";

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

  // GitHub Actions workflow configuration state
  const [workflowStatus, setWorkflowStatus] = useState<{
    workflowConfigured: boolean;
    repository: string;
    workflow: string;
    workflowUrl?: string | null;
    runsUrl?: string | null;
  } | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [inputToken, setInputToken] = useState("");
  const [saveTokenPermanently, setSaveTokenPermanently] = useState(true);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [statsRes, harvestRes] = await Promise.all([
        fetch("/api/admin/images/stats", { cache: "no-store" }),
        fetch("/api/admin/images/trigger-harvest", { cache: "no-store" }),
      ]);

      const result = (await statsRes.json()) as DashboardData & { error?: string };
      if (!statsRes.ok || !result.success) throw new Error(result.error || "تعذر تحميل مكتبة الصور.");
      setData(result);

      if (harvestRes.ok) {
        const hJson = await harvestRes.json();
        if (hJson.status) {
          setWorkflowStatus(hJson.status);
        }
      }
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

  async function triggerHarvest(tokenToUse?: string) {
    // If not configured and no token passed, open configuration dialog
    if (!workflowStatus?.workflowConfigured && !tokenToUse) {
      setShowTokenModal(true);
      return;
    }

    setTriggering(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/images/trigger-harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenToUse,
          saveToken: saveTokenPermanently,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        needsToken?: boolean;
        runsUrl?: string;
        workflowUrl?: string;
      };
      if (!response.ok || !result.success) {
        if (result.needsToken) {
          setShowTokenModal(true);
        }
        throw new Error(result.error || "تعذر طلب تشغيل الحصاد.");
      }
      setNotice(result.message || "تم قبول طلب التشغيل.");
      setShowTokenModal(false);
      setInputToken("");
      setWorkflowStatus((prev) =>
        prev
          ? { ...prev, workflowConfigured: true, runsUrl: result.runsUrl || prev.runsUrl }
          : {
              workflowConfigured: true,
              repository: "azenithliving/azenith-living-os",
              workflow: "run-harvester.yml",
              runsUrl: result.runsUrl,
              workflowUrl: result.workflowUrl,
            }
      );
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
          {workflowStatus?.runsUrl && (
            <a
              href={workflowStatus.runsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white transition"
            >
              <span>سجلات GitHub Actions</span>
              <ExternalLink className="h-3.5 w-3.5 text-white/50" />
            </a>
          )}
          <Button variant="outline" size="sm" onClick={() => void fetchStats()} disabled={refreshing}>
            {refreshing ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <RefreshCw className="ml-2 h-4 w-4" />} تحديث
          </Button>
          <Button
            size="sm"
            onClick={() => void triggerHarvest()}
            disabled={triggering}
            className={workflowStatus?.workflowConfigured ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium" : "bg-amber-600 hover:bg-amber-700 text-white font-medium"}
          >
            {triggering ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Play className="ml-2 h-4 w-4" />}
            {workflowStatus?.workflowConfigured ? "تشغيل الحصاد السحابي (GitHub)" : "تهيئة وتشغيل الحصاد (GitHub)"}
          </Button>
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200">{error}</div>}
      {notice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-800 dark:text-green-200">
          <span>{notice}</span>
          {workflowStatus?.runsUrl && (
            <a
              href={workflowStatus.runsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30 transition"
            >
              <span>متابعة سير العمل على GitHub</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}
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

      {/* GitHub Actions Token Setup Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-400">
                  <Key className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">تهيئة مفتاح GitHub للحصاد السحابي</h3>
                  <p className="text-xs text-white/60">تشغيل سير العمل (run-harvester.yml) عن بُعد</p>
                </div>
              </div>
              <button
                onClick={() => setShowTokenModal(false)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              يقوم روبوت الحصاد بالعمل على خوادم <b>GitHub Actions</b> المستقلة لجمع مئات الصور وفحصها بالذكاء الاصطناعي دون إجهاد سيرفر الموقع أو استهلاك وقته. لإصدار أمر التشغيل التلقائي، أدخل رمز وصول <b>GitHub Personal Access Token</b> بصلاحية <code>workflow</code> و <code>repo</code>.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-white/80 block">
                رمز الوصول (GitHub Token):
              </label>
              <input
                type="password"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
                dir="ltr"
              />
              <div className="flex items-center justify-between pt-1">
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Azenith+Harvester+Trigger"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:underline"
                >
                  <span>توليد التوكن في ثوانٍ من GitHub</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={saveTokenPermanently}
                onChange={(e) => setSaveTokenPermanently(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-0 w-4 h-4"
              />
              <span className="text-xs text-white/80 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                حفظ التوكن في قاعدة البيانات (api_keys) للاستخدام المستمر بنقرة واحدة
              </span>
            </label>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTokenModal(false)}
                className="text-xs border-white/15 text-white/70 hover:bg-white/10"
              >
                إلغاء
              </Button>
              <Button
                size="sm"
                onClick={() => void triggerHarvest(inputToken)}
                disabled={triggering || !inputToken.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                {triggering ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Play className="ml-2 h-4 w-4" />}
                حفظ وبدء الحصاد الآن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
