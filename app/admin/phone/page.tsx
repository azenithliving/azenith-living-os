"use client";

import { useState, useEffect } from "react";
import { Smartphone, Wifi, Battery, Signal, Home, Grid, ChevronLeft, RefreshCw, Link, ShieldCheck } from "lucide-react";

export default function PhonePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("");
  const [cloudUrl, setCloudUrl] = useState("");
  const [tempUrl, setTempUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    setMounted(true);
    // استرجاع الرابط المحفوظ
    const savedUrl = localStorage.getItem("sovereign_mobile_url");
    if (savedUrl) {
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
    if (tempUrl.includes("cloudshell.dev") || tempUrl.includes("localhost")) {
      localStorage.setItem("sovereign_mobile_url", tempUrl);
      setCloudUrl(tempUrl);
      setIsConnected(true);
    } else {
      alert("Please enter a valid Cloud Shell Preview URL");
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("sovereign_mobile_url");
    setCloudUrl("");
    setIsConnected(false);
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 bg-[#050505] flex items-center justify-center overflow-hidden font-sans">
      
      {/* Sovereign Mobile OS - Cloud Bridge Edition */}
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
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#111] to-black">
              <div className="w-20 h-20 bg-blue-500/20 rounded-3xl flex items-center justify-center border border-blue-500/30 mb-6 animate-pulse">
                <Link className="w-10 h-10 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Cloud Bridge Required</h2>
              <p className="text-sm text-white/40 mb-8 max-w-xs leading-relaxed">
                Paste the Cloud Shell Preview URL (Port 6080) to establish a sovereign connection.
              </p>
              
              <div className="w-full max-w-sm flex flex-col gap-3">
                <input 
                  type="text" 
                  placeholder="https://6080-cs-..." 
                  value={tempUrl}
                  onChange={(e) => setTempUrl(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <button 
                  onClick={handleConnect}
                  className="w-full bg-white text-black font-bold py-4 rounded-2xl hover:bg-white/90 active:scale-95 transition-all"
                >
                  Connect Sovereign Droid
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
              <button 
                onClick={handleDisconnect}
                className="absolute top-4 left-4 p-3 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-white/40 hover:text-red-400 transition-all"
                title="Disconnect"
              >
                <Power size={16} />
              </button>
            </>
          )}
        </div>

        {/* Navigation Dock */}
        <div className="h-24 bg-black flex items-center justify-around px-12 pb-6">
          <ChevronLeft className="w-7 h-7 text-white/20" />
          <div className="w-16 h-16 bg-white/10 rounded-full border border-white/20 flex items-center justify-center">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl">
               <Home className="w-5 h-5 text-black" />
            </div>
          </div>
          <Grid className="w-7 h-7 text-white/20" />
        </div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-white/10 rounded-full" />
      </div>
    </div>
  );
}

import { Power } from "lucide-react";
