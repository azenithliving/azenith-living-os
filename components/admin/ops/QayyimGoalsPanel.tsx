'use client';

/**
 * QayyimGoalsPanel — أهداف التحويل التي يديرها QAYYIM-UX
 */

import { useState, useEffect, useCallback } from 'react';
import { Target, Loader2, RefreshCw, PlusCircle, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface Goal {
  id: string;
  name: string;
  target_metric: string;
  target_value: number;
  current_value: number;
  page_path: string | null;
  section_key: string | null;
  deadline: string | null;
  status: 'active' | 'achieved' | 'missed' | 'cancelled';
}

const STATUS_STYLE: Record<string, { badge: string; label: string; icon: any }> = {
  active:    { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/25',         label: 'نشط',     icon: Clock },
  achieved:  { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', label: 'مُحقق', icon: CheckCircle2 },
  missed:    { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25',      label: 'فائت',    icon: XCircle },
  cancelled: { badge: 'bg-white/10 text-white/50 border-white/15',            label: 'ملغي',    icon: XCircle },
};

export function QayyimGoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', target_metric: 'conversion_rate', target_value: 5, page_path: '/', deadline_days: 30 });

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ops/goals');
      const data = await res.json();
      if (data.success) setGoals(data.goals || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  async function createGoal() {
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/ops/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_goal',
          page_path: form.page_path,
          goal: {
            name: form.name,
            target_metric: form.target_metric,
            target_value: form.target_value,
            deadline_days: form.deadline_days,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        setForm({ name: '', target_metric: 'conversion_rate', target_value: 5, page_path: '/', deadline_days: 30 });
        fetchGoals();
      }
    } catch { /* silent */ }
    finally { setCreating(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">{goals.length} هدف</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
          >
            <PlusCircle className="w-3.5 h-3.5" /> هدف جديد
          </button>
          <button
            onClick={fetchGoals}
            disabled={loading}
            className="p-1.5 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="اسم الهدف — مثال: خفض معدل الخروج من الهيرو"
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select
              value={form.target_metric}
              onChange={(e) => setForm({ ...form, target_metric: e.target.value })}
              className="rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none"
            >
              <option value="conversion_rate">معدل التحويل</option>
              <option value="exit_rate">معدل الخروج</option>
              <option value="scroll_depth">عمق التمرير</option>
              <option value="time_on_section">الزمن على القسم</option>
            </select>
            <input
              type="number"
              value={form.target_value}
              onChange={(e) => setForm({ ...form, target_value: Number(e.target.value) })}
              placeholder="القيمة المستهدفة"
              className="rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none"
              dir="ltr"
            />
            <input
              value={form.page_path}
              onChange={(e) => setForm({ ...form, page_path: e.target.value })}
              placeholder="/"
              className="rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none"
              dir="ltr"
            />
            <input
              type="number"
              value={form.deadline_days}
              onChange={(e) => setForm({ ...form, deadline_days: Number(e.target.value) })}
              placeholder="الأيام"
              className="rounded-lg bg-black/40 border border-white/10 px-2.5 py-2 text-xs text-white focus:outline-none"
              dir="ltr"
            />
          </div>
          <button
            onClick={createGoal}
            disabled={creating || !form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Target className="w-3.5 h-3.5" />}
            إنشاء الهدف
          </button>
        </div>
      )}

      {/* Goals list */}
      {loading && goals.length === 0 ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/30 text-sm">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
          لا أهداف بعد — حدّد هدفاً ليقيس QAYYIM-UX التقدم نحوه
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => {
            const st = STATUS_STYLE[goal.status] || STATUS_STYLE.active;
            const Icon = st.icon;
            const progress = goal.target_value > 0 ? Math.min(1, goal.current_value / goal.target_value) : 0;
            return (
              <div key={goal.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${st.badge}`}>
                      <Icon className="w-3 h-3" /> {st.label}
                    </span>
                    <span className="text-sm font-semibold text-white">{goal.name}</span>
                  </div>
                  <span className="text-[11px] text-white/40" dir="ltr">
                    {goal.current_value} / {goal.target_value} {goal.target_metric}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${goal.status === 'achieved' ? 'bg-emerald-400' : 'bg-sky-400'}`}
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
