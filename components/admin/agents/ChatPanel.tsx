'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Send, Bot, User, Loader2, Sparkles, ThumbsUp, ThumbsDown, 
  Terminal, CheckCircle2, ChevronDown, ChevronUp, Database, Table, Layers
} from 'lucide-react';

export interface Message {
  id: string;
  sender_type: 'agent' | 'user' | 'system';
  sender_name: string;
  content: string;
  created_at: string;
  isTyping?: boolean;
  feedback?: 'positive' | 'negative' | null;
  action_taken?: boolean;
  context?: any;
  metadata?: {
    tool?: string;
    toolData?: any;
    toolSuccess?: boolean;
    actionItems?: string[];
  };
}

interface ChatPanelProps {
  agentKey: string;
  agentName?: string;
  agentColor?: string;
  initialMessage?: string;
}

const AGENT_METADATA: Record<string, { name: string; role: string; icon: string; color: string }> = {
  // ── سرب قيّم الدار (8 وكلاء) ───────────────────────────────────
  'qayyim-core': { name: 'قيّم الدار — القائد',     role: 'تنسيق السرب، تدقيق شامل، نشر/تراجع',   icon: '👑', color: 'amber' },
  'qayyim-cont': { name: 'قيّم الدار — المحتوى',    role: 'كتابة فاخرة، توحيد نبرة، قانون هوية',  icon: '✍️', color: 'rose' },
  'qayyim-vis':  { name: 'قيّم الدار — المرئيات',   role: 'انتقاء صور، هيرو، alt text، علامة',    icon: '🖼️', color: 'violet' },
  'qayyim-seo':  { name: 'قيّم الدار — الظهور',     role: 'تدقيق SEO، Schema، فجوات، منافسين',   icon: '🔍', color: 'sky' },
  'qayyim-ux':   { name: 'قيّم الدار — التجربة',    role: 'سلوك زائر، تحويل، A/B testing',       icon: '🎯', color: 'emerald' },
  'qayyim-ana':  { name: 'قيّم الدار — التحليلات',  role: 'إيرادات، تنبؤ تحويل، Luxury Score',   icon: '📈', color: 'cyan' },
  'qayyim-dev':  { name: 'قيّم الدار — التطوير',    role: 'أداء، bundle، code quality gate',      icon: '⚡', color: 'orange' },
  'qayyim-qa':   { name: 'قيّم الدار — الجودة',     role: 'E2E، visual regression، a11y',        icon: '🧪', color: 'lime' },
  // ── alias للتوافق مع القديم ─────────────────────────────────────
  prime:    { name: 'قيّم الدار', role: 'قيّم إطلالة أزينث على الموقع', icon: '🧠', color: 'purple' },
  // ── وكلاء العمليات ──────────────────────────────────────────────
  vanguard: { name: 'Vanguard', role: 'مدير العمليات والمبيعات', icon: '💼', color: 'emerald' },
  analyst:  { name: 'Analyst',  role: 'محلل البيانات والتقارير', icon: '📊', color: 'blue' },
  coder:    { name: 'Coder',    role: 'مطور الكود والتقنية',    icon: '💻', color: 'cyan' },
  ops:      { name: 'Ops',      role: 'مراقب العمليات والنظام',  icon: '⚙️', color: 'yellow' },
  security: { name: 'Security', role: 'حارس الأمن والتدقيق',   icon: '🛡️', color: 'red' },
  learner:  { name: 'Learner',  role: 'محرك التعلم الذاتي',     icon: '🎓', color: 'indigo' },
};

const AGENT_MISSIONS: Record<string, string[]> = {
  prime: [
    'افحص صحة محتوى الصفحة الرئيسية',
    'اعرض المنتجات',
    'حلّل SEO للموقع',
  ],
  vanguard: [
    'اعرض قائمة العملاء',
    'حلل فرص الإيرادات',
    'اعرض أوامر البيع',
  ],
  analyst: [
    'تحليل هوامش الأرباح الحالية',
    'المؤشرات اللحظية في 24 ساعة',
    'تحليل الإيرادات',
  ],
  coder: [
    'فحص صحة النظام التقني',
    'فحص مسارات الـ API',
    'تدقيق سرعة الاستجابة',
  ],
  ops: [
    'أخذ نسخة احتياطية فورية',
    'استعراض سجل النسخ الاحتياطية',
    'تدقيق سرعة الأداء',
  ],
  security: [
    'فحص مفاتيح الـ API',
    'تدقيق الأمان والامتثال',
    'فحص سجل الأوامر المحصن',
  ],
  learner: [
    'استعراض ذاكرة الوكلاء',
    'معايرة الأوزان المعرفية',
    'تقرير دقة القرارات',
  ],
};

