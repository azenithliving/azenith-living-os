'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Users, ShoppingBag, Layers, Factory, TrendingUp, Play, 
  RefreshCw, CheckCircle2, ArrowRight, ShieldCheck, Zap, Sparkles 
} from 'lucide-react';

export interface PipelineMetrics {
  leadsCount: number;
  ordersCount: number;
  jobsCount: number;
  inventoryCount: number;
  backupsCount: number;
  totalRevenue: number;
}

interface EnterprisePipelineBarProps {
  onOpenScenarioModal: () => void;
  lastUpdated?: string;
}

export function EnterprisePipelineBar({ onOpenScenarioModal, lastUpdated }: EnterprisePipelineBarProps) {
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    leadsCount: 0,
    ordersCount: 0,
    jobsCount: 0,
    inventoryCount: 0,
    backupsCount: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/agents/simulate-scenario');
      const json = await res.json();
      if (json.success && json.data) {
        setMetrics(json.data);
      }
    } catch (err) {
      console.error('Error fetching pipeline metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const pipelineStages = [
    {
      id: 'leads',
      title: 'العملاء المؤهلون',
      sub: 'جدول leads',
      value: loading ? '…' : metrics.leadsCount.toString(),
      icon: Users,
      color: 'from-blue-600/20 to-cyan-600/10 border-blue-500/30 text-blue-400',
      badge: 'Vanguard',
    },
    {
      id: 'orders',
      title: 'أوامر البيع والعقود',
      sub: 'جدول sales_orders',
      value: loading ? '…' : metrics.ordersCount.toString(),
      icon: ShoppingBag,
      color: 'from-emerald-600/20 to-teal-600/10 border-emerald-500/30 text-emerald-400',
      badge: 'Vanguard + Finance',
    },
    {
      id: 'engineering',
      title: 'هندسة المواد والـ BOM',
      sub: 'جدول inventory_items',
      value: loading ? '…' : `${metrics.inventoryCount} صنف خامات`,
      icon: Layers,
      color: 'from-purple-600/20 to-indigo-600/10 border-purple-500/30 text-purple-400',
      badge: 'PRIME',
    },
    {
      id: 'production',
      title: 'أوامر التشغيل بالمصنع',
      sub: 'جدول production_jobs',
      value: loading ? '…' : metrics.jobsCount.toString(),
      icon: Factory,
      color: 'from-amber-600/20 to-orange-600/10 border-amber-500/30 text-amber-400',
      badge: 'Ops & PRIME',
    },
    {
      id: 'revenue',
      title: 'إجمالي القيمة المنفذة',
      sub: 'إيرادات فعلية',
      value: loading ? '…' : `${(metrics.totalRevenue / 1000).toFixed(0)}K ج.م`,
      icon: TrendingUp,
      color: 'from-emerald-600/30 to-green-600/10 border-emerald-500/40 text-emerald-300',
      badge: 'Analyst',
    },
  ];

  return (
    <div className="bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
      {/* Glow Effect */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-purple-600/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-1/4 w-96 h-32 bg-emerald-600/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header & Simulation Trigger */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h2 className="text-base font-black text-white flex items-center gap-2 tracking-wide">
              سلسلة القيمة الميدانية اللحظية (Autonomous Enterprise Pipeline)
            </h2>
          </div>
          <p className="text-xs text-white/40 mt-1">
            تدفق حقيقي ومترابط للمعطيات والقرارات التشغيلية عبر جداول PostgreSQL المعتمدة
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={fetchMetrics}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white transition-all text-xs flex items-center gap-2 font-bold cursor-pointer disabled:opacity-40"
            title="تحديث الأرقام من قاعدة البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
            <span className="hidden sm:inline">تحديث</span>
          </button>

          <button
            onClick={onOpenScenarioModal}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white text-xs font-black flex items-center gap-2.5 transition-all shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02] cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-current text-amber-300 animate-pulse" />
            <span>تشغيل محاكاة سيناريو ميداني حي</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>
      </div>

      {/* The 5 Value Chain Pipeline Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 relative z-10">
        {pipelineStages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.id}
              className={`relative rounded-2xl border p-4 bg-gradient-to-br ${stage.color} backdrop-blur-sm transition-all hover:translate-y-[-2px] group`}
            >
              {/* Connector arrow on large screens */}
              {idx < pipelineStages.length - 1 && (
                <div className="hidden lg:block absolute -left-2.5 top-1/2 -translate-y-1/2 z-20 text-white/20 group-hover:text-white/40 transition-colors pointer-events-none">
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-white/70 font-mono font-bold">
                  {stage.badge}
                </span>
              </div>

              <div className="space-y-0.5">
                <p className="text-[11px] text-white/60 font-medium">{stage.title}</p>
                <p className="text-xl font-black text-white tracking-tight">{stage.value}</p>
                <p className="text-[9px] text-white/30 font-mono">{stage.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
