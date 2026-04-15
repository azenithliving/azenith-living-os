/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                    THE WAR ROOM - Imperial Command Center                  ║
 * ║           Matte Black | API Energy Levels | Visitor Heatmaps             ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Shield,
  Brain,
  TrendingUp,
  Clock,
  Server,
  Globe,
  Activity,
  AlertTriangle,
  CheckCircle,
  Cpu,
  Database,
  Lock,
  Target,
  BarChart3,
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

// ==========================================
// TYPES
// ==========================================

interface WarRoomData {
  swarm: {
    totalNodes: number;
    activeNodes: number;
    collectiveIntelligence: number;
    consensusRate: number;
    regions: Record<string, number>;
  };
  defense: {
    systemHealth: "optimal" | "stable" | "degraded" | "under_attack";
    activeThreats: number;
    blockedIPs: number;
    avgLatency: number;
  };
  market: {
    scenariosGenerated: number;
    opportunitiesFound: number;
    revenuePotential: number;
    readyToDeploy: number;
  };
  optimization: {
    bottlenecksFixed: number;
    timeSaved: number;
    efficiencyGain: number;
    lastOptimization: string;
  };
  cache: {
    hitRate: number;
    costSavings: number;
    entries: number;
  };
  snapshots: {
    total: number;
    lastSnapshot: string;
  };
}

// ==========================================
// IMPERIAL COMPONENTS
// ==========================================

const MetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = "gold",
  delay = 0,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "gold" | "emerald" | "rose" | "blue" | "purple";
  delay?: number;
}) => {
  const colorClasses = {
    gold: "from-amber-500/20 to-yellow-500/5 border-amber-500/30",
    emerald: "from-emerald-500/20 to-green-500/5 border-emerald-500/30",
    rose: "from-rose-500/20 to-red-500/5 border-rose-500/30",
    blue: "from-blue-500/20 to-cyan-500/5 border-blue-500/30",
    purple: "from-purple-500/20 to-violet-500/5 border-purple-500/30",
  };

  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={`relative overflow-hidden rounded-lg border bg-gradient-to-br ${colorClasses[color]} p-6 backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-white/50">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          <p className="mt-1 text-sm text-white/70">{subtitle}</p>
        </div>
        <div className="rounded-full bg-white/10 p-3">
          <Icon className="h-6 w-6 text-white/80" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <TrendIcon className={`h-4 w-4 ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-white/50"}`} />
          <span className={`text-sm ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-white/50"}`}>
            {trendValue}
          </span>
        </div>
      )}
    </motion.div>
  );
};

const StatusIndicator = ({ status, label }: { status: string; label: string }) => {
  const colors: Record<string, string> = {
    optimal: "bg-emerald-500",
    stable: "bg-blue-500",
    degraded: "bg-amber-500",
    under_attack: "bg-rose-500 animate-pulse",
    active: "bg-emerald-500",
    warning: "bg-amber-500",
    critical: "bg-rose-500 animate-pulse",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${colors[status] || "bg-white/30"}`} />
      <span className="text-sm text-white/70">{label}</span>
    </div>
  );
};

const EnergyBar = ({ label, value, max = 100, color = "amber" }: { label: string; value: number; max?: number; color?: string }) => {
  const percentage = Math.min(100, (value / max) * 100);
  
  const colorClasses: Record<string, string> = {
    amber: "bg-gradient-to-r from-amber-500 to-yellow-400",
    emerald: "bg-gradient-to-r from-emerald-500 to-green-400",
    blue: "bg-gradient-to-r from-blue-500 to-cyan-400",
    rose: "bg-gradient-to-r from-rose-500 to-red-400",
    purple: "bg-gradient-to-r from-purple-500 to-violet-400",
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="text-white/80">{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full ${colorClasses[color]}`}
        />
      </div>
    </div>
  );
};

const OpportunityCard = ({ opportunity, index }: { opportunity: any; index: number }) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.1 }}
    className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition-all hover:border-amber-500/50 hover:bg-white/10"
  >
    <div className="flex items-start justify-between">
      <div>
        <h4 className="font-medium text-white">{opportunity.title}</h4>
        <p className="mt-1 text-sm text-white/60 line-clamp-2">{opportunity.description}</p>
        <div className="mt-3 flex items-center gap-4">
          <span className="text-xs text-emerald-400">
            ${opportunity.revenueProjection?.yearly?.toLocaleString() || "0"}/year
          </span>
          <span className="text-xs text-amber-400">
            {opportunity.confidence || 85}% confidence
          </span>
        </div>
      </div>
      {opportunity.landingPage && (
        <div className="rounded-full bg-emerald-500/20 p-2">
          <CheckCircle className="h-4 w-4 text-emerald-400" />
        </div>
      )}
    </div>
  </motion.div>
);

