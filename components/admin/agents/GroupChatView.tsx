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
  PRIME: {
    name: 'PRIME',
    role: 'كبير مهندسي التصميم والتطوير',
    color: 'purple',
  },
  Vanguard: {
    name: 'Vanguard',
    role: 'مدير العمليات والمبيعات',
    color: 'emerald',
  },
};

export function GroupChatView({
  conversationId = 'group-chat',
  participants = ['PRIME', 'Vanguard', 'You'],
  onClose,
}: GroupChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender_type: 'system',
      sender_name: 'System',
      content: `👋 مرحباً! تم بدء محادثة جماعية بين: ${participants.filter((p) => p !== 'You').join(', ')} — يمكنك مخاطبة أي وكيل باستخدام @`,
      timestamp: new Date().toISOString(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeParticipants, setActiveParticipants] = useState<string[]>(
    participants.filter((p) => p !== 'You')
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
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
        const res = await fetch('/api/admin/agents/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_key: agentKey.toLowerCase(),
            content: userMessage,
            sender_type: 'user',
            mentions: [mention],
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();

        if (data.success && data.agentReply?.content) {
          return data.agentReply.content;
        }

        if (data.success && data.data?.content) {
          return data.data.content;
        }

        return generateFallbackResponse(agentKey, userMessage);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return null;
        }
        console.error(`[GroupChat] Agent ${agentKey} error:`, err);
        return generateFallbackResponse(agentKey, userMessage);
      }
    },
    []
  );

  const generateFallbackResponse = (agentKey: string, userMessage: string): string => {
    const persona = AGENT_PERSONAS[agentKey];
    if (!persona) return 'عذراً، لم أتمكن من فهم طلبك.';

    const lowerMsg = userMessage.toLowerCase();

    if (lowerMsg.includes('تصميم') || lowerMsg.includes('لون') || lowerMsg.includes('ديكور')) {
      return agentKey === 'PRIME'
        ? `🎨 بصفتي ${persona.role}، أقترح عليك استخدام ألوان دافئة مع لمسات ذهبية. هل تريد أن أُنشئ لك لوحة ألوان مخصصة؟`
        : `📋 سأُجهز مواصفات التصميم وأرسلها لفريق الإنتاج. ما هي المدة المطلوبة؟`;
    }

    if (lowerMsg.includes('سعر') || lowerMsg.includes('تكلفة') || lowerMsg.includes('ميزانية')) {
      return agentKey === 'PRIME'
        ? `💰 التكلفة تعتمد على المواد والتصميم. سأُجهز تقدير أولي خلال دقائق.`
        : `📊 سأُراجع العروض السابقة وأُجهز لك عرض سعر تنافسي.`;
    }

    if (lowerMsg.includes('مشكلة') || lowerMsg.includes('خطأ') || lowerMsg.includes('عطل')) {
      return `⚠️ سأفحص المشكلة فوراً. هل يمكنك وصف المشكلة بالتفصيل حتى أجد الحل المناسب؟`;
    }

    if (lowerMsg.includes('مساعدة') || lowerMsg.includes('help')) {
      return `👋 بالطبع! كيف يمكنني مساعدتك؟ يمكنني المساعدة في التصميم، الأسعار، متابعة الطلبات، أو أي استفسار آخر.`;
    }

    return `✅ تم استلام رسالتك! سأقوم بمراجعة طلبك والرد عليك فوراً. هل هناك أي تفاصيل إضافية؟`;
  };

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
        ? mentionedAgents.filter((a) => activeParticipants.includes(a))
        : activeParticipants;

    if (agentsToRespond.length === 0) {
      addMessage({
        sender_type: 'system',
        sender_name: 'System',
        content: '⚠️ لا يوجد وكلاء نشطون حالياً. يرجى تفعيل وكيل واحد على الأقل.',
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
    <div className="bg-[#111] rounded-2xl shadow-2xl flex flex-col h-[500px] border border-white/10">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-bold text-white">المحادثة الجماعية</h3>
            <p className="text-sm text-white/40">
              {activeParticipants.join(' + ')} + أنت
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
        >
          ✕
        </button>
      </div>

      <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2">
        <span className="text-xs text-white/40">المشاركين:</span>
        {participants.map((participant) => (
          <button
            key={participant}
            onClick={() => toggleParticipant(participant)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
              participant === 'You'
                ? 'bg-blue-500/20 text-blue-300'
                : activeParticipants.includes(participant)
                ? participant === 'PRIME'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-emerald-500/20 text-emerald-300'
                : 'bg-white/5 text-white/30 line-through'
            }`}
          >
            {participant === 'PRIME' && '🧠 '}
            {participant === 'Vanguard' && '💼 '}
            {participant}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-4 mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs text-center">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-white/30 text-xs px-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>الوكلاء يفكرون...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="اكتب رسالة... استخدم @PRIME أو @Vanguard"
              className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
              disabled={isLoading}
            />
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setInputMessage((prev) => prev + '@PRIME ')}
            className="text-xs px-2 py-1 bg-purple-500/10 text-purple-300 rounded hover:bg-purple-500/20 transition-colors"
          >
            @PRIME
          </button>
          <button
            onClick={() => setInputMessage((prev) => prev + '@Vanguard ')}
            className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-300 rounded hover:bg-emerald-500/20 transition-colors"
          >
            @Vanguard
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.sender_type === 'user';
  const isSystem = message.sender_type === 'system';
  const isPRIME = message.sender_name === 'PRIME';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-blue-500 text-white'
            : isPRIME
            ? 'bg-purple-500/20 text-purple-400'
            : 'bg-emerald-500/20 text-emerald-400'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`text-xs mb-1 ${isUser ? 'text-blue-400' : isPRIME ? 'text-purple-400' : 'text-emerald-400'}`}>
          {message.sender_name}
        </div>
        <div
          className={`rounded-2xl px-4 py-2.5 ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-md'
              : isPRIME
              ? 'bg-purple-500/10 text-purple-100 border border-purple-500/20 rounded-tl-md'
              : 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/20 rounded-tl-md'
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
