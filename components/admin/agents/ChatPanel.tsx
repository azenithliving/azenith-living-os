'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  Send, Bot, User, Loader2, Sparkles, ThumbsUp, ThumbsDown, 
  Terminal, CheckCircle2, ChevronDown, ChevronUp, Database, Table, Layers
} from 'lucide-react';
import { AGENT_ROLES } from '@/lib/qayyim/agent-roles';

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
  fullScreen?: boolean;
}

const AGENT_METADATA: Record<string, { name: string; role: string; icon: string; color: string }> = {
  // ── سرب قيّم الدار (8 وكلاء) ───────────────────────────────────
  'qayyim-core': { name: 'مدير تشغيل المحتوى — قيّم الدار',     role: 'تنسيق السرب، تدقيق شامل، نشر/تراجع',   icon: '👑', color: 'amber' },
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

function InlineDraftPreview({ previewUrl, onApprove, onReject, onBetter }: { previewUrl: string; onApprove: () => void; onReject: () => void; onBetter: () => void }) {
  const [data, setData] = useState<any>(null);
  const [slider, setSlider] = useState(50);
  const token = previewUrl.split('token=')[1]?.split('&')[0] || previewUrl.split('/').pop()?.split('?')[0] || '';
  useEffect(() => {
    if (!token) return;
    // Fetch draft JSON via list_drafts and find by token — 100% real DB
    fetch('/api/admin/qayyim?action=list_drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      .then(r => r.json()).then(j => {
        const drafts = j.drafts || j.result?.drafts || [];
        const d = drafts.find((x: any) => x.preview_token === token || x.id === token);
        if (d) setData(d);
      }).catch(()=>{});
  }, [token]);
  const beforeImg = data?.previous?.image_url || data?.metadata?.before_image || (typeof data?.previous === 'string' ? data.previous : null);
  const afterImg = data?.proposed?.image_url || data?.proposed?.hero_image || data?.metadata?.after_image || (typeof data?.proposed === 'string' ? data.proposed : null);
  const beforeText = data?.previous?.description || data?.previous?.content || (typeof data?.previous === 'string' ? data.previous : JSON.stringify(data?.previous || '').slice(0,120));
  const afterText = data?.proposed?.description || data?.proposed?.content || (typeof data?.proposed === 'string' ? data.proposed : JSON.stringify(data?.proposed || '').slice(0,120));
  const isImage = !!(beforeImg && typeof beforeImg === 'string' && beforeImg.startsWith('http')) || !!(afterImg && typeof afterImg === 'string' && afterImg.startsWith('http')) || data?.draft_type === 'curate_gallery';
  return (
    <div className="mt-3 rounded-xl border border-white/10 overflow-hidden bg-black/20">
      <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
        <span className="text-[11px] font-bold text-white/70">معاينة قبل / بعد — حقيقية من DB</span>
        <a href={previewUrl} target="_blank" className="text-[10px] text-sky-300 hover:underline">فتح كامل ↗</a>
      </div>
      {isImage && beforeImg && afterImg ? (
        <div className="relative h-56 overflow-hidden bg-black">
          <img src={beforeImg as string} alt="قبل" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 overflow-hidden" style={{ width: `${slider}%` }}>
            <img src={afterImg as string} alt="بعد" className="w-full h-full object-cover" style={{ width: `${100 * 100 / slider}%`, maxWidth: 'none' }} />
          </div>
          <div className="absolute top-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white">قبل</div>
          <div className="absolute top-2 right-2 bg-emerald-600/80 px-2 py-0.5 rounded text-[10px] text-white">بعد</div>
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400" style={{ left: `${slider}%` }} />
          <input type="range" min={0} max={100} value={slider} onChange={e => setSlider(parseInt(e.target.value))} className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3/4 accent-amber-500" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-px bg-white/10">
          <div className="bg-rose-950/30 p-3">
            <div className="text-[10px] text-rose-300 font-bold mb-1">قبل</div>
            <div className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{String(beforeText).slice(0,300) || '—'}</div>
          </div>
          <div className="bg-emerald-950/30 p-3">
            <div className="text-[10px] text-emerald-300 font-bold mb-1">بعد</div>
            <div className="text-xs text-white whitespace-pre-wrap leading-relaxed">{String(afterText).slice(0,300) || '—'}</div>
          </div>
        </div>
      )}
      <div className="p-2 flex gap-1.5">
        <button onClick={onApprove} className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">✅ وافق — نشر حقيقي</button>
        <button onClick={onBetter} className="flex-1 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-bold">✏️ عايز أحسن</button>
        <button onClick={onReject} className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs">❌ ارفض</button>
      </div>
      {data && <div className="px-3 pb-2 text-[10px] text-white/30 text-center">مسودة {data.id?.slice(0,8)} · {data.target_path} · v{data.version} — {data.status}</div>}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: any[] = [];
  let tableRows: string[][] = [];
  // P5-M2: any site path or URL inside prose becomes a real clickable link
  const INLINE_LINK = /(https?:\/\/[^\s)>\]"'،]+|(?<![\w/])\/[A-Za-z0-9\-_./%]+[A-Za-z0-9\-_/])/g;
  const renderInline = (text: string) => {
    const parts = text.split(INLINE_LINK);
    return parts.map((part, i) =>
      part && /^(https?:\/\/|\/[A-Za-z])/.test(part) ? (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:underline" dir="ltr">{part}</a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };
  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1).filter(r => !r.every(c => /^[-:]+$/.test(c.trim())));
      elements.push(
        <div key={`tbl-${elements.length}`} className="my-2 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-white/5">{header.map((c,i) => <th key={i} className="p-1.5 text-right font-bold text-white/60 whitespace-nowrap">{c.trim()}</th>)}</tr></thead>
            <tbody>{body.map((row, ri) => <tr key={ri} className="border-t border-white/5">{row.map((c, ci) => <td key={ci} className="p-1.5 text-white/80 whitespace-nowrap">{c.trim().startsWith('/') || c.trim().startsWith('http') ? <a href={c.trim()} target="_blank" className="text-sky-300 hover:underline" dir="ltr">{c.trim()}</a> : c.trim()}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
  };
  lines.forEach((line) => {
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
    } else {
      flushTable();
      if (line.trim() === '') elements.push(<div key={`br-${elements.length}`} className="h-2" />);
      else if (line.trim().startsWith('#')) elements.push(<div key={`h-${elements.length}`} className="font-bold text-white mt-2">{renderInline(line.replace(/^#+\s*/, ''))}</div>);
      else if (line.trim().startsWith('- ') || line.trim().startsWith('•')) elements.push(<div key={`li-${elements.length}`} className="mr-3">• {renderInline(line.replace(/^[-•]\s*/, ''))}</div>);
      else elements.push(<div key={`p-${elements.length}`} className="whitespace-pre-wrap">{renderInline(line)}</div>);
    }
  });
  flushTable();
  return <div className="space-y-1">{elements}</div>;
}

export function ChatPanel({ agentKey, agentName, agentColor, initialMessage, fullScreen }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const sessionIdRef = useRef(`chat-${agentKey}-${Date.now()}`);
  const initialTriggerRef = useRef(false);
  const [showRoles, setShowRoles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null);
  const unreadLocatedRef = useRef(false);
  const scrolledToUnreadRef = useRef(false);
  const lastReadKey = `qayyim_last_read_${agentKey}`;
  const [isListening, setIsListening] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);
  const recognitionRef = useRef<any>(null);

  // P5-M4: speak agent replies when the speaker toggle is on (Web Speech, $0)
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')      // markdown links → label
        .replace(/https?:\/\/\S+/g, 'رابط')
        .replace(/[*#`>|]/g, '')
        .replace(/[-—]{2,}/g, '،')
        .replace(/\s+/g, ' ')
        .slice(0, 500);
      const utter = new SpeechSynthesisUtterance(clean);
      utter.lang = 'ar-EG';
      utter.rate = 0.95;
      const voices = window.speechSynthesis.getVoices();
      const voice =
        voices.find(v => v.lang === 'ar-EG') ||
        voices.find(v => v.lang?.startsWith('ar') && /google|microsoft|female/i.test(v.name)) ||
        voices.find(v => v.lang?.startsWith('ar'));
      if (voice) utter.voice = voice;
      window.speechSynthesis.speak(utter);
    } catch {}
  }, []);

  const toggleMic = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError('التعرف الصوتي غير مدعوم في هذا المتصفح'); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SR();
    rec.lang = 'ar-EG';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (ev: any) => {
      const text = Array.from(ev.results).map((r: any) => r[0].transcript).join('');
      setInput(text);
      if (ev.results[ev.results.length - 1].isFinal) {
        setIsListening(false);
        // P5-R3 voice-note style: once speech settles, send automatically
        const finalText = text.trim();
        if (finalText) setTimeout(() => (window as any).__qayyimSend?.(finalText), 150);
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  }, [isListening]);

  // expose for suggestion buttons
  useEffect(() => {
    (window as any).__qayyimSend = (text: string) => sendMessage(text);
    return () => { try { delete (window as any).__qayyimSend; } catch {} };
  }, []);

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
    if (isNearBottomRef.current) {
      try { localStorage.setItem(lastReadKey, String(Date.now())); } catch {}
    }
  }, [lastReadKey]);

  useEffect(() => {
    if (firstUnreadId && !scrolledToUnreadRef.current && messages.some((m) => m.id === firstUnreadId)) {
      scrolledToUnreadRef.current = true;
      firstUnreadRef.current?.scrollIntoView({ block: 'start' });
      return;
    }
    if (isNearBottomRef.current) {
      scrollToBottom(false);
    }
  }, [messages, firstUnreadId, scrollToBottom]);

  const fetchMessages = useCallback(async () => {
    try {
      // Opening the conversation IS the read event: without mark_read nothing was
      // ever flagged, so the seed card's badge only ever grew — past every real
      // message, every test run, and eventually past being believed.
      const res = await fetch(`/api/admin/agents/messages?agent_key=${agentKey}&mark_read=true`);
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

          // P5-M2 WhatsApp-style: locate the first agent message after the
          // last time this admin was reading this thread (once per mount).
          if (!unreadLocatedRef.current) {
            unreadLocatedRef.current = true;
            try {
              const lastRead = Number(localStorage.getItem(lastReadKey) || 0);
              if (!lastRead) {
                localStorage.setItem(lastReadKey, String(Date.now()));
              } else {
                const firstUnread = formatted.find(
                  (m: any) => m.sender_type === 'agent' && new Date(m.created_at).getTime() > lastRead
                );
                if (firstUnread) setFirstUnreadId(firstUnread.id);
              }
            } catch {}
          }

          // P5-R2: merge instead of replace — local optimistic bubbles
          // (temp user / agent reply / vision) survive the 5s poll until the
          // server copy of the SAME content arrives, never vanish mid-chat.
          const serverIds = new Set(formatted.map((m: any) => m.id));
          const covered = (local: Message, server: any[]) =>
            server.some(
              (s) =>
                s.sender_type === local.sender_type &&
                String(s.content).slice(0, 120) === String(local.content).slice(0, 120)
            );
          const merged = [
            ...formatted,
            ...prev.filter((m) => !serverIds.has(m.id) && !covered(m, formatted)),
          ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          return merged;
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

    let timeoutId: any;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 45000);
      const res = await fetch('/api/admin/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_key: agentKey,
          message: textToSend,
          session_id: sessionIdRef.current,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt ? `Server ${res.status}: ${txt.slice(0,200)}` : `Server error: ${res.status}`);
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
        if (ttsOn) speak(data.data.message || '');
      } else {
        throw new Error(data.error || 'Failed to get response');
      }
    } catch (err: any) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('Error sending message:', err);
      const isAbort = err.name === 'AbortError';
      const msg = isAbort ? 'انتهت المهلة (45 ثانية) — الخادم مشغول، حاول مرة أخرى' : (err.message || 'حدث خطأ في الاتصال');
      setError(msg);

      const errorMsg: Message = {
        id: `error-${Date.now()}`,
        sender_type: 'system',
        sender_name: 'النظام',
        content: isAbort ? `⏳ انتهت المهلة — الوكيل يعالج طلبك لكنه تأخر. حاول مرة أخرى أو بسّط طلبك.` : `⚠️ لم أتمكن من الاتصال بالوكيل: ${msg}. يرجى المحاولة مرة أخرى.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
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
  const missions = AGENT_ROLES[agentKey.toLowerCase()] || AGENT_MISSIONS[agentKey.toLowerCase()] || [];

  return (
    <div className={`bg-white/[0.02] border ${colors.border} ${fullScreen ? 'h-full rounded-none border-0' : 'rounded-[2rem] h-[520px]'} flex flex-col overflow-hidden shadow-2xl relative`}>
      {/* Header */}
      <div className={`p-4 border-b ${colors.border} flex items-center justify-between ${colors.bg}`}>
        <div className="flex items-center gap-3">
          {fullScreen && (
            <Link href="/admin/v2/agents" title="رجوع لمركز القيادة" className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white text-lg">→</Link>
          )}
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
          <button
            onClick={() => setShowRoles(!showRoles)}
            title="أدوار وقدرات الوكيل"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${showRoles ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'}`}
          >
            <Layers className="w-3.5 h-3.5" />
            أدوار
          </button>
          {(agentKey.toLowerCase() === 'prime' || agentKey.toLowerCase().startsWith('qayyim-')) && (
            <a
              href="/admin/v2/qayyim"
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

      {showRoles && (
        <div className="px-4 py-3 bg-black/20 border-b border-white/5 animate-in fade-in">
          <div className="text-[11px] font-bold text-white/60 mb-2 flex items-center justify-between">
            <span>قدرات {meta.name} — اضغط لتنفيذ</span>
            <button onClick={() => setShowRoles(false)} className="text-white/30 hover:text-white">✕</button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {missions.length > 0 ? (
              missions.map((m, i) => (
                <button key={i} onClick={() => { setShowRoles(false); sendMessage(m); }} className="text-right px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-white/70 hover:text-white">
                  • {m}
                </button>
              ))
            ) : (
              <span className="text-[11px] text-white/30">لا أدوار محددة</span>
            )}
          </div>
          <div className="text-[10px] text-white/30 mt-2">تلميح: اكتب بلهجتك العادية — "الجزء اللي فوق باهت" → أفهم "الهيرو"</div>
        </div>
      )}

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
            <div key={msg.id}>
              {msg.id === firstUnreadId && (
                <div ref={firstUnreadRef} className="flex items-center gap-2 py-2">
                  <div className="flex-1 h-px bg-amber-500/40" />
                  <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-0.5">رسائل جديدة ↑</span>
                  <div className="flex-1 h-px bg-amber-500/40" />
                </div>
              )}
              <MessageBubble
                message={msg}
                agentColor={activeColorKey}
                onFeedback={handleFeedback}
              />
            </div>
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
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async () => {
            const dataUrl = String(reader.result || '');
            setMessages(prev => [...prev, {
              id: `temp-img-${Date.now()}`, sender_type: 'user', sender_name: 'أنت',
              content: `📷 ${file.name}`, created_at: new Date().toISOString(),
            }]);
            setIsTyping(true);
            try {
              // P5-M4: real vision — full image to Gemini, then the agent acts on the analysis
              const res = await fetch('/api/admin/qayyim/vision', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUrl }),
              });
              const j = await res.json();
              setIsTyping(false);
              if (j.success && j.analysis) {
                setMessages(prev => [...prev, {
                  id: `vision-${Date.now()}`, sender_type: 'agent',
                  sender_name: agentName || 'القيّم',
                  content: `🔎 تحليل الصورة:\n${j.analysis}`,
                  created_at: new Date().toISOString(),
                }]);
                if (ttsOn) speak(j.analysis);
                sendMessage(`أرفقت صورة، وهذا تحليلي المبدئي لها:\n${String(j.analysis).slice(0, 900)}\n\nحدّد موقعها في الموقع واقترح تحسيناً في مسودة.`);
              } else {
                setMessages(prev => [...prev, {
                  id: `vision-err-${Date.now()}`, sender_type: 'system', sender_name: 'النظام',
                  content: `⚠️ ${j.error || 'تعذر تحليل الصورة'}`, created_at: new Date().toISOString(),
                }]);
              }
            } catch {
              setIsTyping(false);
              setMessages(prev => [...prev, {
                id: `vision-err-${Date.now()}`, sender_type: 'system', sender_name: 'النظام',
                content: '⚠️ فشل الاتصال بمحرك الرؤية', created_at: new Date().toISOString(),
              }]);
            }
          };
          reader.readAsDataURL(file);
          e.target.value = '';
        }} />
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault(); setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && file.type.startsWith('image/')) {
              const dt = new DataTransfer();
              dt.items.add(file);
              if (fileInputRef.current) fileInputRef.current.files = dt.files;
              fileInputRef.current?.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }}
          className={`flex gap-2 ${isDragging ? 'ring-2 ring-amber-500/50 rounded-xl p-1' : ''}`}
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTyping}
            title="إرسال صورة (تحليل رؤية حقيقي)"
            className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/60 hover:text-white disabled:opacity-30 flex items-center justify-center"
          >
            📷
          </button>
          <button
            onClick={toggleMic}
            disabled={isTyping}
            title={isListening ? 'إيقاف الاستماع' : 'تكلّم بالعامية (ar-EG)'}
            className={`px-3 py-2.5 border rounded-xl flex items-center justify-center disabled:opacity-30 ${isListening ? 'bg-rose-600/30 border-rose-500/50 text-rose-200 animate-pulse' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white'}`}
          >
            🎙️
          </button>
          <button
            onClick={() => setTtsOn(v => !v)}
            title={ttsOn ? 'إيقاف نطق الردود' : 'انطق الردود بالعربي'}
            className={`px-3 py-2.5 border rounded-xl flex items-center justify-center ${ttsOn ? 'bg-amber-500/25 border-amber-500/40 text-amber-200' : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white'}`}
          >
            {ttsOn ? '🔊' : '🔇'}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) sendMessage();
              if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
                // paste handled via onPaste on container
              }
            }}
            onPaste={(e) => {
              const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'));
              if (item) {
                const file = item.getAsFile();
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
                  e.preventDefault();
                }
              }
            }}
            placeholder={`اكتب بلهجتك العادية لـ ${agentName || meta.name}... (مثال: الجزء اللي فوق باهت)`}
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
        <div className="text-[10px] text-white/20 mt-1.5 text-center">تلميح: الصق سكرين شوت `Ctrl+V` أو اسحب صورة هنا — أفهمها وأحدد موقعها تلقائياً</div>
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
            <div className="text-sm leading-relaxed">
              <MarkdownContent content={message.content} />
            </div>

            {/* أزرار الاقتراحات التنفيذية */}
            {(message as any).suggestions?.length > 0 || (message.metadata as any)?.suggestions?.length > 0 || (message as any).nextActions?.length > 0 || (message.metadata as any)?.nextActions?.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {([...((message as any).suggestions || []), ...((message.metadata as any)?.suggestions || []), ...((message as any).nextActions || []), ...((message.metadata as any)?.nextActions || [])] as string[]).slice(0,3).map((s: string, i: number) => (
                  <button key={i} onClick={() => (window as any).__qayyimSend?.(s)} className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 hover:bg-amber-500/25 flex items-center gap-1">
                    ⚡ {s.slice(0,40)}
                  </button>
                ))}
              </div>
            ) : null}

            {/* معاينة مسودة قبل/بعد داخل الشات */}
            {((message as any).previewUrl || (message as any).preview_token || (message.metadata as any)?.previewUrl || (message.metadata as any)?.preview_token || (message.metadata as any)?.draft?.previewToken || (message.metadata as any)?.toolData?.preview_url || (message.metadata as any)?.toolData?.preview_token || (message as any).draftId) ? (
              <InlineDraftPreview
                previewUrl={(message as any).previewUrl || (message as any).preview_token || (message.metadata as any)?.previewUrl || (message.metadata as any)?.preview_token || (message.metadata as any)?.toolData?.preview_url || (message.metadata as any)?.toolData?.preview_token || `/api/admin/qayyim/preview/${(message.metadata as any)?.draft?.previewToken || (message.metadata as any)?.toolData?.draft_id || (message as any).draftId}`}
                onApprove={() => (window as any).__qayyimSend?.(`وافق على المسودة ${(message as any).draftId || (message.metadata as any)?.toolData?.draft_id || ''}`)}
                onReject={() => (window as any).__qayyimSend?.(`ارفض المسودة ${(message as any).draftId || (message.metadata as any)?.toolData?.draft_id || ''}`)}
                onBetter={() => (window as any).__qayyimSend?.(`عايز حاجة أحسن للمسودة ${(message as any).draftId || (message.metadata as any)?.toolData?.draft_id || ''} — اقترح بديلاً أفخم`)}
              />
            ) : null}

            {/* جدول الملاحظات إن وجد */}
            {(message as any).issues?.length > 0 || (message.metadata as any)?.issues?.length > 0 ? (
              <div className="mt-3 rounded-xl border border-white/10 overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead><tr className="bg-white/5 text-white/40"><th className="p-1.5 text-right">المشكلة</th><th className="p-1.5">الهدف</th><th className="p-1.5">الرابط</th></tr></thead>
                  <tbody>
                    {([...((message as any).issues || []), ...((message.metadata as any)?.issues || [])] as any[]).slice(0,5).map((iss: any, i: number) => (
                      <tr key={i} className="border-t border-white/5">
                        <td className="p-1.5 text-white/80">{iss.detail || iss.kind}</td>
                        <td className="p-1.5 text-white/60">{iss.target}</td>
                        <td className="p-1.5"><a href={iss.path} target="_blank" className="text-sky-300 hover:underline" dir="ltr">{iss.path}</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

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