export function ChatPanel({ agentKey, agentName, agentColor, initialMessage }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const sessionIdRef = useRef(`chat-${agentKey}-${Date.now()}`);
  const initialTriggerRef = useRef(false);

  // ── تسجيل التغذية الراجعة في SelfLearningEngine ──────────────────
  const handleFeedback = useCallback(async (msgId: string, rating: 'positive' | 'negative') => {
    setMessages(prev => prev.map(m =>
      m.id === msgId ? { ...m, feedback: rating } : m
    ));
    try {
      await fetch('/api/admin/agents/learn', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          interactionId: msgId,
          agentKey,
          rating: rating === 'positive' ? 5 : 1,
          feedback: rating,
        }),
      });
    } catch { /* صامت */ }
  }, [agentKey]);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [messages, scrollToBottom]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/agents/messages?agent_key=${agentKey}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMessages((prev) => {
          if (data.data.length === 0 && prev.length > 0) {
            return prev;
          }
          const formatted = data.data.map((m: any) => ({
            ...m,
            action_taken: m.action_taken || !!m.context?.tool,
            metadata: m.context ? {
              tool: m.context.tool,
              toolData: m.context.data,
              toolSuccess: m.context.success,
              actionItems: m.context.result ? [m.context.result] : [],
            } : undefined,
          }));

          if (isTyping) {
            const serverIds = new Set(data.data.map((m: any) => m.id));
            const localPending = prev.filter(m => !serverIds.has(m.id) && m.id.startsWith('temp-'));
            return [...formatted, ...localPending];
          }
          return formatted;
        });
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [agentKey, isTyping]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const sendMessage = async (messageText?: string) => {
    const textToSend = (messageText || input).trim();
    if (!textToSend || isTyping) return;

    if (!messageText) setInput('');
    setError(null);

    const tempUserMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_type: 'user',
      sender_name: 'أنت',
      content: textToSend,
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
          message: textToSend,
          session_id: sessionIdRef.current,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.data) {
        const meta = AGENT_METADATA[agentKey.toLowerCase()] || { name: agentKey.toUpperCase() };
        const agentMsg: Message = {
          id: `agent-${Date.now()}`,
          sender_type: 'agent',
          sender_name: data.data.agent ? data.data.agent.toUpperCase() : meta.name,
          content: data.data.message,
          created_at: data.data.timestamp || new Date().toISOString(),
          action_taken: !!data.data.metadata?.tool,
          metadata: data.data.metadata,
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
        content: `⚠️ لم أتمكن من الاتصال بالوكيل: ${err.message || 'خطأ غير معروف'}. يرجى المحاولة مرة أخرى.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }

    setIsTyping(false);
  };

  // ── تنفيذ المهمة المبدئية إن وجدت ─────────────────────────────────
  useEffect(() => {
    if (initialMessage && !initialTriggerRef.current) {
      initialTriggerRef.current = true;
      sendMessage(initialMessage);
    }
  }, [initialMessage]);

  const meta = AGENT_METADATA[agentKey.toLowerCase()] || {
    name: agentKey.toUpperCase(),
    role: 'وكيل ذكي متخصص',
    icon: '🤖',
    color: 'purple',
  };

  const activeColorKey = agentColor || meta.color || 'purple';

  const colorClasses: Record<string, { bg: string; border: string; text: string; bubble: string; accent: string }> = {
    purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  text: 'text-purple-400',  bubble: 'bg-purple-500/10 border-purple-500/20',  accent: 'bg-purple-600 hover:bg-purple-500' },
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', bubble: 'bg-emerald-500/10 border-emerald-500/20', accent: 'bg-emerald-600 hover:bg-emerald-500' },
    blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    text: 'text-blue-400',    bubble: 'bg-blue-500/10 border-blue-500/20',    accent: 'bg-blue-600 hover:bg-blue-500' },
    cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20',    text: 'text-cyan-400',    bubble: 'bg-cyan-500/10 border-cyan-500/20',    accent: 'bg-cyan-600 hover:bg-cyan-500' },
    yellow:  { bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   text: 'text-amber-400',   bubble: 'bg-amber-500/10 border-amber-500/20',   accent: 'bg-amber-600 hover:bg-amber-500' },
    red:     { bg: 'bg-red-500/10',     border: 'border-red-500/20',     text: 'text-red-400',     bubble: 'bg-red-500/10 border-red-500/20',     accent: 'bg-red-600 hover:bg-red-500' },
    indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  text: 'text-indigo-400',  bubble: 'bg-indigo-500/10 border-indigo-500/20',  accent: 'bg-indigo-600 hover:bg-indigo-500' },
  };

  const colors = colorClasses[activeColorKey] || colorClasses.purple;
  const missions = AGENT_MISSIONS[agentKey.toLowerCase()] || [];

  return (
    <div className={`bg-white/[0.02] border ${colors.border} rounded-[2rem] flex flex-col h-[520px] overflow-hidden shadow-2xl relative`}>
      {/* Header */}
      <div className={`p-4 border-b ${colors.border} flex items-center justify-between ${colors.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold shadow-lg text-lg`}>
            {meta.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                {agentName || meta.name}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                متصل
              </span>
            </div>
            <p className="text-[11px] text-white/40">
              {meta.role}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(agentKey.toLowerCase() === 'prime' || agentKey.toLowerCase().startsWith('qayyim-')) && (
            <a
              href="/admin/qayyim"
              title="فتح استوديو سرب قيّم الدار"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              الاستوديو
            </a>
          )}
          <Sparkles className={`w-4 h-4 ${colors.text}`} />
          <span className={`w-2 h-2 rounded-full ${isTyping ? `${colors.accent} animate-pulse` : 'bg-white/20'}`} />
        </div>
      </div>

      {/* Quick Action Chips Bar */}
      <div className="px-4 py-2 bg-white/[0.01] border-b border-white/5 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <span className="text-[10px] text-white/30 whitespace-nowrap flex items-center gap-1 font-bold">
          <Terminal className="w-3 h-3 text-white/40" /> مهام فورية:
        </span>
        {missions.map((mission, idx) => (
          <button
            key={idx}
            onClick={() => sendMessage(mission)}
            disabled={isTyping}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <span>⚡</span>
            <span>{mission}</span>
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className={`w-6 h-6 ${colors.text} animate-spin`} />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <Bot className={`w-12 h-12 ${colors.text} mx-auto opacity-30`} />
            <p className="text-white/40 text-sm font-bold">ابدأ محادثة تشغيلية مع {agentName || agentKey}</p>
            <p className="text-white/25 text-xs max-w-sm mx-auto">
              يمكنك طلب تنفيذ عمليات مباشرة على قاعدة البيانات، أو فحص المخزون، أو حساب الـ BOM، أو توليد العقود.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              {missions.map((mission, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(mission)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/70 hover:text-white font-medium transition-all"
                >
                  ⚡ {mission}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              agentColor={activeColorKey} 
              onFeedback={handleFeedback} 
            />
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
            <span className="text-xs text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              {error}
            </span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className={`p-3 border-t ${colors.border} bg-white/[0.01]`}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={`اكتب أمراً أو استفساراً لـ ${agentName || meta.name}...`}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors"
            disabled={isTyping}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isTyping || !input.trim()}
            className={`px-4 py-2.5 ${colors.accent} text-white rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md font-bold flex items-center justify-center cursor-pointer`}
          >
            {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4 h-4 rtl:rotate-180" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  agentColor = 'purple',
  onFeedback,
}: {
  message: Message;
  agentColor?: string;
  onFeedback?: (id: string, rating: 'positive' | 'negative') => void;
}) {
  const isUser   = message.sender_type === 'user';
  const isSystem = message.sender_type === 'system';

  if (isSystem) {
    return (
      <div className="text-center">
        <span className="text-xs text-white/40 bg-white/5 border border-white/5 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const colorClasses: Record<string, { bubble: string; name: string }> = {
    purple:  { bubble: 'bg-purple-500/10 border-purple-500/20 text-purple-100', name: 'text-purple-400' },
    emerald: { bubble: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-100', name: 'text-emerald-400' },
    blue:    { bubble: 'bg-blue-500/10 border-blue-500/20 text-blue-100', name: 'text-blue-400' },
    cyan:    { bubble: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-100', name: 'text-cyan-400' },
    yellow:  { bubble: 'bg-amber-500/10 border-amber-500/20 text-amber-100', name: 'text-amber-400' },
    red:     { bubble: 'bg-red-500/10 border-red-500/20 text-red-100', name: 'text-red-400' },
    indigo:  { bubble: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-100', name: 'text-indigo-400' },
  };

  const colors = colorClasses[agentColor] || colorClasses.purple;
  const toolData = message.metadata?.toolData || message.context?.data;
  const toolName = message.metadata?.tool || message.context?.tool;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2`}>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          isUser ? 'bg-blue-600 text-white shadow-md' : `${colors.bubble} border`
        }`}>
          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
        </div>

        <div className="space-y-1.5">
          <p className={`text-[10px] ${isUser ? 'text-blue-400 text-left' : colors.name}`}>
            {message.sender_name}
          </p>

          <div className={`p-3.5 rounded-2xl ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-md shadow-md'
              : `${colors.bubble} border rounded-tl-md shadow-md`
          }`}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

            {/* ── بطاقة النتائج التنفيذية المنظمة (Structured Tool Result) ── */}
            {toolName && (
              <StructuredToolCard toolName={toolName} toolData={toolData} />
            )}
          </div>

          {/* زري التقييم وتاريخ الرسالة */}
          {!isUser && onFeedback && (
            <div className="flex items-center gap-1.5 px-1">
              <button
                onClick={() => onFeedback(message.id, 'positive')}
                title="إجابة مفيدة"
                className={`p-1 rounded-lg transition-all cursor-pointer ${
                  message.feedback === 'positive'
                    ? 'text-emerald-400 bg-emerald-500/20'
                    : 'text-white/20 hover:text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                <ThumbsUp className="w-3 h-3" />
              </button>
              <button
                onClick={() => onFeedback(message.id, 'negative')}
                title="إجابة غير مفيدة"
                className={`p-1 rounded-lg transition-all cursor-pointer ${
                  message.feedback === 'negative'
                    ? 'text-rose-400 bg-rose-500/20'
                    : 'text-white/20 hover:text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                <ThumbsDown className="w-3 h-3" />
              </button>
              <span className="text-[9px] text-white/30 mr-1 font-mono">
                {new Date(message.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {isUser && (
            <p className="text-[9px] text-white/30 text-left px-1 font-mono">
              {new Date(message.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── مكون بطاقة النتائج المنظمة الغنية داخل الشات ───────────────────────
function StructuredToolCard({ toolName, toolData }: { toolName: string; toolData?: any }) {
  const [showJson, setShowJson] = useState(false);

  if (!toolData && !toolName) return null;

  const nestedItems = Array.isArray(toolData?.items) ? toolData.items : null;
  const isArray = Array.isArray(toolData) || (nestedItems && nestedItems.length > 0);
  const tableRows = Array.isArray(toolData) ? toolData : nestedItems;
  const isObject = toolData && typeof toolData === 'object' && !Array.isArray(toolData);

  return (
    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono font-bold">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          {toolData?.success === false ? 'فشل التنفيذ' : 'تم التنفيذ الفعلي'}: {toolName}
        </span>
        {toolData && (
          <button
            onClick={() => setShowJson(!showJson)}
            className="text-[10px] text-white/40 hover:text-white/70 flex items-center gap-1 cursor-pointer font-mono"
          >
            {showJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showJson ? 'إخفاء البيانات' : 'فحص السجل (DB)'}
          </button>
        )}
      </div>

      {/* عرض مصفوفة جداول */}
      {isArray && tableRows && tableRows.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-2 text-xs">
          <table className="w-full text-right text-[11px]">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                {Object.keys(tableRows[0]).slice(0, 4).map((k) => (
                  <th key={k} className="p-1 font-medium">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, 5).map((row: any, i: number) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                  {Object.keys(tableRows[0]).slice(0, 4).map((k) => (
                    <td key={k} className="p-1 text-white/80 truncate max-w-[120px]">
                      {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {tableRows.length > 5 && (
            <p className="text-[10px] text-white/30 text-center mt-1">
              +{tableRows.length - 5} سجلات إضافية في قاعدة البيانات
            </p>
          )}
        </div>
      )}

      {/* عرض كائن مؤشرات (مثل BOM أو هوامش أرباح) */}
      {isObject && (
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(toolData).slice(0, 6).map(([key, val]) => {
            if (typeof val === 'object' && val !== null) return null;
            return (
              <div key={key} className="p-2 rounded-xl bg-black/40 border border-white/5 flex flex-col">
                <span className="text-[10px] text-white/40 truncate">{key}</span>
                <span className="text-xs font-bold text-white font-mono">{String(val)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* عارض JSON الخام */}
      {showJson && toolData && (
        <pre className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-[10px] text-emerald-400/90 font-mono overflow-x-auto max-h-40">
          {JSON.stringify(toolData, null, 2)}
        </pre>
      )}
    </div>
  );
}
