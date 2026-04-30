'use client';

import { useState, useEffect } from 'react';

interface Device {
  id: string;
  device_key: string;
  device_type: string;
  hostname: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  last_seen_at: string;
  capabilities: string[];
  current_task_count: number;
  max_concurrent_tasks: number;
  agent_device_heartbeats?: Array<{
    status: string;
    recorded_at: string;
    cpu_percent?: number;
    memory_percent?: number;
    active_tasks?: number;
  }>;
}

export function DeviceCard({ device }: { device: Device }) {
  const lastHeartbeat = device.agent_device_heartbeats?.[0];
  const isOnline = device.status === 'online';
  
  // حساب وقت آخر ظهور
  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `من ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    return `من ${hours} ساعة`;
  };
  
  return (
    <div className={`p-4 rounded-lg border-2 ${
      isOnline ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
          }`} />
          <h3 className="font-bold text-lg">{device.device_key}</h3>
        </div>
        <span className={`px-2 py-1 rounded text-sm font-medium ${
          isOnline ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
        }`}>
          {device.status === 'online' ? 'متصل' : 
           device.status === 'busy' ? 'مشغول' : 
           device.status === 'error' ? 'خطأ' : 'غير متصل'}
        </span>
      </div>
      
      {/* Info */}
      <div className="text-sm text-gray-600 mb-3 space-y-1">
        <p>النوع: {device.device_type}</p>
        <p>الهوست: {device.hostname}</p>
        {lastHeartbeat && (
          <p>آخر ظهور: {getTimeAgo(lastHeartbeat.recorded_at)}</p>
        )}
      </div>
      
      {/* Metrics */}
      {lastHeartbeat && (
        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
          <div className="bg-white p-2 rounded text-center">
            <p className="font-semibold text-gray-700">المعالج</p>
            <p className={`font-bold ${
              (lastHeartbeat.cpu_percent || 0) > 80 ? 'text-red-600' : 'text-blue-600'
            }`}>
              {lastHeartbeat.cpu_percent?.toFixed(1) || 0}%
            </p>
          </div>
          <div className="bg-white p-2 rounded text-center">
            <p className="font-semibold text-gray-700">الذاكرة</p>
            <p className={`font-bold ${
              (lastHeartbeat.memory_percent || 0) > 80 ? 'text-red-600' : 'text-blue-600'
            }`}>
              {lastHeartbeat.memory_percent?.toFixed(1) || 0}%
            </p>
          </div>
          <div className="bg-white p-2 rounded text-center">
            <p className="font-semibold text-gray-700">المهام</p>
            <p className="font-bold text-blue-600">
              {lastHeartbeat.active_tasks || 0}/{device.max_concurrent_tasks}
            </p>
          </div>
        </div>
      )}
      
      {/* Capabilities */}
      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-500 mb-1">القدرات:</p>
        <div className="flex flex-wrap gap-1">
          {device.capabilities?.map((cap) => (
            <span 
              key={cap} 
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded capitalize"
            >
              {cap.replace('_', ' ')}
            </span>
          ))}
          {(!device.capabilities || device.capabilities.length === 0) && (
            <span className="text-xs text-gray-400">لا يوجد</span>
          )}
        </div>
      </div>
    </div>
  );
}
