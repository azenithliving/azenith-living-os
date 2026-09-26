'use client';

import { useState } from 'react';
import { 
  X, Zap, CheckCircle2, Play, Loader2, Sparkles, Layers, 
  Database, ArrowLeft, ShieldCheck, AlertTriangle, RefreshCw
} from 'lucide-react';

interface EnterpriseScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScenarioCompleted?: () => void;
}

const SCENARIOS = [
  {
    id: 'vip_custom_order',
    title: 'دخول عميل VIP لصالون ملكي مخصص (دورة التشغيل الشاملة)',
    subtitle: 'تأهيل العميل ➔ أمر بيع ➔ كشف BOM ➔ حجز الخامات ➔ أمر تشغيل بالمصنع ➔ هامش الربح',
    icon: '👑',
    gradient: 'from-purple-600/30 via-indigo-600/20 to-emerald-600/20',
    border: 'border-purple-500/40',
    agentsInvolved: ['Vanguard', 'مدير تشغيل المحتوى', 'Analyst', 'Ops', 'Security', 'Learner'],
    tablesAffected: ['leads', 'sales_orders', 'inventory_items', 'production_jobs', 'agent_memory'],
    description: 'يقوم Vanguard باستقبال طلب العميل طارق الدسوقي بميزانية 350 ألف ج.م لصالون إمبراطوري، ويصدر عقد البيع، ثم يقوم مدير تشغيل المحتوى بحساب استهلاك خشب الزان والأقمشة، ويتحقق من المخزون، ويصدر أمر تصنيع حقيقي في جدول production_jobs، بينما يحسب Analyst هامش الربح (40.5%).',
  },
  {
    id: 'stock_shortage_alert',
    title: 'إنذار حرج بنقص مخزون خشب الزان الروماني',
    subtitle: 'اكتشاف نقص ➔ تقييم الأوامر المتأثرة ➔ مراجعة تسليمات العملاء ➔ أمر شراء وتوفير سيولة',
    icon: '🪵',
    gradient: 'from-amber-600/30 via-orange-600/20 to-red-600/20',
    border: 'border-amber-500/40',
    agentsInvolved: ['Ops', 'مدير تشغيل المحتوى', 'Vanguard', 'Analyst'],
    tablesAffected: ['inventory_items', 'sales_orders'],
    description: 'يرصد Ops انخفاض مخزون خشب الزان إلى 2.2 م³، ليقوم مدير تشغيل المحتوى بحصر الأوامر المعلقة واقتراح دفعة توريد 6 م³، ويقوم Vanguard بجدولة التسليمات لعدم التأخير، بينما يحسب Analyst الميزانية المطلوبة.',
  },
  {
    id: 'security_backup_sweep',
    title: 'تدقيق أمني شامل للعمليات والنسخ الاحتياطي اللحظي',
    subtitle: 'فحص مفاتيح الـ API ➔ مراجعة سجل الأوامر ➔ توليد نسخة احتياطية مشفرة في Postgres',
    icon: '🛡️',
    gradient: 'from-red-600/30 via-rose-600/20 to-blue-600/20',
    border: 'border-red-500/40',
    agentsInvolved: ['Security', 'Ops', 'Learner'],
    tablesAffected: ['api_keys', 'backups', 'agent_memory'],
    description: 'يقوم Security بفحص كافة مفاتيح الـ API وسجل الأوامر المحصن، ثم يطلق Ops لقطة نسخ احتياطي حقيقية مشفرة في جدول backups، ويحدث Learner مؤشر الثقة المعرفية.',
  },
];

