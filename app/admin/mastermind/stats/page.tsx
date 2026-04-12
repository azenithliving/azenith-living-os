"use client";

import { useEffect, useState } from "react";
import { 
  Activity, 
  Cpu, 
  Shield, 
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw
} from "lucide-react";

interface MastermindStats {
  timestamp: string;
  commands: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: number;
    last24h: number;
  };
  models: {
    usage: Record<string, number>;
    total: number;
  };
  agents: {
    coder: { tasks: number; avgTime: number; successRate: number };
    security: { tasks: number; avgTime: number; successRate: number };
    analyst: { tasks: number; avgTime: number; successRate: number };
    ops: { tasks: number; avgTime: number; successRate: number };
  };
  apiKeys: {
    total: number;
    active: number;
    providers: string[];
  };
  security: {
    failedAttempts24h: number;
    has2FA: boolean;
    lastCommand: string | null;
  };
  recentCommands: Array<{
    id: string;
    command: string;
    status: string;
    executedAt: string;
  }>;
}

export default function MastermindStatsPage() {
  const [stats, setStats] = useState<MastermindStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/admin/mastermind/stats");
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin h-8 w-8 border-4 border-brand-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-200">
          <AlertTriangle className="h-5 w-5 inline mr-2" />
          Error: {error}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Mastermind Intelligence</h1>
          <p className="text-white/60 mt-1">Real-time system statistics</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-2 px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-lg hover:bg-brand-primary/20 transition"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Command Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-white/60 flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-blue-400" />
            Total Commands
          </div>
          <div className="text-3xl font-bold text-white">{stats.commands.total}</div>
          <div className="text-sm text-white/40 mt-1">
            {stats.commands.last24h} in last 24h
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-white/60 flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            Success Rate
          </div>
          <div className="text-3xl font-bold text-emerald-400">{stats.commands.successRate}%</div>
          <div className="text-sm text-white/40 mt-1">
            {stats.commands.successful} successful
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-white/60 flex items-center gap-2 mb-2">
            <XCircle className="h-4 w-4 text-red-400" />
            Failed
          </div>
          <div className="text-3xl font-bold text-red-400">{stats.commands.failed}</div>
          <div className="text-sm text-white/40 mt-1">
            {stats.commands.pending} pending
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <div className="text-sm text-white/60 flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-amber-400" />
            Security Events
          </div>
          <div className="text-3xl font-bold text-amber-400">
            {stats.security.failedAttempts24h}
          </div>
          <div className="text-sm text-white/40 mt-1">
            Failed attempts (24h)
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2 mb-4">
          <Cpu className="h-5 w-5 text-brand-primary" />
          Agent Performance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.entries(stats.agents).map(([agent, data]) => (
            <div key={agent} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-medium capitalize">{agent}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  data.successRate > 0.9 
                    ? "bg-emerald-500/20 text-emerald-400" 
                    : "bg-red-500/20 text-red-400"
                }`}>
                  {(data.successRate * 100).toFixed(0)}%
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-white/60">
                  Tasks: <span className="text-white">{data.tasks}</span>
                </div>
                <div className="text-white/60">
                  Avg Time: <span className="text-white">{(data.avgTime / 1000).toFixed(1)}s</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Usage */}
      {stats.models.total > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-lg p-6">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2 mb-4">
            <Zap className="h-5 w-5 text-yellow-400" />
            Model Usage
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(stats.models.usage).map(([model, count]) => (
              <div key={model} className="bg-white/5 rounded p-2 text-center">
                <div className="text-xs text-white/60 truncate">{model}</div>
                <div className="text-lg font-bold text-white">{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Commands */}
      <div className="bg-white/5 border border-white/10 rounded-lg p-6">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-blue-400" />
          Recent Commands
        </h2>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {stats.recentCommands.map((cmd) => (
            <div 
              key={cmd.id} 
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{cmd.command}</p>
                <p className="text-white/40 text-xs">
                  {new Date(cmd.executedAt).toLocaleString()}
                </p>
              </div>
              <span className={`ml-2 text-xs px-2 py-1 rounded ${
                cmd.status === "executed" 
                  ? "bg-emerald-500/20 text-emerald-400" 
                  : cmd.status === "failed" 
                  ? "bg-red-500/20 text-red-400" 
                  : "bg-white/10 text-white/60"
              }`}>
                {cmd.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-white/40 text-sm">
        Last updated: {new Date(stats.timestamp).toLocaleString()}
        <br />
        Auto-refresh every 30 seconds
      </div>
    </div>
  );
}
