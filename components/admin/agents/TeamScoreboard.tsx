'use client';

import { useState, useEffect } from 'react';

interface AgentStats {
  agent_key: string;
  agent_name: string;
  tasks_completed: number;
  tasks_failed: number;
  avg_completion_time: number; // minutes
  customer_satisfaction: number; // 1-5
  achievements: string[];
  streak_days: number;
}

export function TeamScoreboard() {
  const [stats, setStats] = useState<AgentStats[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  async function fetchStats() {
    try {
      const res = await fetch('/api/admin/agents/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  }
  
  const getAgentColor = (key: string) => {
    if (key === 'prime') return 'border-purple-500 bg-purple-50';
    if (key === 'vanguard') return 'border-green-500 bg-green-50';
    return 'border-blue-500 bg-blue-50';
  };
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse h-48 bg-gray-200 rounded" />
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold mb-4">لوحة متابعة الفريق</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.agent_key} 
            className={`border-2 rounded-lg p-4 ${getAgentColor(stat.agent_key)}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                  stat.agent_key === 'prime' ? 'bg-purple-500' : 'bg-green-500'
                }`}>
                  {stat.agent_key[0].toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold capitalize">{stat.agent_name}</h4>
                  {stat.streak_days > 0 && (
                    <span className="text-xs text-orange-600">
                      🔥 {stat.streak_days} يوم متتالي
                    </span>
                  )}
                </div>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {stat.tasks_completed}
              </div>
            </div>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
              <div className="bg-white p-2 rounded shadow-sm">
                <p className="text-green-600 font-semibold">✓ مكتمل</p>
                <p className="text-lg font-bold">{stat.tasks_completed}</p>
              </div>
              <div className="bg-white p-2 rounded shadow-sm">
                <p className="text-red-600 font-semibold">✗ فاشل</p>
                <p className="text-lg font-bold">{stat.tasks_failed}</p>
              </div>
              <div className="bg-white p-2 rounded shadow-sm">
                <p className="text-blue-600 font-semibold">⏱ متوسط الوقت</p>
                <p className="text-lg font-bold">{stat.avg_completion_time}د</p>
              </div>
              <div className="bg-white p-2 rounded shadow-sm">
                <p className="text-yellow-600 font-semibold">★ تقييم</p>
                <p className="text-lg font-bold">{stat.customer_satisfaction}/5</p>
              </div>
            </div>
            
            {/* Achievements */}
            {stat.achievements.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {stat.achievements.map((ach, i) => (
                  <span 
                    key={i} 
                    className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full"
                  >
                    🏆 {ach}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {stats.length === 0 && (
          <div className="col-span-2 text-center py-8 text-gray-500">
            لا توجد إحصائيات متاحة
          </div>
        )}
      </div>
    </div>
  );
}
