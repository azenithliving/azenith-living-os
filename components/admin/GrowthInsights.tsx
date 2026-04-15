"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

/**
 * Executive Growth Dashboard (CEO AI)
 * Weekly insights on design trends, conversion bottlenecks, and business advice
 */

export type DesignTrend = {
  style: string;
  mentions: number;
  growth: number;
  relatedColors: string[];
  avgBudget: number;
};

export type ConversionBottleneck = {
  stage: string;
  dropoffRate: number;
  impact: "high" | "medium" | "low";
  suggestion: string;
};

export type BusinessAdvice = {
  category: "focus" | "expand" | "optimize" | "urgent";
  title: string;
  description: string;
  expectedImpact: string;
  confidence: number;
};

export type WeeklyReport = {
  period: { start: string; end: string };
  summary: {
    totalLeads: number;
    diamondLeads: number;
    conversionRate: number;
    avgDealSize: number;
    topRoomType: string;
  };
  trends: DesignTrend[];
  bottlenecks: ConversionBottleneck[];
  advice: BusinessAdvice[];
  styleDNAAnalysis: {
    dominantStyles: Array<{ style: string; percentage: number }>;
    colorTrends: Array<{ color: string; frequency: number }>;
    materialPreferences: Array<{ material: string; count: number }>;
  };
  geographicInsights?: {
    topAreas: Array<{ area: string; leadCount: number; avgBudget: number }>;
  };
};

interface GrowthInsightsProps {
  report?: WeeklyReport;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const categoryConfig = {
  focus: { emoji: "🎯", color: "amber", label: "Focus Area" },
  expand: { emoji: "📈", color: "green", label: "Expansion" },
  optimize: { emoji: "⚡", color: "blue", label: "Optimization" },
  urgent: { emoji: "🔴", color: "red", label: "Urgent" },
};

const impactConfig = {
  high: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-400/30" },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-400/30" },
  low: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-400/30" },
};

