'use client';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: number;
  agent_profiles?: { agent_key: string; name: string };
  created_at: string;
  progress_percent: number;
  description?: string;
}

export function TaskQueue() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchTasks();
    // تحديث كل 5 ثواني
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [filter]);
  
  async function fetchTasks() {
    try {
      const url = filter === 'all' 
        ? '/api/admin/agents/tasks'
        : `/api/admin/agents/tasks?status=${filter}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTasks(data.data);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setLoading(false);
    }
  }
  
  const getPriorityColor = (p: number) => {
    if (p >= 5) return 'text-red-600 bg-red-100 border-red-300';
    if (p >= 0) return 'text-yellow-600 bg-yellow-100 border-yellow-300';
    return 'text-green-600 bg-green-100 border-green-300';
  };
  
  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'قيد الانتظار',
      'queued': 'في الطابور',
      'running': 'جاري التنفيذ',
      'completed': 'مكتمل',
      'failed': 'فاشل',
      'cancelled': 'ملغي'
    };
    return map[status] || status;
  };
  
  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-800',
      'queued': 'bg-blue-100 text-blue-800',
      'running': 'bg-green-100 text-green-800 animate-pulse',
      'completed': 'bg-green-500 text-white',
      'failed': 'bg-red-500 text-white',
      'cancelled': 'bg-gray-400 text-white'
    };
    return map[status] || 'bg-gray-100';
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">قائمة المهام</h2>
        <div className="flex items-center gap-2">
          <select 
            value={filter} 
            onChange={(e) => {
              setFilter(e.target.value);
              setLoading(true);
            }}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="all">الكل</option>
            <option value="pending">قيد الانتظار</option>
            <option value="running">جاري التنفيذ</option>
            <option value="completed">مكتمل</option>
            <option value="failed">فاشل</option>
          </select>
          <span className="text-sm text-gray-500">
            ({tasks.length} مهمة)
          </span>
        </div>
      </div>
      
      {/* Tasks List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-500">جاري التحميل...</p>
          </div>
        ) : tasks.length === 0 ? (
          <p className="text-center text-gray-500 py-8">لا توجد مهام</p>
        ) : (
          tasks.map((task) => (
            <div 
              key={task.id} 
              className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${getPriorityColor(task.priority)}`}>
                      أولوية {task.priority > 0 ? '+' : ''}{task.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(task.status)}`}>
                      {getStatusText(task.status)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {task.agent_profiles?.name || task.agent_profiles?.agent_key}
                    </span>
                  </div>
                  <p className="font-medium">{task.title}</p>
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{task.description}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap mr-2">
                  {new Date(task.created_at).toLocaleTimeString('ar-EG')}
                </span>
              </div>
              
              {/* Progress Bar */}
              {task.status === 'running' && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>التقدم</span>
                    <span>{task.progress_percent}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded">
                    <div 
                      className="h-full bg-blue-500 rounded transition-all duration-500"
                      style={{ width: `${task.progress_percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