// ==========================================
// MAIN WAR ROOM PAGE
// ==========================================

export default function WarRoomPage() {
  const [data, setData] = useState<WarRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/admin/war-room");
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error("Failed to fetch war room data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Sparkles className="h-12 w-12 text-amber-500" />
          </motion.div>
          <p className="mt-4 text-white/60">Initializing War Room...</p>
        </div>
      </div>
    );
  }

  // Demo data if no real data
  const demoData: WarRoomData = data || {
    swarm: {
      totalNodes: 24,
      activeNodes: 22,
      collectiveIntelligence: 94,
      consensusRate: 97.5,
      regions: { "us-east": 6, "us-west": 5, "eu-west": 6, "eu-central": 4, "asia-east": 3 },
    },
    defense: {
      systemHealth: "optimal",
      activeThreats: 0,
      blockedIPs: 12,
      avgLatency: 45,
    },
    market: {
      scenariosGenerated: 125000,
      opportunitiesFound: 47,
      revenuePotential: 2850000,
      readyToDeploy: 8,
    },
    optimization: {
      bottlenecksFixed: 23,
      timeSaved: 45000000,
      efficiencyGain: 34.5,
      lastOptimization: "2 minutes ago",
    },
    cache: {
      hitRate: 94.2,
      costSavings: 2847,
      entries: 15634,
    },
    snapshots: {
      total: 156,
      lastSnapshot: "5 minutes ago",
    },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* HEADER */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 md:px-6 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 flex-shrink-0">
                <Target className="h-4 w-4 md:h-5 md:w-5 text-black" />
              </div>
              <div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight">
                  WAR ROOM <span className="text-amber-500">//</span> AZENITH
                </h1>
                <p className="text-xs text-white/50 hidden sm:block">Imperial Command Center v16.2</p>
              </div>
            </div>
            <div className="flex items-center gap-3 md:gap-6">
              <StatusIndicator 
                status={demoData.defense.systemHealth} 
                label={demoData.defense.systemHealth.replace("_", " ").toUpperCase()} 
              />
              <div className="text-right hidden sm:block">
                <p className="text-xs text-white/40">Last Updated</p>
                <p className="text-xs md:text-sm text-white/70">{lastUpdated.toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-8">
        {/* METRICS GRID */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Swarm Intelligence"
            value={`${demoData.swarm.collectiveIntelligence}%`}
            subtitle={`${demoData.swarm.activeNodes}/${demoData.swarm.totalNodes} nodes active`}
            icon={Brain}
            trend="up"
            trendValue="+2.4% this hour"
            color="purple"
            delay={0}
          />
          <MetricCard
            title="Cost Savings"
            value={`$${demoData.cache.costSavings.toLocaleString()}`}
            subtitle={`${demoData.cache.hitRate}% cache hit rate`}
            icon={Database}
            trend="up"
            trendValue="+$127 today"
            color="emerald"
            delay={0.1}
          />
          <MetricCard
            title="Revenue Potential"
            value={`$${(demoData.market.revenuePotential / 1000000).toFixed(1)}M`}
            subtitle={`${demoData.market.readyToDeploy} ready to deploy`}
            icon={TrendingUp}
            trend="up"
            trendValue="+12% from yesterday"
            color="gold"
            delay={0.2}
          />
          <MetricCard
            title="System Latency"
            value={`${demoData.defense.avgLatency}ms`}
            subtitle="Global average"
            icon={Zap}
            trend="neutral"
            trendValue="Optimal"
            color="blue"
            delay={0.3}
          />
        </div>

        {/* MAIN DASHBOARD */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* LEFT COLUMN - SWARM STATUS */}
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-center gap-3">
                <Server className="h-5 w-5 text-amber-500" />
                <h2 className="font-semibold">API Energy Levels</h2>
              </div>
              <div className="space-y-4">
                <EnergyBar label="Groq Cluster" value={92} color="emerald" />
                <EnergyBar label="OpenRouter" value={88} color="blue" />
                <EnergyBar label="Anthropic" value={95} color="purple" />
                <EnergyBar label="Mistral" value={76} color="amber" />
                <EnergyBar label="Google AI" value={84} color="rose" />
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 text-center">
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-2xl font-bold text-emerald-400">{demoData.swarm.consensusRate}%</p>
                  <p className="text-xs text-white/50">Consensus Rate</p>
                </div>
                <div className="rounded-lg bg-white/5 p-3">
                  <p className="text-2xl font-bold text-amber-400">{demoData.optimization.bottlenecksFixed}</p>
                  <p className="text-xs text-white/50">Optimizations</p>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-center gap-3">
                <Shield className="h-5 w-5 text-emerald-500" />
                <h2 className="font-semibold">Defense Grid</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                  <span className="text-sm text-white/70">Active Threats</span>
                  <span className="font-mono text-lg font-bold text-emerald-400">
                    {demoData.defense.activeThreats}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                  <span className="text-sm text-white/70">Blocked IPs</span>
                  <span className="font-mono text-lg font-bold text-white">
                    {demoData.defense.blockedIPs}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
                  <span className="text-sm text-white/70">Last Attack</span>
                  <span className="text-sm text-white/50">4 hours ago</span>
                </div>
              </div>
            </section>
          </div>

          {/* CENTER COLUMN - OPPORTUNITIES */}
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-amber-500" />
                  <h2 className="font-semibold">Market Opportunities</h2>
                </div>
                <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-400">
                  {demoData.market.readyToDeploy} Ready
                </span>
              </div>
              <div className="space-y-3">
                {/* Demo opportunities */}
                <OpportunityCard
                  index={0}
                  opportunity={{
                    title: "AI Room Visualizer",
                    description: "Instant room transformation with AI - upload photo, see design in seconds",
                    revenueProjection: { yearly: 480000 },
                    confidence: 94,
                    landingPage: true,
                  }}
                />
                <OpportunityCard
                  index={1}
                  opportunity={{
                    title: "Virtual Consultation Platform",
                    description: "One-click video consultations with top designers globally",
                    revenueProjection: { yearly: 320000 },
                    confidence: 89,
                    landingPage: true,
                  }}
                />
                <OpportunityCard
                  index={2}
                  opportunity={{
                    title: "Japandi Design Collection",
                    description: "Japanese-Scandinavian fusion - trending globally",
                    revenueProjection: { yearly: 185000 },
                    confidence: 92,
                    landingPage: false,
                  }}
                />
                <OpportunityCard
                  index={3}
                  opportunity={{
                    title: "Subscription Design Service",
                    description: "Monthly room refreshes for luxury homeowners",
                    revenueProjection: { yearly: 560000 },
                    confidence: 87,
                    landingPage: true,
                  }}
                />
              </div>
              <button className="mt-4 w-full rounded-lg border border-amber-500/50 bg-amber-500/10 py-3 text-sm font-medium text-amber-400 transition-all hover:bg-amber-500/20">
                View All {demoData.market.opportunitiesFound} Opportunities
              </button>
            </section>
          </div>

          {/* RIGHT COLUMN - SYSTEM STATUS */}
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-white/5 p-6">
              <div className="mb-6 flex items-center gap-3">
                <Activity className="h-5 w-5 text-blue-500" />
                <h2 className="font-semibold">System Status</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20">
                    <Clock className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Atomic Snapshots</p>
                    <p className="text-xs text-white/50">{demoData.snapshots.total} stored</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                    <Cpu className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Self-Optimization</p>
                    <p className="text-xs text-white/50">{demoData.optimization.lastOptimization}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
                    <Layers className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Cache Layers</p>
                    <p className="text-xs text-white/50">L0 + L1 + L2 + L3 Active</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                    <Globe className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Global Distribution</p>
                    <p className="text-xs text-white/50">5 regions operational</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-transparent p-6">
              <div className="mb-4 flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-amber-500" />
                <h2 className="font-semibold text-amber-400">Empire Intelligence</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Scenarios Today</span>
                  <span className="font-mono text-amber-400">
                    {demoData.market.scenariosGenerated.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Time Saved</span>
                  <span className="font-mono text-emerald-400">
                    {(demoData.optimization.timeSaved / 1000000).toFixed(1)}M μs
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Efficiency Gain</span>
                  <span className="font-mono text-blue-400">
                    +{demoData.optimization.efficiencyGain}%
                  </span>
                </div>
              </div>
              <div className="mt-4 rounded-lg bg-black/30 p-3">
                <p className="text-xs text-white/70 italic">
                  &ldquo;The swarm has analyzed {demoData.market.scenariosGenerated.toLocaleString()} scenarios today. 
                  {demoData.market.readyToDeploy} opportunities are battle-ready for deployment.&rdquo;
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="mt-8 flex flex-wrap gap-4">
          <button className="flex items-center gap-2 rounded-lg bg-white/10 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/20">
            <Database className="h-4 w-4" />
            Create Snapshot
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-white/10 px-6 py-3 text-sm font-medium text-white transition-all hover:bg-white/20">
            <Lock className="h-4 w-4" />
            Run Security Scan
          </button>
          <button className="flex items-center gap-2 rounded-lg bg-amber-500/20 px-6 py-3 text-sm font-medium text-amber-400 transition-all hover:bg-amber-500/30">
            <Sparkles className="h-4 w-4" />
            Generate New Opportunities
          </button>
        </div>
      </main>
    </div>
  );
}
