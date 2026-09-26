'use client';

/**
 * QayyimBenchmarksPanel — تشغيل معايير الجودة وعرض نتائجها التاريخية
 */

import { useState, useEffect, useCallback } from 'react';
import { Gauge, Loader2, RefreshCw, PlayCircle, CheckCircle2, XCircle } from 'lucide-react';

interface BenchmarkInfo {
  key: string;
  name: string;
  description: string;
  applicableAgents: string[];
}

interface BenchmarkRun {
  id: string;
  agent_key: string;
  benchmark_key: string;
  score: number;
  passed: boolean;
  created_at: string;
}

export function QayyimBenchmarksPanel() {
  const [benchmarks, setBenchmarks] = useState<BenchmarkInfo[]>([]);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/qayyim/benchmarks');
      const data = await res.json();
      if (data.success) {
        setBenchmarks(data.benchmarks || []);
        setRuns(data.recent_runs || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function runBenchmark(benchmarkKey: string, agentKey: string) {
    setRunning(`${benchmarkKey}:${agentKey}`);
    try {
      await fetch('/api/admin/qayyim/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmark_key: benchmarkKey, agent_key: agentKey }),
      });
      fetchAll();
    } catch { /* silent */ }
    finally { setRunning(null); }
  }

  const latestByKey = new Map<string, BenchmarkRun>();
  for (const run of runs) {
    const k = `${run.benchmark_key}:${run.agent_key}`;
    if (!latestByKey.has(k)) latestByKey.set(k, run);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">{benchmarks.length} معيار جودة · {runs.length} تشغيل مسجل</div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/60 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          تحديث
        </button>
      </div>

      {loading && benchmarks.length === 0 ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : (
        <div className="space-y-2.5">
          {benchmarks.map((bm) => (
            <div key={bm.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-amber-300" />
                    {bm.name}
                  </div>
                  <div className="text-xs text-white/50 mt-1">{bm.description}</div>
                </div>
              </div>

              {/* Per-agent rows */}
              <div className="flex flex-wrap gap-2">
                {bm.applicableAgents.map((agentKey) => {
                  const k = `${bm.key}:${agentKey}`;
                  const latest = latestByKey.get(k);
                  const isRunning = running === k;
                  return (
                    <div key={agentKey} className="flex items-center gap-2 rounded-lg bg-black/30 border border-white/5 px-2.5 py-1.5">
                      <span className="text-[10px] text-white/50" dir="ltr">{agentKey}</span>
                      {latest && (
                        <span className={`flex items-center gap-1 text-[11px] font-bold ${latest.passed ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {latest.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {latest.score}
                        </span>
                      )}
                      <button
                        onClick={() => runBenchmark(bm.key, agentKey)}
                        disabled={isRunning}
                        className="p-1 rounded text-white/40 hover:text-amber-300 transition-colors disabled:opacity-40"
                        title="تشغيل المعيار"
                      >
                        {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
