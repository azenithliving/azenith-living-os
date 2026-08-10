'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';

interface Message {
  id: string;
  sender_type: 'agent' | 'user' | 'system';
  sender_name: string;
  content: string;
  created_at: string;
  isTyping?: boolean;
}

interface ChatPanelProps {
  agentKey: string;
  agentName?: string;
  agentColor?: string;
}

export function ChatPanel({ agentKey, agentName, agentColor = 'purple' }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef(`chat-${agentKey}-${Date.now()}`);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [agentKey]);

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
    if (!input.trim() || isTyping) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_type: 'user',
      sender_name: 'أنت',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setIsTyping(true);

    try {
      const res = await fetch('/api/admin/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_key: agentKey,
          message: userMessage,
          session_id: sessionIdRef.current,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.data) {
        const agentMsg: Message = {
          id: `agent-${Date.now()}`,
          sender_type: 'agent',
          sender_name: data.data.agent === 'prime' ? 'PRIME' : 'Vanguard',
          content: data.data.message,
          created_at: data.data.timestamp || new Date().toISOString(),
        };
        setMessages((prev) => [...prev, agentMsg]);
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'حدث خطأ في الاتصال');

      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        sender_type: 'system',
        sender_name: 'النظام',
        content: '⚠️ لم أتمكن من الاتصال بالوكيل. يرجى المحاولة مرة أخرى.',
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsTyping(false);
  }

  const colorClasses = {
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      bubble: 'bg-purple-500/10 border-purple-500/20',
      accent: 'bg-purple-500',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      text: 'text-emerald-400',
      bubble: 'bg-emerald-500/10 border-emerald-500/20',
      accent: 'bg-emerald-500',
    },
  };

  const colors = colorClasses[agentColor as keyof typeof colorClasses] || colorClasses.purple;

  return (
    <div className={`bg-white/[0.02] border ${colors.border} rounded-2xl flex flex-col h-[450px] overflow-hidden`}>
      <div className={`p-4 border-b ${colors.border} flex items-center justify-between ${colors.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${colors.accent} flex items-center justify-center text-white font-bold shadow-lg`}>
            {agentKey === 'prime' ? '🧠' : '💼'}
          </div>
          <div>
            <span className="font-bold text-white">
              {agentName || (agentKey === 'prime' ? 'PRIME' : 'Vanguard')}
            </span>
            <p className="text-[10px] text-white/40">
              {agentKey === 'prime' ? 'مهندس التصميم والتطوير' : 'مدير العمليات والمبيعات'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className={`w-4 h-4 ${colors.text}`} />
          <span className={`w-2 h-2 rounded-full ${isTyping ? `${colors.accent} animate-pulse` : 'bg-white/20'}`} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={`w-6 h-6 ${colors.text} animate-spin`} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <Bot className={`w-12 h-12 ${colors.text} mx-auto mb-3 opacity-30`} />
            <p className="text-white/30 text-sm">ابدأ المحادثة مع {agentName || agentKey}</p>
            <p className="text-white/20 text-xs mt-1">اسأل عن التصميم، الأسعار، المتابعة...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} agentColor={agentColor} />
          ))
        )}

        {isTyping && (
          <div className="flex justify-start">
            <div className={`p-3 rounded-2xl ${colors.bubble} border`}>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 ${colors.accent} rounded-full animate-bounce`} />
                <div className={`w-2 h-2 ${colors.accent} rounded-full animate-bounce`} style={{ animationDelay: '0.1s' }} />
                <div className={`w-2 h-2 ${colors.accent} rounded-full animate-bounce`} style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center">
            <span className="text-xs text-rose-400/70 bg-rose-500/10 px-3 py-1 rounded-full">
              {error}
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={`p-4 border-t ${colors.border}`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="اكتب رسالة..."
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
            disabled={isTyping}
          />
          <button
            onClick={sendMessage}
            disabled={isTyping || !input.trim()}
            className={`px-4 py-2.5 ${colors.accent} text-white rounded-xl hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
          >
            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, agentColor }: { message: Message; agentColor: string }) {
  const isUser = message.sender_type === 'user';
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const colorClasses = {
    purple: {
      bubble: 'bg-purple-500/10 border-purple-500/20 text-purple-100',
      name: 'text-purple-400',
    },
    emerald: {
      bubble: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100',
      name: 'text-emerald-400',
    },
  };

  const colors = colorClasses[agentColor as keyof typeof colorClasses] || colorClasses.purple;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            isUser ? 'bg-blue-500 text-white' : `${colors.bubble} border`
          }`}
        >
          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
        </div>

        <div>
          <p className={`text-[10px] mb-0.5 ${isUser ? 'text-blue-400' : colors.name}`}>
            {message.sender_name}
          </p>
          <div
            className={`p-3 rounded-2xl ${
              isUser
                ? 'bg-blue-600 text-white rounded-tr-md'
                : `${colors.bubble} border rounded-tl-md`
            }`}
          >
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
          </div>
          <p className="text-[9px] text-white/20 mt-1">
            {new Date(message.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    </div>
  );
}
