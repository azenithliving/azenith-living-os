'use client';

/**
 * QayyimDraftPreview — إدارة المسودات: عرض، معاينة، نشر، تراجع
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Loader2, RefreshCw, Eye, UploadCloud,
  Undo2, XCircle, Clock, CheckCircle2
} from 'lucide-react';

interface Draft {
  id: string;
  created_by: string;
  target_path: string;
  target_table: string;
  draft_type: string;
  status: 'draft' | 'previewing' | 'published' | 'rejected' | 'rolled_back';
  version: number;
  proposed: any;
  previous?: any;
  created_at: string;
  preview_token?: string;
}

const STATUS_STYLE: Record<string, { badge: string; label: string }> = {
  draft:       { badge: 'bg-white/10 text-white/60 border-white/15',        label: 'مسودة' },
  previewing:  { badge: 'bg-sky-500/15 text-sky-300 border-sky-500/25',     label: 'معاينة' },
  published:   { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', label: 'منشور' },
  rejected:    { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25',  label: 'مرفوض' },
  rolled_back: { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/25', label: 'متراجع عنه' },
};

export function QayyimDraftPreview() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/qayyim?action=list_drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setDrafts(data.drafts || data.result?.drafts || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleAction(draftId: string, action: 'publish' | 'rollback') {
    if (acting) return;
    setActing(draftId);
    try {
      const endpoint = action === 'publish' ? '/api/admin/qayyim/publish' : '/api/admin/qayyim/rollback';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_id: draftId, approved_by: 'admin' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(action === 'publish' ? 'تم النشر بنجاح' : 'تم التراجع بنجاح', true);
        fetchDrafts();
      } else {
        showToast(typeof data.error === 'string' ? data.error : 'فشلت العملية', false);
      }
    } catch (e: any) {
      showToast(e.message || 'خطأ في الاتصال', false);
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-white/50">{drafts.length} مسودة</div>
        <button
          onClick={fetchDrafts}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-white/60 hover:bg-white/5 transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          تحديث
        </button>
      </div>

      {loading && drafts.length === 0 ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : drafts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-white/30 text-sm">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          لا توجد مسودات بعد — أنشئ واحدة عبر وكلاء المحتوى أو المرئيات أو SEO
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const st = STATUS_STYLE[draft.status] || STATUS_STYLE.draft;
            const isExpanded = expanded === draft.id;
            const isActing = acting === draft.id;
            const canPublish = draft.status === 'draft' || draft.status === 'previewing';
            const canRollback = draft.status === 'published';
            return (
              <div key={draft.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <button
                  onClick={() => setExpanded(isExpanded ? null : draft.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-white/[0.03] transition-colors"
                >
                  <span className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0 ${st.badge}`}>{st.label}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{draft.draft_type || 'content_update'} — v{draft.version}</div>
                    <div className="text-[11px] text-white/40 truncate" dir="ltr">{draft.target_path} · {draft.target_table} · {draft.created_by}</div>
                  </div>
                  <span className="text-[10px] text-white/30 flex items-center gap-1 shrink-0">
                    <Clock className="w-3 h-3" />
                    {new Date(draft.created_at).toLocaleDateString('ar-EG')}
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
                    <pre className="rounded-lg bg-black/40 border border-white/10 p-3 text-[11px] text-white/70 overflow-x-auto max-h-48" dir="ltr">
                      {JSON.stringify(draft.proposed, null, 2)}
                    </pre>
                    <div className="flex items-center gap-2">
                      {draft.preview_token && (
                        <a
                          href={`/api/admin/qayyim/preview/${draft.preview_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300 text-xs font-medium hover:bg-sky-500/20 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> معاينة حية
                        </a>
                      )}
                      {canPublish && (
                        <button
                          onClick={() => handleAction(draft.id, 'publish')}
                          disabled={isActing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
                        >
                          {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                          نشر
                        </button>
                      )}
                      {canRollback && (
                        <button
                          onClick={() => handleAction(draft.id, 'rollback')}
                          disabled={isActing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                        >
                          {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
                          تراجع
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium shadow-2xl ${
          toast.ok ? 'bg-emerald-950/95 border-emerald-500/30 text-emerald-200' : 'bg-rose-950/95 border-rose-500/30 text-rose-200'
        }`}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
