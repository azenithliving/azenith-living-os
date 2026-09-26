'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, Users, AtSign, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  sender_type: 'agent' | 'user' | 'system';
  sender_name: string;
  sender_avatar?: string;
  content: string;
  timestamp: string;
  mentions?: string[];
  isTyping?: boolean;
}

interface GroupChatViewProps {
  conversationId?: string;
  participants?: string[];
  onClose?: () => void;
}

const AGENT_PERSONAS: Record<string, { name: string; role: string; color: string }> = {
  'OPS-LEAD': { name: 'مدير تشغيل المحتوى', role: 'قائد سرب أزينث — إطلالة الموقع', color: 'amber' },
  Vanguard:      { name: 'Vanguard',   role: 'مدير العمليات والمبيعات',          color: 'emerald' },
  Analyst:       { name: 'Analyst',    role: 'محلل البيانات والتقارير',           color: 'blue' },
  Coder:         { name: 'Coder',      role: 'مطور الكود والتقنية',              color: 'cyan' },
  Ops:           { name: 'Ops',        role: 'مراقب العمليات والنظام',            color: 'yellow' },
  Security:      { name: 'Security',   role: 'حارس الأمن والتدقيق',             color: 'red' },
  Learner:       { name: 'Learner',    role: 'محرك التعلم الذاتي',               color: 'indigo' },
};

export function GroupChatView({
  conversationId = 'group-chat',
  participants = ['OPS-LEAD', 'Vanguard', 'Analyst', 'Coder', 'Ops', 'Security', 'Learner', 'You'],
  onClose,
}: GroupChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender_type: 'system',
      sender_name: 'System',
      content: `👋 مرحباً! تم بدء محادثة جماعية بين الوكلاء — يمكنك التحدث للجميع أو مخاطبة وكيل محدد بكتابة اسمه أو @اسم_الوكيل.`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeParticipants, setActiveParticipants] = useState<string[]>(
    participants.filter((p) => p !== 'You')
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages, scrollToBottom]);

  const addMessage = useCallback((message: Partial<Message>) => {
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sender_type: 'user',
      sender_name: 'Unknown',
      content: '',
      timestamp: new Date().toISOString(),
      ...message,
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const callAgentAPI = useCallback(
    async (agentKey: string, userMessage: string, mention: string) => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch('/api/admin/agents/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_key: agentKey.toLowerCase(),
            message: userMessage,
            context: { source: 'group_chat', mention },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `API error: ${res.status}`);
        }

        const data = await res.json();
        if (data.success && data.data?.message) {
          return data.data.message;
        }

        throw new Error(data.error || 'تعذر استلام رد من الوكيل');
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        console.error(`[GroupChat] Agent ${agentKey} error:`, err);
        return `⚠️ تعذر استلام رد من ${agentKey}: ${err.message || 'خطأ في الاتصال'}`;
      }
    },
    []
  );

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMsg = inputMessage.trim();
    setInputMessage('');
    setError(null);

    addMessage({
      sender_type: 'user',
      sender_name: 'You',
      content: userMsg,
    });

    const mentions = userMsg.match(/@\w+/g) || [];
    const mentionedAgents = mentions.map((m) => m.substring(1));
    const agentsToRespond =
      mentionedAgents.length > 0
        ? mentionedAgents.filter((a) =>
            Object.keys(AGENT_PERSONAS).some((p) => p.toLowerCase() === a.toLowerCase())
          )
        : activeParticipants.length > 2
          ? activeParticipants.slice(0, 2)
          : activeParticipants;

    if (agentsToRespond.length === 0) {
      addMessage({
        sender_type: 'system',
        sender_name: 'System',
        content: '⚠️ لم يتم تحديد أي وكيل متاح. يرجى تفعيل وكيل من القائمة أعلاه.',
      });
      return;
    }

    setIsLoading(true);

    for (const agentName of agentsToRespond) {
      const typingId = addMessage({
        sender_type: 'agent',
        sender_name: agentName,
        content: '...',
        isTyping: true,
      });

      const response = await callAgentAPI(agentName, userMsg, `@${agentName}`);

      if (response) {
        updateMessage(typingId, {
          content: response,
          isTyping: false,
          timestamp: new Date().toISOString(),
        });
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== typingId));
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    setIsLoading(false);
  }, [inputMessage, isLoading, activeParticipants, addMessage, updateMessage, callAgentAPI]);

  function toggleParticipant(name: string) {
    if (name === 'You') return;
    setActiveParticipants((prev) =>
      prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]
    );
  }

  return (
    <div className="bg-[#111] rounded-2xl shadow-2xl flex flex-col h-[520px] border border-white/10">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">المحادثة الجماعية الذكية</h3>
            <p className="text-xs text-white/40">
              {activeParticipants.join(' • ')} + أنت
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
          >
            ✕
          </button>
        )}
      </div>

      <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-white/40">المشاركون النشطون:</span>
        {Object.keys(AGENT_PERSONAS).map((key) => {
          const isActive = activeParticipants.some((p) => p.toLowerCase() === key.toLowerCase());
          return (
            <button
              key={key}
              onClick={() => toggleParticipant(key)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                isActive
                  ? 'bg-[#C5A059] text-black font-bold'
                  : 'bg-white/10 text-white/50 hover:bg-white/15'
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>

      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-white/40 hover:text-white">
            ✕
          </button>
        </div>
      )}

      <div className="p-3 border-t border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="اكتب رسالتك للوكلاء... (مثال: @OPS-LEAD افحص الموقع)"
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#C5A059]/50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="p-2.5 bg-[#C5A059] text-black font-bold rounded-xl hover:bg-[#E5C170] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 px-4 text-sm"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            إرسال
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender_type === 'user';
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="text-center my-2">
        <span className="text-xs bg-white/5 text-white/50 px-3 py-1 rounded-full border border-white/10 inline-block max-w-lg">
          {message.content}
        </span>
      </div>
    );
  }

  const persona = AGENT_PERSONAS[message.sender_name] || {
    color: 'purple',
    role: 'وكيل ذكي',
  };

  const bubbleColors: Record<string, string> = {
    purple: 'bg-purple-500/10 text-purple-100 border-purple-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-100 border-emerald-500/20',
    blue: 'bg-blue-500/10 text-blue-100 border-blue-500/20',
    cyan: 'bg-cyan-500/10 text-cyan-100 border-cyan-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-100 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-100 border-red-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-100 border-indigo-500/20',
  };

  const badgeColors: Record<string, string> = {
    purple: 'text-purple-400',
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    cyan: 'text-cyan-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    indigo: 'text-indigo-400',
  };

  const agentColor = persona.color || 'purple';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-[#C5A059] text-black font-bold'
            : 'bg-white/10 text-white'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`text-xs mb-1 font-semibold ${isUser ? 'text-[#C5A059]' : badgeColors[agentColor] || 'text-white/60'}`}>
          {message.sender_name}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 border ${
            isUser
              ? 'bg-[#C5A059]/20 text-white border-[#C5A059]/30 rounded-tr-md'
              : `${bubbleColors[agentColor] || 'bg-white/10 text-white'} rounded-tl-md`
          }`}
        >
          {message.isTyping ? (
            <div className="flex items-center gap-1.5 py-1">
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
        <div className="text-[10px] text-white/20 mt-1">
          {new Date(message.timestamp).toLocaleTimeString('ar-EG', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
