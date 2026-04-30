'use client';

import { useState, useEffect } from 'react';

interface PendingApproval {
  id: string;
  request_type: 'order' | 'expense' | 'refund' | 'custom';
  title: string;
  description: string;
  amount?: number;
  requested_by: string;
  requested_at: string;
  context?: any;
}

export function ApprovalGate() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  
  useEffect(() => {
    fetchApprovals();
    // refresh every 30 seconds
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, []);
  
  async function fetchApprovals() {
    try {
      const res = await fetch('/api/admin/agents/approval-queue');
      const data = await res.json();
      if (data.success) {
        setApprovals(data.data);
      }
    } catch (err) {
      console.error('Error fetching approvals:', err);
    } finally {
      setLoading(false);
    }
  }
  
  async function handleDecision(id: string, decision: 'approved' | 'rejected') {
    setProcessing(id);
    
    try {
      const res = await fetch('/api/admin/agents/approval/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approval_id: id, decision })
      });
      
      const data = await res.json();
      
      if (data.success) {
        // remove from list
        setApprovals(prev => prev.filter(a => a.id !== id));
      }
    } catch (err) {
      console.error('Error submitting decision:', err);
    } finally {
      setProcessing(null);
    }
  }
  
  const getTypeText = (type: string) => {
    const map: Record<string, string> = {
      'order': 'طلبية',
      'expense': 'مصروفات',
      'refund': 'استرداد',
      'custom': 'مخصص'
    };
    return map[type] || type;
  };
  
  const getTypeColor = (type: string) => {
    const map: Record<string, string> = {
      'order': 'bg-blue-100 text-blue-800',
      'expense': 'bg-red-100 text-red-800',
      'refund': 'bg-yellow-100 text-yellow-800',
      'custom': 'bg-gray-100 text-gray-800'
    };
    return map[type] || 'bg-gray-100';
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">طلبات الموافقة</h2>
        {approvals.length > 0 && (
          <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
            {approvals.length} معلقة
          </span>
        )}
      </div>
      
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : approvals.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-2">لا توجد طلبات معلقة</p>
          <p className="text-sm text-gray-400">كل الأمور تمام! ✓</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {approvals.map((approval) => (
            <div key={approval.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getTypeColor(approval.request_type)}`}>
                      {getTypeText(approval.request_type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(approval.requested_at).toLocaleString('ar-EG')}
                    </span>
                  </div>
                  <h3 className="font-semibold text-lg">{approval.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{approval.description}</p>
                  
                  {approval.amount && (
                    <p className="text-lg font-bold text-blue-600 mt-2">
                      {approval.amount.toLocaleString()} EGP
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-sm text-gray-500">
                  طلب من: {approval.requested_by}
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecision(approval.id, 'rejected')}
                    disabled={processing === approval.id}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing === approval.id ? 'جاري...' : 'رفض'}
                  </button>
                  <button
                    onClick={() => handleDecision(approval.id, 'approved')}
                    disabled={processing === approval.id}
                    className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {processing === approval.id ? 'جاري...' : 'موافقة'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
