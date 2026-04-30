'use client';

import { useState, useEffect } from 'react';

interface Handoff {
  id: string;
  from_agent: string;
  to_agent: string;
  context_summary: string;
  handoff_reason: string;
  status: 'pending' | 'acknowledged' | 'completed';
  acknowledged_at: string | null;
  created_at: string;
}

export function HandoffInterface() {
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchHandoffs();
    // refresh every 10 seconds
    const interval = setInterval(fetchHandoffs, 10000);
    return () => clearInterval(interval);
  }, []);
  
  async function fetchHandoffs() {
    try {
      const res = await fetch('/api/admin/agents/handoffs?status=pending');
      const data = await res.json();
      if (data.success) {
        setHandoffs(data.data);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching handoffs:', err);
      setLoading(false);
    }
  }
  
  async function acknowledge(handoffId: string) {
    try {
      await fetch(`/api/admin/agents/handoffs/${handoffId}/acknowledge`, {
        method: 'POST'
      });
      fetchHandoffs();
    } catch (err) {
      console.error('Error acknowledging handoff:', err);
    }
  }
  
  const getAgentColor = (agent: string) => {
    if (agent.includes('prime') || agent.includes('PRIME')) return 'bg-purple-100 text-purple-800';
    if (agent.includes('vanguard') || agent.includes('Vanguard')) return 'bg-green-100 text-green-800';
    return 'bg-blue-100 text-blue-800';
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">تسليم المهام بين الـ Agents</h3>
        {handoffs.length > 0 && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
            {handoffs.length} معلق
          </span>
        )}
      </div>
      
      {loading ? (
        <div className="text-center py-4">
          <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : handoffs.length === 0 ? (
        <p className="text-center text-gray-500 py-4">لا توجد تسليمات معلقة</p>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {handoffs.map((handoff) => (
            <div 
              key={handoff.id} 
              className="border rounded-lg p-3 bg-gradient-to-r from-yellow-50 to-white hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getAgentColor(handoff.from_agent)}`}>
                  {handoff.from_agent}
                </span>
                <span className="text-gray-400">→</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getAgentColor(handoff.to_agent)}`}>
                  {handoff.to_agent}
                </span>
                <span className="text-xs text-gray-500 mr-auto">
                  {new Date(handoff.created_at).toLocaleTimeString('ar-EG')}
                </span>
              </div>
              
              <p className="text-sm font-medium mb-1">{handoff.handoff_reason}</p>
              <p className="text-xs text-gray-600 mb-3 line-clamp-2">{handoff.context_summary}</p>
              
              {handoff.status === 'pending' && (
                <button
                  onClick={() => acknowledge(handoff.id)}
                  className="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
                >
                  تأكيد الاستلام
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
