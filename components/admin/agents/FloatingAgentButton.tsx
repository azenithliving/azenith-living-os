'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, X, Bot, Users, Brain, Briefcase } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { GroupChatView } from './GroupChatView';

export function FloatingAgentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'prime' | 'vanguard' | 'group'>('prime');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Initialize position from bottom-right
  useEffect(() => {
    setPosition({
      x: window.innerWidth - 100,
      y: window.innerHeight - 100
    });
  }, []);

  // Drag handlers
  function handleMouseDown(e: React.MouseEvent) {
    if (!isOpen) {
      setIsDragging(true);
    }
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (isDragging) {
        setPosition({
          x: Math.max(20, Math.min(window.innerWidth - 80, e.clientX - 40)),
          y: Math.max(20, Math.min(window.innerHeight - 80, e.clientY - 40))
        });
      }
    }

    function handleMouseUp() {
      setIsDragging(false);
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <>
      {/* Floating Panel */}
      {isOpen && (
        <div
          className="fixed z-50 w-[400px] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
          style={{
            right: '20px',
            bottom: '100px'
          }}
        >
          {/* Panel Header */}
          <div className="flex items-center border-b border-gray-200">
            <button
              onClick={() => setActiveTab('prime')}
              className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'prime'
                  ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Brain className="w-4 h-4" />
              PRIME
            </button>
            <button
              onClick={() => setActiveTab('vanguard')}
              className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'vanguard'
                  ? 'bg-green-50 text-green-700 border-b-2 border-green-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              Vanguard
            </button>
            <button
              onClick={() => setActiveTab('group')}
              className={`flex-1 py-3 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'group'
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="w-4 h-4" />
              الجماعية
            </button>
          </div>

          {/* Panel Content */}
          <div className="h-[400px]">
            {activeTab === 'prime' && (
              <ChatPanel agentKey="prime" />
            )}
            {activeTab === 'vanguard' && (
              <ChatPanel agentKey="vanguard" />
            )}
            {activeTab === 'group' && (
              <GroupChatView
                participants={['PRIME', 'Vanguard', 'You']}
                onClose={() => setIsOpen(false)}
              />
            )}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onMouseDown={handleMouseDown}
        onClick={() => !isDragging && setIsOpen(!isOpen)}
        className={`fixed z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
          isOpen 
            ? 'bg-red-500 hover:bg-red-600 text-white rotate-45' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        style={{
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            {/* Notification dot */}
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
          </div>
        )}
      </button>

      {/* Tooltip when not open */}
      {!isOpen && (
        <div 
          className="fixed z-40 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg pointer-events-none opacity-0 hover:opacity-100 transition-opacity"
          style={{
            left: position.x - 60,
            top: position.y - 35
          }}
        >
          اضغط للمحادثة
          <br />
          اسحب للنقل
        </div>
      )}
    </>
  );
}
