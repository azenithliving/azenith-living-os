"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import useSessionStore, { type BehavioralReport, type UserPersona, type StylePreference } from "@/stores/useSessionStore";
import { analyzeUserPersona, type AIAnalysisResult, type SessionProfile } from "@/lib/analyzeUserPersona";
import type { AnalyzeLeadResponse } from "@/app/api/admin/analyze-lead/route";

interface UserSession {
  id: string;
  userPersona: UserPersona;
  behavioralReport: BehavioralReport | null;
  leadScore: number;
  roomIntent: string[];
  stylePreferences: Record<string, StylePreference>;
  lastPage: string;
  phone?: string;
  aiAnalysis?: AIAnalysisResult | null;
  neuralInsight?: NeuralInsight | null;
}

interface NeuralInsight {
  salesTip: string;
  confidence: "high" | "medium" | "low";
  analyzedAt: string;
}

export default function BehavioralDashboard() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<UserSession | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Neural Insight state
  const [neuralInsight, setNeuralInsight] = useState<NeuralInsight | null>(null);
  const [isLoadingNeural, setIsLoadingNeural] = useState(false);
  
  // Buffered interactions tracking - prevents redundant API calls
  const lastAnalysisTimeRef = useRef<number>(0);
  const bufferedInteractionsRef = useRef<number>(0);
  const hasAnalysisBeenRequestedRef = useRef<boolean>(false);

  // Get current session from store
  const store = useSessionStore();

  // Neural Sales Insight - uses buffered_interactions to avoid redundant calls
  const fetchNeuralInsight = useCallback(async (force = false) => {
    if (!selectedSession) return;
    
    const now = Date.now();
    const timeSinceLastAnalysis = now - lastAnalysisTimeRef.current;
    const minInterval = 30000; // 30 seconds minimum between API calls
    
    // Skip if analysis was recently requested (buffered_interactions pattern)
    if (!force && hasAnalysisBeenRequestedRef.current && timeSinceLastAnalysis < minInterval) {
      console.log("[Neural Insight] Skipped - analysis already requested recently");
      return;
    }
    
    // Skip if lead score is too low and no buffered interactions
    const currentBuffered = store.leadScore - (selectedSession.leadScore || 0);
    bufferedInteractionsRef.current = Math.max(0, currentBuffered);
    
    if (!force && selectedSession.leadScore < 10 && bufferedInteractionsRef.current < 5) {
      console.log("[Neural Insight] Skipped - insufficient data");
      return;
    }
    
    setIsLoadingNeural(true);
    hasAnalysisBeenRequestedRef.current = true;
    
    try {
      const response = await fetch("/api/admin/analyze-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionState: {
            leadScore: store.leadScore,
            intent: store.intent,
            roomIntent: store.roomIntent,
            styleSwitches: store.styleSwitches,
            userPersona: store.userPersona,
            behavioralReport: store.behavioralReport,
            userProfile: store.userProfile,
          },
          bufferedInteractions: bufferedInteractionsRef.current,
        }),
      });
      
      if (!response.ok) throw new Error("API request failed");
      
      const insight: AnalyzeLeadResponse = await response.json();
      setNeuralInsight(insight);
      lastAnalysisTimeRef.current = Date.now();
      
      // Update session with neural insight
      const updatedSession = { ...selectedSession, neuralInsight: insight };
      setSelectedSession(updatedSession);
      
    } catch (error) {
      console.error("[Neural Insight] Failed:", error);
    } finally {
      setIsLoadingNeural(false);
    }
  }, [selectedSession, store]);

  // Auto-trigger neural insight when sufficient data is buffered
  useEffect(() => {
    if (!selectedSession) return;
    
    // Calculate current buffered interactions
    const currentBuffered = store.leadScore - (selectedSession.leadScore || 0);
    bufferedInteractionsRef.current = Math.max(0, currentBuffered);
    
    const now = Date.now();
    const timeSinceLastAnalysis = now - lastAnalysisTimeRef.current;
    const minInterval = 30000; // 30 seconds
    
    // Auto-trigger if we have enough data and haven't analyzed recently
    const hasEnoughData = store.leadScore > 25 || bufferedInteractionsRef.current >= 10;
    const canAnalyze = !hasAnalysisBeenRequestedRef.current || timeSinceLastAnalysis > minInterval;
    
    if (hasEnoughData && canAnalyze && !isLoadingNeural && !neuralInsight) {
      fetchNeuralInsight(false);
    }
  }, [store.leadScore, selectedSession, fetchNeuralInsight, isLoadingNeural, neuralInsight]);

  useEffect(() => {
    // Load sessions from localStorage (in production, this would come from an API)
    const stored = localStorage.getItem("azenith-session");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const session: UserSession = {
          id: parsed.state?.sessionId || "unknown",
          userPersona: parsed.state?.userPersona || { certainty: "Low", interestLevel: "Low" },
          behavioralReport: parsed.state?.behavioralReport || null,
          leadScore: parsed.state?.leadScore || 0,
          roomIntent: parsed.state?.roomIntent || [],
          stylePreferences: (parsed.state?.userProfile?.stylePreferences as Record<string, StylePreference>) || {},
          lastPage: parsed.state?.lastPage || "/",
          phone: parsed.state?.userProfile?.phone || undefined,
        };
        setSessions([session]);
        setSelectedSession(session);
      } catch (e) {
        console.error("Failed to parse session:", e);
      }
    }
  }, []);

  // Trigger AI Analysis (Legacy - full analysis)
  const triggerAIAnalysis = useCallback(async (triggerEvent: "whatsapp_contact" | "form_submit") => {
    if (!selectedSession) return;
    
    setIsAnalyzing(true);
    setAiError(null);
    
    try {
      const sessionProfile: SessionProfile = {
        userProfile: {
          stylePreferences: selectedSession.stylePreferences,
        },
        userPersona: selectedSession.userPersona,
        behavioralReport: selectedSession.behavioralReport,
        leadScore: selectedSession.leadScore,
        roomIntent: selectedSession.roomIntent,
        intent: store.intent,
        styleSwitches: store.styleSwitches,
      };
      
      const analysis = await analyzeUserPersona(sessionProfile, selectedSession.phone);
      
      if (analysis) {
        const updatedSession = { ...selectedSession, aiAnalysis: analysis };
        setSelectedSession(updatedSession);
        setSessions(prev => prev.map(s => 
          s.id === updatedSession.id ? updatedSession : s
        ));
        
        localStorage.setItem(`ai-analysis-${selectedSession.id}`, JSON.stringify({
          analysis,
          trigger: triggerEvent,
          timestamp: new Date().toISOString(),
        }));
      } else {
        setAiError("AI analysis failed. Check if GEMINI_API_KEY is configured.");
      }
    } catch (error) {
      console.error("AI Analysis error:", error);
      setAiError("Failed to analyze user persona. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedSession, store.intent, store.styleSwitches]);

  const getCertaintyColor = (certainty: string) => {
    switch (certainty) {
      case "High":
        return "text-green-500 bg-green-500/10";
      case "Medium":
        return "text-yellow-500 bg-yellow-500/10";
      default:
        return "text-gray-500 bg-gray-500/10";
    }
  };

  const getInterestColor = (interest: string) => {
    switch (interest) {
      case "Strong":
        return "text-emerald-500";
      case "Moderate":
        return "text-amber-500";
      default:
        return "text-gray-400";
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-[#C5A059]">Behavioral Intelligence Dashboard</h1>
          <p className="mt-2 text-gray-400">Psychological profiling and intent analysis</p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Session List */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="mb-4 text-lg font-semibold text-[#C5A059]">Active Sessions</h2>
            <div className="space-y-2">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    selectedSession?.id === session.id
                      ? "border-[#C5A059] bg-[#C5A059]/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm">{session.id.slice(0, 8)}...</span>
                    <span className={`rounded-full px-2 py-1 text-xs ${getCertaintyColor(session.userPersona.certainty)}`}>
                      {session.userPersona.certainty}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Score: {session.leadScore} | Rooms: {session.roomIntent.length}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* User Persona Card */}
          {selectedSession && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-6 lg:col-span-2">
              <h2 className="mb-6 text-xl font-semibold text-[#C5A059]">Psychological Profile</h2>

              {/* Persona Overview */}
              <div className="mb-6 grid grid-cols-3 gap-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-2xl font-bold text-[#C5A059]">
                    {selectedSession.userPersona.certainty}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">Certainty</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                  <div className={`text-2xl font-bold ${getInterestColor(selectedSession.userPersona.interestLevel)}`}>
                    {selectedSession.userPersona.interestLevel}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">Interest Level</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-2xl font-bold text-white">
                    {selectedSession.userPersona.focusQuality || "Unknown"}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">Focus Quality</div>
                </div>
              </div>

              {/* Preferred Style */}
              {selectedSession.userPersona.preferredStyle && (
                <div className="mb-6">
                  <h3 className="mb-2 text-sm font-medium text-gray-400">Preferred Style</h3>
                  <div className="rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 px-4 py-3 text-[#C5A059]">
                    {selectedSession.userPersona.preferredStyle}
                  </div>
                </div>
              )}

              {/* Behavioral Report */}
              {selectedSession.behavioralReport && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-gray-400">Detailed Analysis</h3>

                  {/* Summary */}
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <p className="text-sm leading-relaxed text-gray-300">
                      {selectedSession.behavioralReport.behaviorSummary}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-gray-400">Total Focus Time</div>
                      <div className="mt-1 text-lg font-semibold">
                        {formatTime(selectedSession.behavioralReport.totalFocusTime)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                      <div className="text-xs text-gray-400">Weighted Score</div>
                      <div className="mt-1 text-lg font-semibold text-[#C5A059]">
                        {selectedSession.behavioralReport.weightedScore}
                      </div>
                    </div>
                  </div>

                  {/* Style Affinity */}
                  {Object.keys(selectedSession.behavioralReport.styleAffinity).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium text-gray-400">Style Affinity</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selectedSession.behavioralReport.styleAffinity).map(
                          ([style, count]) => (
                            <span
                              key={style}
                              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm"
                            >
                              {style}: <span className="text-[#C5A059]">{count}</span>
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Room Engagement */}
                  {Object.keys(selectedSession.behavioralReport.roomEngagement).length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium text-gray-400">Room Engagement (seconds)</h4>
                      <div className="space-y-2">
                        {Object.entries(selectedSession.behavioralReport.roomEngagement).map(
                          ([room, time]) => (
                            <div
                              key={room}
                              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                            >
                              <span className="text-sm capitalize">{room.replace(/-/g, " ")}</span>
                              <span className="text-sm text-[#C5A059]">{time}s</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Intelligence Section */}
              <div className="mt-6 rounded-lg border border-[#C5A059]/30 bg-gradient-to-br from-[#C5A059]/10 to-transparent p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#C5A059]">
                    🤖 AI Intelligence Report
                  </h3>
                  {!selectedSession.aiAnalysis && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => triggerAIAnalysis("form_submit")}
                        disabled={isAnalyzing}
                        className="rounded-lg bg-[#C5A059] px-4 py-2 text-sm font-medium text-black transition-all hover:bg-[#C5A059]/80 disabled:opacity-50"
                      >
                        {isAnalyzing ? "Analyzing..." : "Generate AI Analysis"}
                      </button>
                    </div>
                  )}
                </div>
                
                {isAnalyzing && (
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#C5A059] border-t-transparent" />
                    Analyzing behavioral patterns with Gemini AI...
                  </div>
                )}
                
                {aiError && (
                  <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-400">
                    {aiError}
                  </div>
                )}
                
                {selectedSession.aiAnalysis ? (
                  <div className="space-y-4">
                    {/* Phone Number Display */}
                    {selectedSession.phone && (
                      <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
                        <span className="text-2xl">📱</span>
                        <div>
                          <div className="text-xs text-gray-400">Phone Number</div>
                          <div className="text-lg font-semibold text-white" dir="ltr">
                            {selectedSession.phone}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* AI Summary in Arabic */}
                    <div className="rounded-lg bg-white/5 p-4">
                      <div className="mb-2 text-xs font-medium text-[#C5A059]">
                        AI-Generated Analysis (Arabic)
                      </div>
                      <p className="text-lg leading-relaxed text-white" dir="rtl">
                        {selectedSession.aiAnalysis.arabicSummary}
                      </p>
                    </div>
                    
                    {/* Key Insights Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400">Preferred Style</div>
                        <div className="mt-1 font-semibold text-[#C5A059]">
                          {selectedSession.aiAnalysis.preferredStyle}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400">Estimated Budget</div>
                        <div className="mt-1 font-semibold text-[#C5A059]">
                          {selectedSession.aiAnalysis.estimatedBudget}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400">Intent Level</div>
                        <div className="mt-1 font-semibold text-[#C5A059]">
                          {selectedSession.aiAnalysis.intent}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-3">
                        <div className="text-xs text-gray-400">Focused On</div>
                        <div className="mt-1 font-semibold text-[#C5A059]">
                          {selectedSession.aiAnalysis.focusedFurniture.slice(0, 2).join(", ")}
                        </div>
                      </div>
                    </div>
                    
                    {/* English Summary for Admin */}
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="mb-1 text-xs text-gray-400">Admin Summary (English)</div>
                      <p className="text-sm text-gray-300">
                        {selectedSession.aiAnalysis.summary}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">
                    Click "Generate AI Analysis" to get AI-powered insights about this visitor&apos;s preferences and intent.
                    <br />
                    <span className="text-xs text-gray-500">
                      Requires GEMINI_API_KEY environment variable to be configured.
                    </span>
                  </div>
                )}
              </div>

              {/* Raw Data Toggle */}
              <details className="mt-6">
                <summary className="cursor-pointer text-sm text-gray-400 hover:text-white">
                  View Raw Session Data
                </summary>
                <pre className="mt-4 overflow-auto rounded-lg border border-white/10 bg-black/50 p-4 text-xs">
                  {JSON.stringify(
                    {
                      userPersona: selectedSession.userPersona,
                      behavioralReport: selectedSession.behavioralReport,
                      leadScore: selectedSession.leadScore,
                      roomIntent: selectedSession.roomIntent,
                      stylePreferences: selectedSession.stylePreferences,
                      aiAnalysis: selectedSession.aiAnalysis,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Neural Sales Insight Card */}
        <div className="mt-8 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧠</span>
              <h2 className="text-lg font-semibold text-purple-400">Neural Sales Insight</h2>
              {neuralInsight?.confidence === "high" && (
                <span className="rounded-full bg-green-500/20 px-2 py-1 text-xs text-green-400">High Confidence</span>
              )}
              {neuralInsight?.confidence === "medium" && (
                <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-400">Medium Confidence</span>
              )}
              {neuralInsight?.confidence === "low" && (
                <span className="rounded-full bg-gray-500/20 px-2 py-1 text-xs text-gray-400">Low Confidence</span>
              )}
            </div>
            <button
              onClick={() => fetchNeuralInsight(true)}
              disabled={isLoadingNeural}
              className="rounded-lg bg-purple-500/20 px-4 py-2 text-sm font-medium text-purple-400 transition-all hover:bg-purple-500/30 disabled:opacity-50"
            >
              {isLoadingNeural ? "Analyzing..." : "Refresh Insight"}
            </button>
          </div>
          
          {isLoadingNeural ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-purple-300">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <span className="font-medium">Loading... Gemini AI is analyzing lead data</span>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <p>🔄 Processing {bufferedInteractionsRef.current} buffered interactions...</p>
                <p>⏳ Generating Arabic sales recommendation...</p>
              </div>
            </div>
          ) : neuralInsight ? (
            <div className="space-y-3">
              <p className="text-lg leading-relaxed text-white" dir="rtl">
                {neuralInsight.salesTip}
              </p>
              {neuralInsight.analyzedAt && (
                <div className="text-xs text-gray-500">
                  Last analyzed: {new Date(neuralInsight.analyzedAt).toLocaleTimeString()}
                  {bufferedInteractionsRef.current > 0 && (
                    <span className="ml-2 text-purple-400">
                      (Buffered: {bufferedInteractionsRef.current} interactions)
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              <p>AI will analyze visitor behavior and provide a 1-sentence sales tip in Arabic.</p>
              <p className="mt-1 text-xs text-gray-500">
                Analysis triggers automatically when sufficient data is buffered (10+ interactions or lead score &gt; 25).
              </p>
            </div>
          )}
        </div>

        {/* Real-time Store Data */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-lg font-semibold text-[#C5A059]">Real-time Store State</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Lead Score</div>
              <div className="mt-1 text-2xl font-bold">{store.leadScore}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Intent</div>
              <div className="mt-1 text-2xl font-bold capitalize">{store.intent}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Style Switches</div>
              <div className="mt-1 text-2xl font-bold">{store.styleSwitches}</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="text-xs text-gray-400">Rooms Viewed</div>
              <div className="mt-1 text-2xl font-bold">{store.roomIntent.length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
