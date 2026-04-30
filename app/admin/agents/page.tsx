'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DeviceCard } from '@/components/admin/agents/DeviceCard';
import { TaskQueue } from '@/components/admin/agents/TaskQueue';
import { CommandConsole } from '@/components/admin/agents/CommandConsole';
import { ApprovalGate } from '@/components/admin/agents/ApprovalGate';
import { ChatPanel } from '@/components/admin/agents/ChatPanel';
import { GroupChatView } from '@/components/admin/agents/GroupChatView';

export default function AgentsPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupChat, setShowGroupChat] = useState(false);
  const [showPrimeChat, setShowPrimeChat] = useState(false);
  const [showVanguardChat, setShowVanguardChat] = useState(false);

  useEffect(() => {
    async function getDevices() {
      try {
        const res = await fetch('/api/admin/agents/devices');
        const data = await res.json();
        console.log('[DEBUG] Devices response:', data);
        setDevices(data.data || []);
      } catch (error) {
        console.error('[ERROR] Failed to fetch devices:', error);
        setDevices([]);
      } finally {
        setLoading(false);
      }
    }
    getDevices();
  }, []);
  
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مركز التحكم بالـ Agents</h1>
          <p className="text-gray-600 mt-1">
            إدارة PRIME (المهندس) و Vanguard (المبيعات)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
            PRIME ⚡
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            Vanguard 📞
          </span>
        </div>
      </div>
      
      {/* Devices Grid */}
      <section>
        <h2 className="text-xl font-semibold mb-4">الأجهزة المتصلة</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-gray-100 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device: any) => (
              <DeviceCard key={device.id} device={device} />
            ))}
            {devices.length === 0 && (
              <div className="col-span-full p-8 text-center bg-gray-50 rounded-lg">
                <p className="text-gray-500">لا توجد أجهزة متصلة</p>
                <p className="text-sm text-gray-400 mt-1">
                  شغّل Docker: docker-compose up -d
                </p>
              </div>
            )}
          </div>
        )}
      </section>
      
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <TaskQueue />
          <CommandConsole />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          <ApprovalGate />
          
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-semibold mb-3">إجراءات سريعة</h3>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowPrimeChat(true)}
                className="p-3 bg-purple-100 text-purple-800 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium"
              >
                ⚡ محادثة PRIME
              </button>
              <button 
                onClick={() => setShowVanguardChat(true)}
                className="p-3 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
              >
                📞 محادثة Vanguard
              </button>
              <button 
                onClick={() => setShowGroupChat(true)}
                className="p-3 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                💬 محادثة جماعية
              </button>
              <button 
                onClick={async () => {
                  if (!confirm('⚠️ هل أنت متأكد؟\n\nهذا سيوقف كل الـ Agents فوراً!')) return;
                  try {
                    await fetch('/api/admin/owner/emergency-stop', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'trigger', reason: 'Manual from agents page' })
                    });
                    alert('🛑 تم تفعيل الإيقاف الطارئ');
                  } catch {
                    alert('❌ فشل في تفعيل الإيقاف الطارئ');
                  }
                }}
                className="p-3 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
              >
                🛑 إيقاف طوارئ
              </button>
            </div>
          </div>

          {/* Chat Modals */}
          {showPrimeChat && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPrimeChat(false)}>
              <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
                <ChatPanel agentKey="prime" />
              </div>
            </div>
          )}
          {showVanguardChat && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowVanguardChat(false)}>
              <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
                <ChatPanel agentKey="vanguard" />
              </div>
            </div>
          )}
          {showGroupChat && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowGroupChat(false)}>
              <div className="w-full max-w-md" onClick={e => e.stopPropagation()}>
                <GroupChatView onClose={() => setShowGroupChat(false)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
