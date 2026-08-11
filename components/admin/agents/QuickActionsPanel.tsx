'use client';

/**
 * QuickActionsPanel — أزرار تنفيذ حقيقية تستدعي الأدوات مباشرة
 * كل زر يرسل POST لـ /api/admin/agents/orchestrate ويعرض النتيجة الحقيقية
 */

import { useState } from 'react';
import {
  Search, HardDrive, TrendingUp, Package,
  Loader2, CheckCircle, XCircle, ChevronDown, ChevronUp
} from 'lucide-react';

interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  toolName: string;
  params: Record<string, unknown>;
}

const ACTIONS: QuickAction[] = [
  {
    id: 'seo',
    label: 'تحليل SEO',
    description: 'تحليل شامل لأداء الموقع',
    icon: Search,
    color: 'blue',
    toolName: 'seo_analyze',
    params: { url: process.env.NEXT_PUBLIC_SITE_URL || 'https://azenithliving.com', deepAnalysis: false },
  },
  {
    id: 'backup',
    label: 'نسخة احتياطية',
    description: 'حفظ نسخة كاملة الآن',
    icon: HardDrive,
    color: 'emerald',
    toolName: 'backup_create',
    params: { name: `quick-backup-${new Date().toISOString().slice(0, 10)}`, retentionDays: 30 },
  },
  {
    id: 'revenue',
    label: 'تقرير الإيرادات',
    description: 'تحليل المبيعات والتحويلات',
    icon: TrendingUp,
    color: 'amber',
    toolName: 'revenue_analyze',
    params: { period: '30d', includeForecast: true },
  },
  {
    id: 'inventory',
    label: 'فحص المخزون',
    description: 'كشف المنتجات المنخفضة',
    icon: Package,
    color: 'purple',
    toolName: 'inventory_check_low',
    params: {},
  },
];

const COLOR_MAP: Record<string, { btn: string; badge: string; icon: string }> = {
  blue:    { btn: 'border-blue-500/20 hover:bg-blue-500/10',    badge: 'bg-blue-500/20 text-blue-300',    icon: 'text-blue-400'    },
  emerald: { btn: 'border-emerald-500/20 hover:bg-emerald-500/10', badge: 'bg-emerald-500/20 text-emerald-300', icon: 'text-emerald-400' },
  amber:   { btn: 'border-amber-500/20 hover:bg-amber-500/10',  badge: 'bg-amber-500/20 text-amber-300',  icon: 'text-amber-400'   },
  purple:  { btn: 'border-purple-500/20 hover:bg-purple-500/10', badge: 'bg-purple-500/20 text-purple-300', icon: 'text-purple-400'  },
};

async function runTool(toolName: string, params: Record<string, unknown>): Promise<ActionResult> {
  const res = await fetch('/api/admin/agents/orchestrate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ tool: toolName, params, source: 'quick_actions' }),
  });
  const data = await res.json();
  return {
    success: data.success ?? false,
    message: data.message || data.error || (data.success ? 'تم بنجاح' : 'فشل التنفيذ'),
    data:    data.data,
  };
}

// ── مكوّن نتيجة قابل للطي ─────────────────────────────────────────────
function ResultBox({ result }: { result: ActionResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = result.data && Object.keys(result.data).length > 0;

  return (
    <div className={`mt-2 rounded-xl p-3 text-xs border ${
      result.success
        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
        : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {result.success
            ? <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            : <XCircle    className="w-3.5 h-3.5 shrink-0" />
          }
          <span className="leading-tight">{result.message}</span>
        </div>
        {hasData && (
          <button onClick={() => setExpanded(v => !v)} className="shrink-0 opacity-60 hover:opacity-100">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}
      </div>
      {expanded && hasData && (
        <pre className="mt-2 text-[10px] text-white/40 overflow-x-auto bg-black/30 rounded-lg p-2 font-mono">
          {JSON.stringify(result.data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── المكوّن الرئيسي ────────────────────────────────────────────────────
export function QuickActionsPanel() {
  const [states, setStates] = useState<Record<string, 'idle' | 'loading'>>({});
  const [results, setResults] = useState<Record<string, ActionResult>>({});

  async function execute(action: QuickAction) {
    if (states[action.id] === 'loading') return;
    setStates(s => ({ ...s, [action.id]: 'loading' }));
    setResults(s => { const n = { ...s }; delete n[action.id]; return n; });

    try {
      const result = await runTool(action.toolName, action.params);
      setResults(s => ({ ...s, [action.id]: result }));
    } catch (err) {
      setResults(s => ({ ...s, [action.id]: { success: false, message: 'خطأ في الاتصال' } }));
    } finally {
      setStates(s => ({ ...s, [action.id]: 'idle' }));
    }
  }

  return (
    <div className="p-6 space-y-5">
      <h3 className="text-base font-black flex items-center gap-2 text-[#C5A059]">
        <span>⚡</span> أوامر سريعة
      </h3>

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map(action => {
          const col     = COLOR_MAP[action.color];
          const loading = states[action.id] === 'loading';
          const result  = results[action.id];

          return (
            <div key={action.id} className="space-y-1">
              <button
                onClick={() => execute(action)}
                disabled={loading}
                className={`w-full flex flex-col items-center justify-center gap-2 p-5 bg-white/[0.02] border ${col.btn} rounded-2xl transition-all disabled:opacity-50 group`}
              >
                {loading
                  ? <Loader2 className={`w-6 h-6 ${col.icon} animate-spin`} />
                  : <action.icon className={`w-6 h-6 ${col.icon} group-hover:scale-110 transition-transform`} />
                }
                <span className="text-[10px] font-black uppercase tracking-widest text-white/70">
                  {loading ? 'جاري…' : action.label}
                </span>
                <span className="text-[9px] text-white/30 text-center leading-tight">
                  {action.description}
                </span>
              </button>

              {result && <ResultBox result={result} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
