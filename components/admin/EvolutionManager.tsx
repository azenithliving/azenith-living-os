"use client";

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-client';
import { GitBranch, Check, X, RefreshCw, ChevronDown, ChevronUp, Code, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const supabase = createSupabaseBrowserClient();

const typeMap: Record<string, string> = {
  'logic': 'منطق العمل',
  'api': 'ربط خارجي',
  'ui': 'واجهة المستخدم',
};

export function EvolutionManager() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [approvedLogs, setApprovedLogs] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: pendingData } = await supabase
      .from('evolution_log')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (pendingData) setProposals(pendingData);

    const { data: approvedData } = await supabase
      .from('evolution_log')
      .select('*')
      .eq('status', 'approved')
      .order('approved_at', { ascending: false })
      .limit(10);
    if (approvedData) setApprovedLogs(approvedData);
  };

  useEffect(() => {
    fetchData();

    // Real-time: new proposals appear automatically
    const channel = supabase
      .channel('evolution-log-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evolution_log' }, (payload) => {
        if (payload.new.status === 'pending') {
          setProposals(prev => {
            // Prevent duplicates
            if (prev.some(p => p.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'evolution_log' }, (payload) => {
        if (payload.new.status === 'approved') {
          setProposals(prev => prev.filter(p => p.id !== payload.new.id));
          setApprovedLogs(prev => {
            if (prev.some(p => p.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
        } else if (payload.new.status === 'rejected') {
          setProposals(prev => prev.filter(p => p.id !== payload.new.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const res = await fetch('/api/admin/intel/evolve/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      const data = await res.json();

      if (data.success) {
        toast.success(status === 'approved' ? 'تم اعتماد التحسين وحقنه في نواة النظام بنجاح ✅' : 'تم تجاهل المقترح');
        // Real-time subscription will handle the UI update
        // But we also do it locally for instant feedback
        if (status === 'approved') {
          const item = proposals.find(p => p.id === id);
          if (item) {
            setApprovedLogs(prev => [{ ...item, status: 'approved', approved_at: new Date().toISOString() }, ...prev]);
          }
        }
        setProposals(prev => prev.filter(p => p.id !== id));
      } else {
        toast.error("فشلت العملية: " + data.error);
      }
    } catch (err: any) {
      toast.error("خطأ في الاتصال بالخادم");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-blue-500/20 bg-black/40 p-6 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <GitBranch className="h-5 w-5 text-blue-400" />
            قرارات التطور السيادي
          </h3>
          <p className="text-xs text-white/50">اعتماد ومراقبة تحسينات الذكاء الاصطناعي</p>
        </div>
        <div className="flex gap-2 bg-black/50 p-1 rounded-lg border border-white/5">
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'pending' ? 'bg-blue-500/20 text-blue-400' : 'text-white/40 hover:text-white/80'}`}
          >
            المقترحات ({proposals.length})
          </button>
          <button 
            onClick={() => setActiveTab('approved')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/40 hover:text-white/80'}`}
          >
            المنفذة ({approvedLogs.length})
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Pending Proposals */}
        {activeTab === 'pending' && proposals.map((prop) => (
          <div key={`pending-${prop.id}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 transition-all hover:bg-white/[0.05]">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <span className="inline-block px-2 py-0.5 rounded bg-blue-500/20 text-[10px] uppercase tracking-wider text-blue-400 mb-2">
                  {typeMap[prop.change_type] || prop.change_type}
                </span>
                <h4 className="text-md font-bold text-white leading-relaxed">
                  {prop.description}
                </h4>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-emerald-400">
                  تحسن متوقع: {prop.performance_gain_predicted}%
                </span>
              </div>
            </div>
            
            <div className="mb-4">
              <button 
                onClick={() => setExpandedId(expandedId === prop.id ? null : prop.id)}
                className="flex items-center gap-2 text-[11px] text-white/40 hover:text-white/60 transition-colors"
              >
                <Code className="h-3 w-3" />
                {expandedId === prop.id ? 'إخفاء التفاصيل التقنية' : 'إظهار التفاصيل التقنية (للمبرمجين)'}
                {expandedId === prop.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" /> }
              </button>
              
              {expandedId === prop.id && (
                <pre className="mt-2 max-h-32 overflow-y-auto rounded bg-black/60 p-2 text-[10px] text-white/40 font-mono" dir="ltr">
                  {prop.proposed_patch}
                </pre>
              )}
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => handleDecision(prop.id, 'approved')}
                disabled={processingId === prop.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-500/20 py-3 text-sm font-bold text-emerald-400 transition-all hover:bg-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {processingId === prop.id ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {processingId === prop.id ? 'جاري الحقن...' : 'اعتماد التحسين'}
              </button>
              <button 
                onClick={() => handleDecision(prop.id, 'rejected')}
                disabled={processingId === prop.id}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-500/20 py-3 text-sm font-bold text-rose-400 transition-all hover:bg-rose-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                <X className="h-4 w-4" /> تجاهل
              </button>
            </div>
          </div>
        ))}
        
        {activeTab === 'pending' && proposals.length === 0 && (
          <div className="text-center py-10">
            <RefreshCw className="h-8 w-8 text-white/10 mx-auto mb-2 animate-spin" style={{ animationDuration: '3s' }} />
            <p className="text-white/30 text-sm">لا توجد مقترحات بانتظار سيادتك. النظام يعمل بكفاءة.</p>
          </div>
        )}

        {/* Approved / Executed */}
        {activeTab === 'approved' && approvedLogs.map((log) => (
          <div key={`approved-${log.id}`} className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.02] p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-[10px] tracking-wider text-emerald-400 mb-2">
                  <CheckCircle2 className="h-3 w-3" /> تم التنفيذ والحقن
                </span>
                <h4 className="text-md font-bold text-white/80 leading-relaxed">
                  {log.description}
                </h4>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-white/30">
                  <Clock className="h-3 w-3" />
                  {log.approved_at ? new Date(log.approved_at).toLocaleString('ar-SA') : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {activeTab === 'approved' && approvedLogs.length === 0 && (
          <div className="text-center py-10">
            <p className="text-white/30 text-sm">لم يتم اعتماد أي تحسينات حتى الآن.</p>
          </div>
        )}
      </div>
    </div>
  );
}
