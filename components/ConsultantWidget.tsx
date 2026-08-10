"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSessionStore from "@/stores/useSessionStore";
import { X, Send, User, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AvatarButton from "./AvatarButton";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ConsultantResponse {
  reply: string;
  sessionId: string;
  uiAction?: string;
}

interface SessionData {
  sessionId: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const HUMAN_WELCOME_NEW = (isRTL: boolean) =>
  isRTL
    ? "أهلًا بك في أزينث ليفينج. أنا مستشارك الشخصي للتصميم الداخلي، وهساعدك نبدأ من المساحة الأهم بالنسبة لك. ما اسمك؟"
    : "Welcome to Azenith Living. I am your personal interior-design consultant. May I know your name?";

const HUMAN_WELCOME_RETURNING = (name: string, topic: string, isRTL: boolean) =>
  isRTL
    ? `أهلًا بعودتك ${name}. هل ما زلت مهتمًا بـ ${topic}؟`
    : `Welcome back ${name}. Are you still interested in ${topic}?`;

const HUMAN_WELCOME_QUANTUM = (isRTL: boolean) =>
  isRTL
    ? "لاحظت اهتمامك بالعرض الحالي. خليني أساعدك تختار المساحة الأنسب ونحدد الخطوة العملية التالية. أي غرفة أو مشروع تفكر فيه؟"
    : "I noticed your interest in the current offer. Let me help you choose the right space and next step. Which room or project are you considering?";

const HUMAN_WELCOME_THUNDER = (isRTL: boolean) =>
  isRTL
    ? "أهلًا بك. أقدر أساعدك بسرعة في فهم أنسب اتجاه للتصميم أو التشطيب حسب المساحة. ما نوع مشروعك؟"
    : "Welcome. I can quickly help you understand the best design or finishing direction for your space. What is your project type?";

const HUMAN_WELCOME_CONTEXTUAL = (isRTL: boolean) =>
  isRTL
    ? "أهلًا بك في أزينث. احكِ لي عن المساحة التي لفتت نظرك، وسأقترح عليك بداية مناسبة."
    : "Welcome to Azenith. Tell me which space caught your eye, and I will suggest a suitable starting point.";

function extractHumanLastTopic(msgs: Message[]): string {
  const roomKeywords = ["غرفة", "صالة", "مطبخ", "حمام", "مكتب", "غرفة نوم", "غرفة أطفال", "دريسنج", "فيلا"];
  const styleKeywords = ["مودرن", "كلاسيك", "نيو كلاسيك", "صناعي", "اسكندنافي", "مينيمال"];

  for (let i = msgs.length - 1; i >= 0; i--) {
    const content = msgs[i].content;
    for (const keyword of roomKeywords) {
      if (content.includes(keyword)) return keyword;
    }
    for (const keyword of styleKeywords) {
      if (content.includes(keyword)) return `التصميم ${keyword}`;
    }
  }

  return "التصميم الداخلي";
}

export default function ConsultantWidget() {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [hasLoadedSession, setHasLoadedSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const storedSessionId = localStorage.getItem("azenith_session_id");
    const storedMessages = localStorage.getItem("azenith_consultant_messages");
    const storedName = localStorage.getItem("azenith_consultant_name");
    const lastUpdate = localStorage.getItem("azenith_consultant_last_update");

    // Auto-expire session after 24 hours of inactivity
    if (lastUpdate && Date.now() - parseInt(lastUpdate, 10) > 86400000) {
      // Session expired: clear storage and reset component state
      localStorage.removeItem("azenith_session_id");
      localStorage.removeItem("azenith_consultant_messages");
      localStorage.removeItem("azenith_consultant_name");
      localStorage.removeItem("azenith_consultant_last_update");
      setSessionId(null);
      setMessages([]);
      setUserName(null);
      return;
    }

    if (storedSessionId) {
      setSessionId(storedSessionId);
    }

    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages);
        setMessages(parsed);
      } catch {
        setMessages([]);
      }
    }

    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("azenith_consultant_messages", JSON.stringify(messages));
      localStorage.setItem("azenith_consultant_last_update", Date.now().toString());
    }
  }, [messages]);

  // Save sessionId to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("azenith_session_id", sessionId);
    }
  }, [sessionId]);

  // Save userName to localStorage
  useEffect(() => {
    if (userName) {
      localStorage.setItem("azenith_consultant_name", userName);
    }
  }, [userName]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Fetch session from API
  const fetchSession = useCallback(async (sid: string) => {
    try {
      const response = await fetch(`/api/consultant?sessionId=${encodeURIComponent(sid)}`);
      if (response.ok) {
        const data: SessionData = await response.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          // Extract name from first user message
          const firstUserMsg = data.messages.find((m) => m.role === "user");
          if (firstUserMsg) {
            const extractedName = firstUserMsg.content.split(/\s+/)[0];
            if (extractedName.length > 1) {
              setUserName(extractedName);
            }
          }
          return data.messages;
        }
      }
    } catch (error) {
      console.error("[ConsultantWidget] Error fetching session:", error);
    }
    return null;
  }, []);

  // Fetch the latest global fate action to build contextual welcome
  const fetchLatestFateAction = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/admin/fate/latest");
      if (res.ok) {
        const data = await res.json();
        return data.action || null;
      }
    } catch { /* silent */ }
    return null;
  }, []);

  // Send welcome message on first open
  const handleOpen = useCallback(async () => {
    setIsOpen(true);

    if (hasLoadedSession) return;
    setHasLoadedSession(true);

    // If we have a stored sessionId, try to fetch it
    const storedSessionId = localStorage.getItem("azenith_session_id");
    const storedName = localStorage.getItem("azenith_consultant_name");

    if (storedSessionId) {
      const sessionMessages = await fetchSession(storedSessionId);
      if (sessionMessages && sessionMessages.length > 0) {
        // Returning user - add welcome back message
        const name = storedName || userName || "";
        const lastTopic = extractHumanLastTopic(sessionMessages);
        const welcomeBackMsg: Message = {
          role: "assistant",
          content: HUMAN_WELCOME_RETURNING(name, lastTopic, isRTL),
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, welcomeBackMsg]);
        return;
      }
    }

    // New user - check for active Fate Actions and build contextual greeting
    if (messages.length === 0) {
      const latestAction = await fetchLatestFateAction();
      let welcomeContent = HUMAN_WELCOME_NEW(isRTL);
      if (latestAction === "QUANTUM_OFFER") welcomeContent = HUMAN_WELCOME_QUANTUM(isRTL);
      else if (latestAction === "THUNDER") welcomeContent = HUMAN_WELCOME_THUNDER(isRTL);
      else if (latestAction === "HALLUCINATION") welcomeContent = HUMAN_WELCOME_CONTEXTUAL(isRTL);

      setMessages([{
        role: "assistant",
        content: welcomeContent,
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [hasLoadedSession, fetchSession, fetchLatestFateAction, messages.length, userName, isRTL]);

  // Proactive trigger: Open chat after 15 seconds if first visit
  useEffect(() => {
    const hasBeenOpened = localStorage.getItem("azenith_consultant_auto_opened");
    if (!hasBeenOpened) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        handleOpen();
        localStorage.setItem("azenith_consultant_auto_opened", "true");
      }, 15000);
      // Cleanup timeout on unmount or when handleOpen changes
      return () => clearTimeout(timer);
    }
  }, [handleOpen]);

  // Listen for the Fate open-chat event from RealityUIProvider.
  useEffect(() => {
    const handleFateOpenChat = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      const specialMessage = customEvent.detail?.message;

      // Open the chat.
      setIsOpen(true);
      setHasLoadedSession(true);

      if (specialMessage) {
        // Add the injected message to the UI immediately.
        setMessages((prev) => {
          if (prev.some((m) => m.content === specialMessage)) return prev;
          return [...prev, {
            role: "assistant" as const,
            content: specialMessage,
            timestamp: new Date().toISOString(),
          }];
        });

        // Persist it so the consultant can see the same context.
        const sid = localStorage.getItem("azenith_session_id");
        if (sid) {
          fetch("/api/consultant/inject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: sid,
              message: specialMessage,
              source: "fate",
            }),
          }).catch(() => { /* silent */ });
        }
      }
    };

    window.addEventListener("fate:open_chat", handleFateOpenChat);
    return () => window.removeEventListener("fate:open_chat", handleFateOpenChat);
  }, []);

  // Poll for admin replies every 15 seconds when chat is open
  useEffect(() => {
    if (!isOpen || !sessionId) return;
    const pollReplies = async () => {
      try {
        const res = await fetch(`/api/consultant/check-reply?sessionId=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.reply) {
            setMessages((prev) => [...prev, {
              role: "assistant",
              content: data.reply,
              timestamp: new Date().toISOString(),
            }]);
          }
        }
      } catch { /* silent */ }
    };
    const interval = setInterval(pollReplies, 15000);
    return () => clearInterval(interval);
  }, [isOpen, sessionId]);

  // Send message to API
  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setIsLoading(true);

    // Add user message to local state
    const userMessage: Message = {
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");

    // Extract name from first message if not known
    if (!userName && messages.length <= 1) {
      const extractedName = content.trim().split(/\s+/)[0];
      if (extractedName.length > 1) {
        setUserName(extractedName);
      }
    }

    try {
      const response = await fetch("/api/consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content.trim(),
          sessionId,
          userName: userName || undefined,
          history: messages,
          language: currentLang,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ConsultantResponse = await response.json();

      // Store sessionId
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }

      // Parse and execute Reality UI mutations
      let finalReply = data.reply;
      let uiAction = data.uiAction;
      const uiActionMatch = finalReply.match(/\[UI_ACTION:\s*([^\]]+)\]/);
      if (uiActionMatch) {
        uiAction = uiAction || uiActionMatch[1].trim();
        finalReply = finalReply.replace(/\[UI_ACTION:\s*[^\]]+\]/g, "").trim();
      }

      if (uiAction) {
        // Dispatch global event for the Reality Distortion Engine to pick up
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("azenith_reality_mutation", { detail: { action: uiAction } }));
          console.log(`[Reality Engine] Executing UI Mutation: ${uiAction}`);
        }
      }

      // Add assistant message
      const assistantMessage: Message = {
        role: "assistant",
        content: finalReply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("[ConsultantWidget] Error sending message:", error);

      // Add error message
      const errorMessage: Message = {
        role: "assistant",
        content: isRTL
          ? "عذرًا، الاتصال تعطل لحظة. حاول مرة أخرى، أو اترك رقمك وسيتواصل معك مستشار أزينث."
          : "Sorry, the connection paused for a moment. Please try again, or leave your phone number and an Azenith consultant will follow up.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const toggleChat = () => {
    if (!isOpen) {
      handleOpen();
    } else {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Floating Interactive Avatar Button */}
      <AvatarButton onClick={toggleChat} isOpen={isOpen} />

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-900 shadow-2xl"
            style={{ width: "380px", height: "500px" }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 border-b border-white/10 px-4 py-3"
              style={{ backgroundColor: "#C5A059" }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{isRTL ? "مستشار أزينث" : "Azenith Consultant"}</h3>
                <span className="text-xs text-white/80">{isRTL ? "متاح الآن" : "Online now"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    localStorage.removeItem("azenith_session_id");
                    localStorage.removeItem("azenith_consultant_messages");
                    localStorage.removeItem("azenith_consultant_name");
                    setSessionId(null);
                    setMessages([{
                      role: "assistant",
                      content: HUMAN_WELCOME_NEW(isRTL),
                      timestamp: new Date().toISOString(),
                    }]);
                    setUserName(null);
                  }}
                  title={isRTL ? "محادثة جديدة" : "New Chat"}
                  className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/20"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/20"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex h-[380px] flex-col gap-3 overflow-y-auto bg-zinc-900 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-gray-500">
                  <p>{isRTL ? "اضغط للبدء" : "Tap to start"}</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex max-w-[85%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "rounded-bl-lg bg-amber-500 text-white"
                          : "rounded-br-lg border border-white/10 bg-zinc-800 text-gray-100"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))
              )}

              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mr-auto max-w-[85%]"
                >
                  <div className="flex items-center gap-2 rounded-2xl rounded-br-lg border border-white/10 bg-zinc-800 px-4 py-3 text-gray-400">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.3s]"></span>
                      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500 [animation-delay:-0.15s]"></span>
                      <span className="h-2 w-2 animate-bounce rounded-full bg-amber-500"></span>
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 border-t border-white/10 bg-zinc-800 p-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputMessage(val);
                  // Pre-Cog Typing Sensor
                  if (sessionId) {
                    fetch("/api/consultant/typing", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sessionId, typingPreview: val }),
                    }).catch(() => {});
                  }
                }}
                placeholder={isRTL ? "اكتب رسالتك..." : "Type your message..."}
                className="flex-1 rounded-lg border border-white/10 bg-zinc-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-amber-500 focus:outline-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputMessage.trim() || isLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