export function EnterpriseScenarioModal({ isOpen, onClose, onScenarioCompleted }: EnterpriseScenarioModalProps) {
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0].id);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<any[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const currentScenario = SCENARIOS.find(s => s.id === selectedScenario) || SCENARIOS[0];

  const handleRun = async () => {
    setRunning(true);
    setSteps([]);
    setActiveStepIndex(0);
    setCompleted(false);

    try {
      const res = await fetch('/api/admin/agents/simulate-scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioKey: selectedScenario }),
      });

      const data = await res.json();

      if (data.success && Array.isArray(data.data?.steps)) {
        const receivedSteps = data.data.steps;
        // عرض الخطوات بتتابع سلس وواقعي
        for (let i = 0; i < receivedSteps.length; i++) {
          setActiveStepIndex(i);
          setSteps(prev => [...prev, receivedSteps[i]]);
          await new Promise(r => setTimeout(r, 600));
        }
        setCompleted(true);
        onScenarioCompleted?.();
      } else {
        alert(data.error || 'فشل تشغيل السيناريو');
      }
    } catch (err: any) {
      console.error('Scenario execution error:', err);
      alert('حدث خطأ في الاتصال بالخادم');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div 
        className="w-full max-w-4xl bg-[#0D0D0E] border border-white/15 rounded-[2.5rem] overflow-hidden shadow-2xl relative my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-lg text-xl">
              ⚡
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                محاكي العمليات الميدانية الخارق (Autonomous Scenario Engine)
              </h2>
              <p className="text-xs text-white/40 mt-0.5">
                توليد أحداث حقيقية 100% في قاعدة البيانات واختبار تفاعل الوكلاء السبعة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Scenario Selector Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  if (!running) {
                    setSelectedScenario(sc.id);
                    setSteps([]);
                    setCompleted(false);
                  }
                }}
                disabled={running}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                  selectedScenario === sc.id
                    ? `${sc.border} bg-white/[0.06] shadow-xl scale-[1.02]`
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04] text-white/60'
                }`}
              >
                <div>
                  <div className="text-2xl mb-2">{sc.icon}</div>
                  <h3 className="font-bold text-sm text-white">{sc.title}</h3>
                  <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{sc.subtitle}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
                  <span>{sc.agentsInvolved.length} وكلاء</span>
                  <span>{sc.tablesAffected.length} جداول Postgres</span>
                </div>
              </button>
            ))}
          </div>

          {/* Active Scenario Overview Box */}
          <div className={`p-5 rounded-2xl border ${currentScenario.border} bg-gradient-to-r ${currentScenario.gradient} space-y-3`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>{currentScenario.icon}</span>
                  {currentScenario.title}
                </h4>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  {currentScenario.description}
                </p>
              </div>
              <button
                onClick={handleRun}
                disabled={running}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center gap-2 shadow-xl hover:scale-105 transition-all self-start sm:self-center cursor-pointer disabled:opacity-50 disabled:scale-100"
              >
                {running ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التنفيذ في Postgres…</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>ابدأ المحاكاة الحية الآن</span>
                  </>
                )}
              </button>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10 text-[10px]">
              <span className="text-white/40 font-bold">الوكلاء المتفاعلون:</span>
              {currentScenario.agentsInvolved.map(a => (
                <span key={a} className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 font-mono">
                  {a}
                </span>
              ))}
              <span className="text-white/40 font-bold mr-2">الجداول المتأثرة:</span>
              {currentScenario.tablesAffected.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono">
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Live Multi-Agent Execution Stream */}
          {steps.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black text-white/70 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>خطوات التنفيذ التفاعلي في الوقت الفعلي (Real-Time Pipeline Execution):</span>
                </h4>
                {completed && (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    اكتملت المحاكاة وتم تحديث قاعدة البيانات بنجاح!
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex items-start gap-3.5 animate-fadeIn transition-all"
                  >
                    <div className="text-2xl p-2 rounded-xl bg-white/5 border border-white/10 flex-shrink-0">
                      {step.icon}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">{step.agentName}</span>
                          <span className="text-[10px] text-white/40">({step.role})</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                          خطوة {idx + 1}
                        </span>
                      </div>
                      <p className="text-xs text-amber-300 font-medium">{step.action}</p>
                      <p className="text-xs text-white/80 leading-relaxed">{step.result}</p>

                      {step.record && (
                        <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                          <span>📦 تم إنشاء سجل في جدول: <strong>{step.record.table}</strong></span>
                          {step.record.id && (
                            <span className="text-white/40">معرف: {step.record.id.slice(0, 8)}…</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-white/40">
          <span>كل العمليات تُسجل في جداول PostgreSQL الحقيقية ويمكن مراجعتها من لوحة الإدارة.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
