"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Brain, Zap, Shield, Layers, RefreshCw, Send, 
  Terminal, Activity, Command, 
  Box, Key, Code, TrendingUp
} from "lucide-react";
import { SovereignPulse } from "@/components/admin/SovereignPulse";
import { NeuralStream } from "@/components/admin/NeuralStream";
import { toast } from "react-hot-toast";
import { ProactiveDashboard } from "./components/ProactiveDashboard";
import { EvolutionManager } from "@/components/admin/EvolutionManager";

// ═══════════════════════════════════════════════════════════════════════════════
// SOVEREIGN COMMAND CONSOLE (V3 - ETERNAL)
// ═══════════════════════════════════════════════════════════════════════════════

export default function IntelCenterPage() {
  const [intent, setIntent] = useState("");
  const [isManifesting, setIsManifesting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [activeArsenal, setActiveArsenal] = useState<"none" | "sales" | "intel" | "security">("none");
  const [systemState, setSystemState] = useState<"idle" | "thinking" | "manifesting" | "evolving">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom on history change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const executeGenesis = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!intent.trim() || isManifesting) return;

    const userIntent = intent;
    setIntent("");
    setIsManifesting(true);
    setSystemState("manifesting");

    // Add user intent to history
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
          gain: data.evolutionGain,
          timestamp: new Date() 
        }]);
        toast.success("تم التكوين بنجاح");
      } else {
        setHistory(prev => [...prev, { role: "error", content: data.error || "فشل التكوين", timestamp: new Date() }]);
        toast.error("حدث خطأ في عملية التكوين");
      }
    } catch {
      setHistory(prev => [...prev, { role: "error", content: "خطأ في الاتصال بالنواة", timestamp: new Date() }]);
    } finally {
      setIsManifesting(false);
      setSystemState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-[#C5A059] selection:text-black overflow-hidden font-sans">
      {/* BACKGROUND MESH */}
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#C5A05920,transparent_70%)]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#ffffff10 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative z-10 flex flex-col h-screen max-w-7xl mx-auto px-6 py-8">
        
        {/* HEADER: SOVEREIGN STATUS */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-[#C5A059] blur-xl opacity-30 animate-pulse" />
              <div className="relative p-3 bg-black rounded-2xl border border-[#C5A059]/50">
                <Layers className="h-6 w-6 text-[#C5A059]" />
              </div>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter flex items-center gap-2">
                AZENITH PRIME
                <span className="text-[10px] bg-[#C5A059] text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Eternal Engine</span>
              </h1>
              <p className="text-[10px] text-[#C5A059]/60 font-mono uppercase tracking-[0.2em]">Sovereign Control Layer v3.0</p>
            </div>
          </div>

            <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">System Load</span>
                <div className="flex items-center gap-2">
                  <div className="h-1 w-24 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-emerald-500" 
                      animate={{ width: systemState === "idle" ? "12%" : "85%" }} 
                    />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500">12%</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Evolution Rank</span>
                <span className="text-[10px] font-mono text-[#C5A059]">OMEGA-7</span>
              </div>
            </div>
            <a 
              href="/admin/sandbox" 
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-[#C5A059]/20 border border-white/10 hover:border-[#C5A059] transition-all"
              title="مختبر التجارب (Sandbox)"
            >
              <Code className="h-4 w-4 text-[#C5A059]" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#C5A059] hidden sm:block">Sandbox</span>
            </a>

            <div className="h-10 w-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-md">
              <Activity className="h-4 w-4 text-[#C5A059] animate-pulse" />
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 min-h-0">
          
          {/* LEFT: TELEMETRY & FEED */}
          <div className="lg:col-span-3 space-y-6 hidden lg:flex flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-6 pr-2">
              <SovereignPulse />
              <div className="p-4 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md">
                 <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                   <Terminal className="h-3 w-3" />
                   الوعي اللحظي
                 </h3>
                 <NeuralStream />
              </div>
            </div>
          </div>

          {/* CENTER: THE GENESIS FEED */}
          <div className="lg:col-span-6 flex flex-col min-h-0">
             <div className="flex-1 rounded-3xl border border-white/10 bg-white/[0.01] backdrop-blur-2xl overflow-hidden flex flex-col relative group">
                {/* INTERFACE GLOW */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#C5A05905,transparent_50%)] pointer-events-none" />
                
                {/* FEED HEADER */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                   <div className="flex items-center gap-3">
                     <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[10px] font-bold text-white/50 tracking-widest uppercase">Direct Neural Interface</span>
                   </div>
                   <div className="flex gap-2">
                     <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                     <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                     <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
                   </div>
                </div>

                {/* MESSAGES */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth scrollbar-hide">
                  {history.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 space-y-4">
                       <Brain className="h-12 w-12 text-[#C5A059]" />
                       <div>
                         <p className="text-sm font-bold">بانتظار إرادة المهندس</p>
                         <p className="text-[10px] font-mono tracking-widest">Genesis Ready • Eternal Substrate Active</p>
                       </div>
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {history.map((msg, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed ${
                          msg.role === 'user' 
                          ? 'bg-[#C5A059] text-black font-bold shadow-[0_0_20px_rgba(197,160,89,0.3)]' 
                          : msg.role === 'error'
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                          : 'bg-white/5 border border-white/10 text-white shadow-2xl'
                        }`}>
                          {msg.content}
                          
                          {msg.actions && (
                            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
                               {msg.actions.map((act: string, ai: number) => (
                                 <div key={ai} className="flex items-center gap-2 text-[9px] text-[#C5A059] font-mono">
                                   <div className="h-1 w-1 rounded-full bg-[#C5A059]" />
                                   {act}
                                 </div>
                               ))}
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] text-white/20 mt-2 font-mono">
                          {msg.timestamp.toLocaleTimeString()} • {msg.role === 'user' ? 'ALPHA' : 'ARCHITECT'}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {isManifesting && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-3 text-[#C5A059]"
                    >
                      <div className="flex gap-1">
                        <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="h-1 w-1 rounded-full bg-[#C5A059]" />
                        <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1 w-1 rounded-full bg-[#C5A059]" />
                        <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1 w-1 rounded-full bg-[#C5A059]" />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-[0.3em]">Manifesting Reality...</span>
                    </motion.div>
                  )}
                </div>
             </div>
          </div>

          {/* RIGHT: SYSTEM STATS & LOCKS */}
          <div className="lg:col-span-3 space-y-6 hidden lg:flex flex-col min-h-0">
             <div className="p-6 rounded-3xl border border-[#C5A059]/20 bg-[#C5A059]/5 backdrop-blur-md relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <Shield className="h-12 w-12 text-[#C5A059]" />
                </div>
                <h3 className="text-[10px] font-black text-[#C5A059] uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Key className="h-3 w-3" />
                  بروتوكولات السيادة
                </h3>
                <div className="space-y-4">
                   {[
                     { label: "Alpha Gate", status: "Active", color: "text-emerald-500" },
                     { label: "Genesis Sync", status: "Synchronized", color: "text-blue-400" },
                     { label: "Loyalty Seal", status: "Immutable", color: "text-[#C5A059]" },
                     { label: "Cognitive Load", status: "1.2ms", color: "text-white/50" }
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[10px] text-white/40 font-medium">{item.label}</span>
                        <span className={`text-[10px] font-black ${item.color}`}>{item.status}</span>
                     </div>
                   ))}
                </div>
             </div>

             <div className="flex-1 rounded-3xl border border-white/10 bg-white/[0.01] p-6 flex flex-col min-h-0">
                <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Box className="h-3 w-3" />
                  ترسانة العمليات (Arsenal)
                </h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                   {[
                     { id: "sales", icon: TrendingUp, label: "المبيعات", color: "text-emerald-500" },
                     { id: "intel", icon: Brain, label: "الاستخبارات", color: "text-blue-400" },
                     { id: "security", icon: Shield, label: "الأمن", color: "text-[#C5A059]" }
                   ].map((item) => (
                     <button 
                       key={item.id}
                       onClick={() => setActiveArsenal(item.id as any)}
                       className={`p-3 rounded-2xl border transition-all flex flex-col items-center gap-2 ${
                         activeArsenal === item.id 
                         ? 'bg-white/10 border-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.2)]' 
                         : 'bg-white/[0.03] border-white/5 hover:border-white/20'
                       }`}
                     >
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                        <span className="text-[10px] font-bold text-white/70">{item.label}</span>
                     </button>
                   ))}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                   {activeArsenal === "none" && (
                     <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                        <Zap className="h-8 w-8 mb-2" />
                        <p className="text-[9px] font-bold">اختر وحدة للتحكم اليدوي</p>
                     </div>
                   )}

                   {activeArsenal === "sales" && (
                     <div className="space-y-4">
                        <ProactiveDashboard />
                     </div>
                   )}

                   {activeArsenal === "intel" && (
                     <div className="space-y-4">
                        <EvolutionManager />
                     </div>
                   )}

                   {activeArsenal === "security" && (
                     <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
                           <p className="text-[10px] text-red-400 font-bold mb-2 uppercase">Emergency Protocols</p>
                           <button className="w-full py-2 bg-red-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-red-600 transition-colors">
                              Full System Lockdown
                           </button>
                        </div>
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5">
                           <p className="text-[10px] text-white/40 font-bold mb-2 uppercase">Active Session</p>
                           <p className="text-[9px] font-mono text-emerald-500">AZENITH_PRIME_ADMIN_X1</p>
                        </div>
                     </div>
                   )}
                </div>
             </div>
          </div>
        </main>

        {/* FOOTER: THE COMMAND INPUT */}
        <footer className="relative z-20 pb-8">
           <form onSubmit={executeGenesis} className="relative group max-w-4xl mx-auto">
              {/* INPUT GLOW EFFECT */}
              <div className="absolute -inset-1 bg-gradient-to-r from-[#C5A059] via-white to-[#C5A059] rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition-opacity" />
              
              <div className="relative flex items-center bg-black rounded-2xl border border-white/20 p-2 pl-6 shadow-2xl focus-within:border-[#C5A059]/50 transition-all">
                 <Command className="h-5 w-5 text-[#C5A059] mr-4" />
                 <input 
                   value={intent}
                   onChange={(e) => setIntent(e.target.value)}
                   disabled={isManifesting}
                   placeholder="أدخل إرادتك السيادية هنا... (مثال: قم بإنشاء قسم مبيعات جديد لغرف النوم)"
                   className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-white/20 font-medium py-3"
                   dir="rtl"
                 />
                 <button 
                   type="submit"
                   disabled={isManifesting || !intent.trim()}
                   className="h-10 w-10 rounded-xl bg-[#C5A059] flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                 >
                    {isManifesting ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                 </button>
              </div>

              {/* INPUT DECORATION */}
              <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-12 text-[8px] font-mono text-white/10 uppercase tracking-[0.4em] pointer-events-none">
                 <span>Be</span>
                 <span>And it is</span>
                 <span>Infinite Consciousness</span>
              </div>
           </form>
        </footer>
      </div>
    </div>
  );
}
