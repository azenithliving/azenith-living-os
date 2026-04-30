'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  sender_type: 'agent' | 'user' | 'system';
  sender_name: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  mentions?: string[];
}

export function ChatPanel({ agentKey }: { agentKey: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    fetchMessages();
    // refresh every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [agentKey]);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  async function fetchMessages() {
    try {
      const res = await fetch(`/api/admin/agents/messages?agent_key=${agentKey}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.data);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }
  
  async function sendMessage() {
    if (!input.trim()) return;
    
    setIsTyping(true);
    
    try {
      await fetch('/api/admin/agents/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_key: agentKey,
          content: input,
          sender_type: 'user'
        })
      });
      
      setInput('');
      await fetchMessages();
    } catch (err) {
      console.error('Error sending message:', err);
    }
    
    setIsTyping(false);
  }
  
  const getAvatarColor = (senderType: string, senderName: string) => {
    if (senderType === 'user') return 'bg-gray-600';
    if (senderName.includes('PRIME')) return 'bg-purple-500';
    if (senderName.includes('Vanguard')) return 'bg-green-500';
    return 'bg-blue-500';
  };
  
  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-[400px]">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${
            agentKey === 'prime' ? 'bg-purple-500' : 'bg-green-500'
          } flex items-center justify-center text-white text-sm font-bold`}>
            {agentKey === 'prime' ? 'P' : 'V'}
          </div>
          <span className="font-semibold">
            محادثة مع {agentKey === 'prime' ? 'PRIME' : 'Vanguard'}
          </span>
        </div>
        <span className={`w-2 h-2 rounded-full ${isTyping ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-400 py-8">ابدأ المحادثة...</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.sender_type === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`flex max-w-[80%] ${
                msg.sender_type === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full ${getAvatarColor(msg.sender_type, msg.sender_name)} 
                  flex items-center justify-center text-white text-xs font-bold flex-shrink-0
                  ${msg.sender_type === 'user' ? 'ml-2' : 'mr-2'}`}
                >
                  {msg.sender_name[0].toUpperCase()}
                </div>
                
                {/* Message Bubble */}
                <div 
                  className={`p-3 rounded-lg ${
                    msg.sender_type === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : msg.sender_type === 'agent'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800 text-sm'
                  }`}
                >
                  {msg.sender_type !== 'user' && (
                    <p className="text-xs font-semibold mb-1 opacity-75">
                      {msg.sender_name}
                    </p>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender_type === 'user' ? 'text-blue-200' : 'text-gray-400'
                  }`}>
                    {new Date(msg.created_at).toLocaleTimeString('ar-EG')}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg">
              <span className="text-sm text-gray-500 animate-pulse">يكتب...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="اكتب رسالة..."
          className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={sendMessage}
          disabled={isTyping || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 
            disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          إرسال
        </button>
      </div>
    </div>
  );
}
