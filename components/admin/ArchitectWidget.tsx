"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, X, Send, Terminal } from "lucide-react";
import { toast } from "react-hot-toast";

interface Message {
  role: "user" | "architect" | "error";
  content: string;
  actions?: string[];
  timestamp: Date;
}

export function ArchitectWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [intent, setIntent] = useState("");
  const [isManifesting, setIsManifesting] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem("architect_sandbox_history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Restore dates
        const historyWithDates = parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
        setHistory(historyWithDates);
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
  }, []);

  // Save history on change
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem("architect_sandbox_history", JSON.stringify(history));
    }
  }, [history]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const executeGenesis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intent.trim() || isManifesting) return;

    const userIntent = intent;
    setIntent("");
    setIsManifesting(true);

    setHistory(prev => [...prev, { role: "user", content: userIntent, timestamp: new Date() }]);

    try {
      const response = await fetch("/api/admin/eternal/genesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: userIntent })
      });

      const data = await response.json();

      if (data.success) {
        setHistory(prev => [...prev, { 
          role: "architect", 
          content: data.manifestedReality, 
          actions: data.actionsTaken,
          timestamp: new Date() 
        }]);
      } else {
        setHistory(prev => [...prev, { role: "error", content: data.error || "فشل التكوين", timestamp: new Date() }]);
      }
    } catch (err) {
      setHistory(prev => [...prev, { role: "error", content: "خطأ في الاتصال بالنواة", timestamp: new Date() }]);
    } finally {
      setIsManifesting(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_0_20px_rgba(197,160,89,0.3)] bg-black border border-[#C5A059] transition-transform hover:scale-110"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-[#C5A059]" />
        ) : (
          <Brain className="h-6 w-6 text-[#C5A059]" />
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-6 z-50 flex flex-col rounded-2xl border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl overflow-hidden"
            style={{ width: "420px", height: "600px" }}
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/60">
               <div className="flex items-center gap-3">
                 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                 <span className="text-[12px] font-bold text-[#C5A059] tracking-widest uppercase">Direct Neural Interface</span>
               </div>
               <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white">
                 <X className="h-4 w-4" />
               </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
              {history.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
                   <Brain className="h-12 w-12 text-[#C5A059]" />
                   <div>
                     <p className="text-sm font-bold text-white">غرفة العمليات</p>
                     <p className="text-[10px] text-white/50 font-mono mt-2">Sovereign Architect is connected to this Sandbox.</p>
                   </div>
                </div>
              ) : (
                history.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`max-w-[90%] rounded-2xl p-3 text-sm leading-relaxed ${
                      msg.role === 'user' 
                      ? 'bg-[#C5A059] text-black font-bold' 
                      : msg.role === 'error'
                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                      : 'bg-white/5 border border-white/10 text-white'
                    }`}>
                      {msg.content}
                      
                      {msg.actions && (
                        <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 gap-2">
                           {msg.actions.map((act: string, ai: number) => (
                             <div key={ai} className="flex items-center gap-2 text-[10px] text-[#C5A059] font-mono">
                               <Terminal className="h-3 w-3" />
                               {act}
                             </div>
                           ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}

              {isManifesting && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-3 text-[#C5A059]"
                >
                  <div className="flex gap-1">
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="h-1.5 w-1.5 rounded-full bg-[#C5A059]" />
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-[#C5A059]" />
                    <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-[#C5A059]" />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em]">Manifesting Reality...</span>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={executeGenesis} className="p-3 border-t border-white/10 bg-black">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  placeholder="أدخل أمر التكوين (Genesis)..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#C5A059] transition-colors"
                  disabled={isManifesting}
                />
                <button
                  type="submit"
                  disabled={!intent.trim() || isManifesting}
                  className="absolute left-2 p-2 rounded-lg bg-[#C5A059] text-black disabled:opacity-50 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
