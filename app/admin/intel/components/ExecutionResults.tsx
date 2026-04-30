/**
 * Execution Results Components
 * 
 * Display real execution results from the agent:
 * - SEO Analysis with real scores and issues
 * - Section Creation with preview links
 * - Backup with download links
 * - Settings updates with rollback options
 */

"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  ExternalLink, 
  Download, 
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileText,
  Layout,
  Database
} from "lucide-react";

// ============================================
// SEO Analysis Result Component
// ============================================

interface SEOIssue {
  code: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  message: string;
  recommendation: string;
  autoFixable: boolean;
}

interface SEOAnalysisData {
  pageUrl: string;
  pageTitle?: string;
  score: number;
  scoreBreakdown: {
    meta: number;
    headings: number;
    images: number;
    links: number;
    performance: number;
    mobile: number;
  };
  issues: SEOIssue[];
  recommendations: Array<{
    priority: string;
    category: string;
    title: string;
    description: string;
    autoFixable: boolean;
  }>;
}

export function SEOAnalysisResult({ data }: { data: SEOAnalysisData }) {
  const [expandedIssues, setExpandedIssues] = useState(true);
  const [expandedRecommendations, setExpandedRecommendations] = useState(true);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 60) return "text-yellow-500";
    return "text-red-500";
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return "bg-green-500/20";
    if (score >= 60) return "bg-yellow-500/20";
    return "bg-red-500/20";
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    }
  };

  const criticalCount = data.issues.filter(i => i.severity === "critical").length;
  const highCount = data.issues.filter(i => i.severity === "high").length;

  return (
    <Card className="border-white/10 bg-[#0f1115] text-white">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#C5A059]" />
              تحليل SEO
            </CardTitle>
            <p className="text-sm text-white/60 mt-1">{data.pageUrl}</p>
          </div>
          <div className={`rounded-full ${getScoreBg(data.score)} px-4 py-2`}>
            <span className={`text-2xl font-bold ${getScoreColor(data.score)}`}>
              {data.score}
            </span>
            <span className="text-white/60 text-sm">/100</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Score Breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(data.scoreBreakdown).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-white/60 capitalize">{key}</span>
                <span className="text-white">{value}/20</span>
              </div>
              <Progress value={(value / 20) * 100} className="h-1" />
            </div>
          ))}
        </div>

        {/* Issues Summary */}
        {data.issues.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <button
              onClick={() => setExpandedIssues(!expandedIssues)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">
                  المشاكل المكتشفة: {data.issues.length}
                  {criticalCount > 0 && (
                    <Badge variant="destructive" className="mr-2 text-xs">
                      {criticalCount} حرجة
                    </Badge>
                  )}
                  {highCount > 0 && (
                    <Badge variant="secondary" className="mr-2 text-xs bg-orange-500">
                      {highCount} عالية
                    </Badge>
                  )}
                </span>
              </div>
              {expandedIssues ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {expandedIssues && (
              <div className="mt-3 space-y-2">
                {data.issues.slice(0, 5).map((issue, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded border border-white/5 bg-black/20 p-2"
                  >
                    {getSeverityIcon(issue.severity)}
                    <div className="flex-1">
                      <p className="text-sm text-white/90">{issue.message}</p>
                      <p className="text-xs text-white/50 mt-1">{issue.recommendation}</p>
                      {issue.autoFixable && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          يمكن إصلاحه تلقائياً
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                {data.issues.length > 5 && (
                  <p className="text-xs text-white/40 text-center">
                    +{data.issues.length - 5} مشاكل أخرى
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <button
              onClick={() => setExpandedRecommendations(!expandedRecommendations)}
              className="flex w-full items-center justify-between"
            >
              <span className="text-sm font-medium">التوصيات ({data.recommendations.length})</span>
              {expandedRecommendations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {expandedRecommendations && (
              <div className="mt-3 space-y-2">
                {data.recommendations.slice(0, 3).map((rec, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 rounded border border-white/5 bg-black/20 p-2"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-white/90">{rec.title}</p>
                      <p className="text-xs text-white/50">{rec.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Section Created Result Component
// ============================================

interface SectionCreatedData {
  sectionId: string;
  previewUrl: string;
  section: {
    section_name: string;
    section_type: string;
    page_placement?: string;
  };
}

export function SectionCreatedResult({ data }: { data: SectionCreatedData }) {
  return (
    <Card className="border-white/10 bg-[#0f1115] text-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Layout className="h-5 w-5 text-[#C5A059]" />
          تم إنشاء القسم بنجاح
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{data.section.section_name}</span>
          </div>
          <div className="text-sm text-white/60 space-y-1">
            <p>النوع: {data.section.section_type}</p>
            <p>المعرف: {data.sectionId}</p>
            {data.section.page_placement && (
              <p>المكان: {data.section.page_placement}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/10"
            onClick={() => window.open(data.previewUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            معاينة القسم
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Backup Created Result Component
// ============================================

interface BackupCreatedData {
  backupId: string;
  downloadUrl: string;
  sizeBytes: number;
  tables: string[];
  expiresAt: string;
}

export function BackupCreatedResult({ data }: { data: BackupCreatedData }) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // eslint-disable-next-line react-hooks/purity -- Date needed for calculation
  const daysLeft = useMemo(() => {
    const expiresDate = new Date(data.expiresAt);
    const now = new Date();
    return Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [data.expiresAt]);

  return (
    <Card className="border-white/10 bg-[#0f1115] text-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-5 w-5 text-[#C5A059]" />
          تم إنشاء نسخة احتياطية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">نسخة احتياطية جاهزة</span>
          </div>
          <div className="text-sm text-white/60 space-y-1">
            <p>الحجم: {formatBytes(data.sizeBytes)}</p>
            <p>الجداول: {data.tables.length} جدول</p>
            <p>صالحة لـ: {daysLeft} يوم</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-white/10"
            onClick={() => window.open(data.downloadUrl, "_blank")}
          >
            <Download className="h-4 w-4 mr-2" />
            تحميل النسخة
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Setting Updated Result Component
// ============================================

interface SettingUpdatedData {
  revisionId: string;
  oldValue: unknown;
  newValue: unknown;
  canRollback: boolean;
}

export function SettingUpdatedResult({ 
  data, 
  onRollback 
}: { 
  data: SettingUpdatedData; 
  onRollback?: (revisionId: string) => void;
}) {
  const [isRollingBack, setIsRollingBack] = useState(false);

  const handleRollback = async () => {
    if (!onRollback || !data.canRollback) return;
    setIsRollingBack(true);
    await onRollback(data.revisionId);
    setIsRollingBack(false);
  };

  return (
    <Card className="border-white/10 bg-[#0f1115] text-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          تم تحديث الإعداد
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-sm text-white/60 mb-2">معرف المراجعة: {data.revisionId}</p>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/40">القيمة القديمة:</span>
              <code className="bg-black/30 px-2 py-1 rounded text-xs">
                {JSON.stringify(data.oldValue)}
              </code>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-white/40">القيمة الجديدة:</span>
              <code className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs">
                {JSON.stringify(data.newValue)}
              </code>
            </div>
          </div>
        </div>

        {data.canRollback && onRollback && (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            onClick={handleRollback}
            disabled={isRollingBack}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {isRollingBack ? "جاري التراجع..." : "تراجع عن التغيير"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Generic Execution Result Component
// ============================================

interface ExecutionResultProps {
  actionTaken?: string;
  data?: unknown;
  executionId?: string;
  onRollback?: (executionId: string) => void;
}

export function ExecutionResultCard({ actionTaken, data, onRollback }: ExecutionResultProps) {
  if (!data || typeof data !== "object") return null;

  // Render based on action type
  switch (actionTaken) {
    case "seo_analyzed_real":
    case "seo_analysis_completed":
      return <SEOAnalysisResult data={data as SEOAnalysisData} />;

    case "section_created":
    case "section_created_real":
      return <SectionCreatedResult data={data as SectionCreatedData} />;

    case "backup_created":
    case "backup_created_real":
      return <BackupCreatedResult data={data as BackupCreatedData} />;

    case "setting_updated":
    case "setting_update_completed":
      return <SettingUpdatedResult data={data as SettingUpdatedData} onRollback={onRollback} />;

    default:
      // Generic display for other results
      return (
        <Card className="border-white/10 bg-[#0f1115] text-white">
          <CardContent className="p-4">
            <pre className="text-xs text-white/70 overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </CardContent>
        </Card>
      );
  }
}
