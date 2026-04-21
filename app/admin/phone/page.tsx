"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Grid, ChevronLeft, RefreshCw, Link, ShieldCheck, ExternalLink, Info } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");
  const [tempUrl, setTempUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedUrl = localStorage.getItem("sovereign_mobile_url");
    if (savedUrl && !savedUrl.includes("localhost")) {
      setCloudUrl(savedUrl);
      setIsConnected(true);
    }

    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = () => {
    if (tempUrl.includes("cloudshell.dev")) {
      localStorage.setItem("sovereign_mobile_url", tempUrl);
      setCloudUrl(tempUrl);
      setIsConnected(true);
      // فتح الرابط في نافذة جديدة للتفعيل
      window.open(tempUrl, "_blank");
    } else {
      alert("Please enter a valid Cloud Shell Preview URL (Port 6080)");
    }
  };

  const handleReset = () => {
    localStorage.removeItem("sovereign_mobile_url");
    setCloudUrl("");
    setIsConnected(false);
    setTempUrl("");
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-[#050505] flex items-center justify-center overflow-hidden font-sans">
      
      <div className="relative w-full h-full bg-black flex flex-col overflow-hidden">
        
        {/* Status Bar */}
        <div className="h-10 bg-black flex items-center justify-between px-8 z-[100] border-b border-white/5">
          <div className="text-[13px] font-bold text-white tracking-tight">{time}</div>
          <div className="flex items-center gap-3">
            <Signal className="w-4 h-4 text-white/80" />
            <Wifi className="w-4 h-4 text-white/80" />
            <Battery className="w-5 h-5 text-white/80" />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 relative bg-[#0a0a0a]">
          {!isConnected ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#0f0f0f] to-black">
              <div className="w-20 h-20 bg-blue-600/10 rounded-[2.5rem] flex items-center justify-center border border-blue-500/20 mb-8 shadow-[0_0_50px_rgba(59,130,246,0.1)]">
                <Link className="w-10 h-10 text-blue-500" />
              </div>
              
              <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Cloud Bridge OS</h2>
              <p className="text-[13px] text-white/40 mb-10 max-w-[280px] leading-relaxed">
                Connect your sovereign android instance by pasting the preview URL below.
              </p>
              
              <div className="w-full max-w-sm space-y-4">
                <input 
                  type="text" 
                  placeholder="https://6080-cs-..." 
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <button 
                  onClick={handleConnect}
                  className="w-full bg-blue-600 text-white font-bold py-5 rounded-2xl hover:bg-blue-500 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <ExternalLink size={18} />
                  Authorize & Connect
                </button>
              </div>
            </div>
          ) : (
            <>
              <iframe 
                src={cloudUrl}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; clipboard-read; clipboard-write"
                title="Sovereign Android System"
              />
              <div className="absolute top-6 left-6 flex gap-3">
                <button 
                  onClick={handleReset}
                  className="p-3 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full text-white/40 hover:text-red-400 transition-all shadow-2xl"
                >
                  <RefreshCw size={16} />
                </button>
                <div className="px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full flex items-center gap-2 backdrop-blur-md">
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                   <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Linked</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Navigation Dock */}
        <div className="h-24 bg-black flex items-center justify-around px-12 pb-6">
          <ChevronLeft className="w-7 h-7 text-white/20" />
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] active:scale-90 transition-all cursor-pointer">
             <Home className="w-6 h-6 text-black" />
          </div>
          <Grid className="w-7 h-7 text-white/20" />
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/10 rounded-full" />
      </div>
    </div>
  );
}
