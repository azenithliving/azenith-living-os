"use client";

import React, { Component, ErrorInfo } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, RefreshCw, TerminalSquare } from "lucide-react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isHealing: boolean;
}

export class SingularityContainment extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    isHealing: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isHealing: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Singularity Containment Breach:", error, errorInfo);
    // Here we would automatically dispatch the error to the Architect's API for self-healing
    this.initiateSelfHealing(error.message);
  }

  private async initiateSelfHealing(errorMessage: string) {
    this.setState({ isHealing: true });
    
    // Automatically send the error to the Genesis API to rewrite the code
    try {
      const response = await fetch("/api/admin/eternal/genesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          intent: `SYSTEM AUTO-EVAL: The previous code crashed with error: "${errorMessage}". You MUST fix this error immediately. Ensure all imports are correct, no hallucinated libraries are used, and the logic is flawless. Rewrite the component.` 
        })
      });
      
      const data = await response.json();
      if (data.success) {
        // Automatically reload the window once the AI has fixed and saved the new code
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        this.setState({ isHealing: false });
      }
    } catch (e) {
      console.error("Self-healing failed", e);
      this.setState({ isHealing: false });
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 bg-red-950/40 border border-red-500/50 rounded-2xl flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto backdrop-blur-sm"
        >
          <div className="relative">
            <ShieldAlert className="h-16 w-16 text-red-500" />
            <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="absolute inset-0 border-2 border-red-500/30 rounded-full border-t-red-500"
            />
          </div>
          
          <div>
            <h2 className="text-xl font-black text-red-400 tracking-widest uppercase mb-2">
              Containment Breach (تم احتواء الخطأ)
            </h2>
            <p className="text-sm text-red-300/70 font-mono">
              The Sovereign Architect generated unstable reality. The singularity shield prevented a global crash.
            </p>
          </div>

          <div className="w-full bg-black/60 rounded-xl p-4 border border-red-500/20 text-left overflow-hidden">
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-red-500/20">
              <TerminalSquare className="h-4 w-4 text-red-400" />
              <span className="text-[10px] text-red-400 font-mono uppercase">Error Trace</span>
            </div>
            <p className="text-xs font-mono text-red-300 break-words">
              {this.state.error?.message}
            </p>
          </div>

          {this.state.isHealing ? (
            <div className="flex items-center gap-3 text-emerald-400 bg-emerald-500/10 px-6 py-3 rounded-full border border-emerald-500/20">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest">Self-Healing Protocol Active...</span>
            </div>
          ) : (
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full text-xs font-bold uppercase tracking-widest transition-all border border-red-500/30"
            >
              Manual Override (Reload)
            </button>
          )}
        </motion.div>
      );
    }

    return this.props.children;
  }
}
