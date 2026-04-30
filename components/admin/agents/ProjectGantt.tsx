'use client';

import { useState, useEffect } from 'react';

interface Job {
  id: string;
  title: string;
  customer_name: string;
  start: Date;
  end: Date;
  status: string;
  stage_name: string;
  assigned_to?: string;
  progress: number;
}

export function ProjectGantt({ salesOrderId }: { salesOrderId?: string }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [timeRange, setTimeRange] = useState(14);  // days
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchJobs();
  }, [salesOrderId]);
  
  async function fetchJobs() {
    try {
      const url = salesOrderId 
        ? `/api/admin/manufacturing/schedule?sales_order_id=${salesOrderId}`
        : '/api/admin/manufacturing/schedule';
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.success) {
        setJobs(data.data.map((j: any) => ({
          id: j.id,
          title: j.title || `Job ${j.id.slice(0, 8)}`,
          customer_name: j.customer_name || 'Unknown',
          start: new Date(j.scheduled_start || j.created_at),
          end: new Date(j.scheduled_end || j.created_at),
          status: j.status,
          stage_name: j.stage_name || 'Unknown',
          assigned_to: j.assigned_to_name,
          progress: j.progress_percent || 0
        })));
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Generate days array
  const days = Array.from({ length: timeRange }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
  
  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'bg-gray-400',
      'scheduled': 'bg-blue-400',
      'in_progress': 'bg-green-500',
      'completed': 'bg-green-600',
      'on_hold': 'bg-yellow-500',
      'cancelled': 'bg-red-500'
    };
    return map[status] || 'bg-gray-400';
  };
  
  const getDayWidth = () => {
    // Responsive width based on time range
    if (timeRange <= 7) return 80;
    if (timeRange <= 14) return 50;
    if (timeRange <= 30) return 30;
    return 20;
  };
  
  const dayWidth = getDayWidth();
  
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse h-64 bg-gray-200 rounded" />
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">جدول المشاريع (Gantt)</h3>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value={7}>أسبوع</option>
          <option value={14}>أسبوعين</option>
          <option value={30}>شهر</option>
          <option value={60}>شهرين</option>
        </select>
      </div>
      
      {/* Gantt Chart */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Days Header */}
          <div className="flex border-b">
            <div className="w-48 flex-shrink-0 p-2 font-semibold text-sm bg-gray-50">المهمة</div>
            <div className="flex">
              {days.map((d, i) => (
                <div 
                  key={i} 
                  className={`text-center text-xs py-1 border-l ${
                    d.getDay() === 5 || d.getDay() === 6 ? 'bg-red-50' : 'bg-gray-50'
                  }`}
                  style={{ width: dayWidth }}
                >
                  <div className="font-semibold">{d.getDate()}</div>
                  <div className="text-gray-500">
                    {d.toLocaleDateString('ar-EG', { weekday: 'narrow' })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Jobs */}
          {jobs.map((job) => (
            <div key={job.id} className="flex border-b hover:bg-gray-50">
              {/* Job Info */}
              <div className="w-48 flex-shrink-0 p-2 text-sm">
                <div className="font-medium truncate">{job.title}</div>
                <div className="text-xs text-gray-500">{job.customer_name}</div>
                <div className="text-xs text-gray-400">{job.stage_name}</div>
                {job.assigned_to && (
                  <div className="text-xs text-blue-600">{job.assigned_to}</div>
                )}
              </div>
              
              {/* Timeline */}
              <div className="flex relative" style={{ height: 40 }}>
                {days.map((d, i) => (
                  <div 
                    key={i} 
                    className={`border-l ${
                      d.getDay() === 5 || d.getDay() === 6 ? 'bg-red-50/50' : ''
                    }`}
                    style={{ width: dayWidth }}
                  />
                ))}
                
                {/* Job Bar */}
                {job.start && job.end && (
                  <div
                    className={`absolute h-6 rounded top-2 ${getStatusColor(job.status)} 
                      shadow-sm cursor-pointer hover:opacity-80 transition-opacity`}
                    style={{
                      left: `${Math.max(0, Math.floor((job.start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))) * dayWidth}px`,
                      width: `${Math.max(dayWidth, Math.ceil((job.end.getTime() - job.start.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth)}px`
                    }}
                    title={`${job.title}: ${job.start.toLocaleDateString('ar-EG')} - ${job.end.toLocaleDateString('ar-EG')}`}
                  >
                    {/* Progress */}
                    <div 
                      className="h-full bg-white/30 rounded"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {jobs.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              لا توجد مهام مجدولة
            </div>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-400" />
          <span>معلّق</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-400" />
          <span>مجدول</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>جاري</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-600" />
          <span>مكتمل</span>
        </div>
      </div>
    </div>
  );
}