export function GrowthInsights({
  report,
  isLoading = false,
  onRefresh,
  className = "",
}: GrowthInsightsProps) {
  const [selectedTab, setSelectedTab] = useState<"overview" | "trends" | "bottlenecks" | "advice">("overview");

  if (isLoading) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-8 ${className}`}>
        <div className="flex items-center justify-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-500" />
          <span className="text-white/60">Analyzing growth patterns...</span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-8 ${className}`}>
        <div className="text-center">
          <p className="text-white/60">No report data available</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-4 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-black"
            >
              Generate Report
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-amber-400/70">CEO AI</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Executive Growth Insights</h2>
          <p className="text-sm text-white/50">
            {new Date(report.period.start).toLocaleDateString()} - {new Date(report.period.end).toLocaleDateString()}
          </p>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="rounded-lg border border-white/20 bg-white/[0.05] px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            Refresh Analysis
          </button>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Leads"
          value={report.summary.totalLeads}
          subtext={`${report.summary.diamondLeads} Diamond`}
          color="blue"
        />
        <MetricCard
          label="Conversion Rate"
          value={`${(report.summary.conversionRate * 100).toFixed(1)}%`}
          subtext="vs 15.2% last week"
          color="green"
        />
        <MetricCard
          label="Avg Deal Size"
          value={`${(report.summary.avgDealSize / 1000000).toFixed(1)}M`}
          subtext="EGP"
          color="amber"
        />
        <MetricCard
          label="Top Room Type"
          value={report.summary.topRoomType}
          subtext="Most requested"
          color="purple"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {[
          { key: "overview", label: "Overview", emoji: "📊" },
          { key: "trends", label: "Design Trends", emoji: "🎨" },
          { key: "bottlenecks", label: "Bottlenecks", emoji: "🚧" },
          { key: "advice", label: "AI Advice", emoji: "💡" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm transition-colors ${
              selectedTab === tab.key
                ? "bg-amber-500 text-black"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[300px]">
        {selectedTab === "overview" && (
          <OverviewTab report={report} />
        )}
        {selectedTab === "trends" && (
          <TrendsTab trends={report.trends} styleDNA={report.styleDNAAnalysis} />
        )}
        {selectedTab === "bottlenecks" && (
          <BottlenecksTab bottlenecks={report.bottlenecks} />
        )}
        {selectedTab === "advice" && (
          <AdviceTab advice={report.advice} />
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  color,
}: {
  label: string;
  value: string | number;
  subtext: string;
  color: "blue" | "green" | "amber" | "purple";
}) {
  const colors = {
    blue: "from-blue-500/20 to-blue-400/5 border-blue-400/20",
    green: "from-green-500/20 to-green-400/5 border-green-400/20",
    amber: "from-amber-500/20 to-yellow-400/5 border-amber-400/20",
    purple: "from-purple-500/20 to-purple-400/5 border-purple-400/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-gradient-to-b p-4 ${colors[color]}`}
    >
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-white/40">{subtext}</p>
    </motion.div>
  );
}

function OverviewTab({ report }: { report: WeeklyReport }) {
  return (
    <div className="space-y-4">
      {/* Top Trend Alert */}
      {report.trends[0] && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔥</span>
            <div>
              <h3 className="font-semibold text-amber-300">Hottest Trend This Week</h3>
              <p className="text-sm text-white/80">
                <span className="font-medium">{report.trends[0].style}</span> is trending with{" "}
                {report.trends[0].mentions} mentions from high-budget leads. 
                Growth: +{report.trends[0].growth}%
              </p>
              <div className="mt-2 flex gap-2">
                {report.trends[0].relatedColors.map((color) => (
                  <span
                    key={color}
                    className="rounded-full bg-white/10 px-2 py-1 text-xs text-white/70"
                  >
                    {color}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Style DNA Summary */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="mb-3 font-semibold text-white">Style DNA Insights</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-white/50">Dominant Styles</p>
            {report.styleDNAAnalysis.dominantStyles.slice(0, 3).map((s) => (
              <div key={s.style} className="mt-1 flex items-center gap-2">
                <div
                  className="h-2 rounded-full bg-amber-500"
                  style={{ width: `${s.percentage}%` }}
                />
                <span className="text-xs text-white/70">
                  {s.style} ({s.percentage}%)
                </span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs text-white/50">Color Trends</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {report.styleDNAAnalysis.colorTrends.slice(0, 5).map((c) => (
                <span
                  key={c.color}
                  className="rounded bg-white/10 px-2 py-1 text-xs text-white/70"
                >
                  {c.color}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-white/50">Material Preferences</p>
            {report.styleDNAAnalysis.materialPreferences.slice(0, 3).map((m) => (
              <p key={m.material} className="text-xs text-white/70">
                • {m.material} ({m.count} projects)
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button className="flex-1 rounded-lg bg-amber-500/20 px-4 py-3 text-sm font-medium text-amber-300 transition-colors hover:bg-amber-500/30">
          📥 Export Full Report
        </button>
        <button className="flex-1 rounded-lg border border-white/20 bg-white/[0.05] px-4 py-3 text-sm text-white transition-colors hover:bg-white/10">
          📤 Share with Team
        </button>
      </div>
    </div>
  );
}

function TrendsTab({
  trends,
  styleDNA,
}: {
  trends: DesignTrend[];
  styleDNA: WeeklyReport["styleDNAAnalysis"];
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-white">Hottest Design Trends (High-Budget Leads)</h3>
      
      <div className="grid gap-3">
        {trends.map((trend, index) => (
          <motion.div
            key={trend.style}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-lg font-bold text-amber-400">
              #{index + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h4 className="font-medium text-white">{trend.style}</h4>
                <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                  +{trend.growth}%
                </span>
              </div>
              <p className="text-xs text-white/50">
                {trend.mentions} mentions • Avg budget: {(trend.avgBudget / 1000).toFixed(0)}k EGP
              </p>
            </div>
            <div className="flex gap-1">
              {trend.relatedColors.slice(0, 3).map((c) => (
                <span
                  key={c}
                  className="h-6 w-6 rounded-full border border-white/20"
                  style={{ backgroundColor: c.toLowerCase() }}
                  title={c}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function BottlenecksTab({ bottlenecks }: { bottlenecks: ConversionBottleneck[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-white">Conversion Rate Bottlenecks</h3>
      
      <div className="space-y-3">
        {bottlenecks.map((bottleneck, index) => {
          const config = impactConfig[bottleneck.impact];
          return (
            <motion.div
              key={bottleneck.stage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-xl border p-4 ${config.bg} ${config.border}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-medium ${config.color}`}>{bottleneck.stage}</h4>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium uppercase ${config.color} bg-white/10`}>
                      {bottleneck.impact} impact
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/70">{bottleneck.suggestion}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-bold ${config.color}`}>
                    {bottleneck.dropoffRate}%
                  </p>
                  <p className="text-xs text-white/50">drop-off</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function AdviceTab({ advice }: { advice: BusinessAdvice[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-white">AI-Powered Business Advice</h3>
      
      <div className="space-y-3">
        {advice.map((item, index) => {
          const config = categoryConfig[item.category];
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={`rounded-xl border border-${config.color}-400/30 bg-${config.color}-500/10 p-4`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{config.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium text-${config.color}-300 bg-white/10`}>
                      {config.label}
                    </span>
                    <span className="text-xs text-white/50">
                      {item.confidence}% confidence
                    </span>
                  </div>
                  <h4 className="mt-1 font-medium text-white">{item.title}</h4>
                  <p className="mt-1 text-sm text-white/70">{item.description}</p>
                  <p className="mt-2 text-xs text-amber-300">
                    💡 Expected Impact: {item.expectedImpact}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default GrowthInsights;
