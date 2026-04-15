"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ConsultantResponse {
  reply: string;
  sessionId: string;
}

interface SessionData {
  sessionId: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

const WELCOME_MESSAGE_NEW = "أهلاً بك في أزينث ليفينج. أنا مُستشارك الشخصي. هل تسمح لي بمعرفة اسمك؟";
const WELCOME_MESSAGE_RETURNING = (name: string, topic: string) => `أهلاً بعودتك ${name}. هل ما زلت مهتمًا بـ ${topic}؟`;

export default function ConsultantWidget() {
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
    const storedSessionId = localStorage.getItem("azenith_consultant_session_id");
    const storedMessages = localStorage.getItem("azenith_consultant_messages");
    const storedName = localStorage.getItem("azenith_consultant_name");

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
    }
  }, [messages]);

  // Save sessionId to localStorage
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("azenith_consultant_session_id", sessionId);
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
          const firstUserMsg = data.messages.find(m => m.role === "user");
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

  // Send welcome message on first open
  const handleOpen = useCallback(async () => {
    setIsOpen(true);

    if (hasLoadedSession) return;
    setHasLoadedSession(true);

    // If we have a stored sessionId, try to fetch it
    const storedSessionId = localStorage.getItem("azenith_consultant_session_id");
    const storedName = localStorage.getItem("azenith_consultant_name");

    if (storedSessionId) {
      const sessionMessages = await fetchSession(storedSessionId);
      if (sessionMessages && sessionMessages.length > 0) {
        // Returning user - add welcome back message
        const name = storedName || userName || "";
        const lastTopic = extractLastTopic(sessionMessages);
        const welcomeBackMsg: Message = {
          role: "assistant",
          content: WELCOME_MESSAGE_RETURNING(name, lastTopic),
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, welcomeBackMsg]);
        return;
      }
    }

    // New user - show welcome message
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: WELCOME_MESSAGE_NEW,
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [hasLoadedSession, fetchSession, messages.length, userName]);

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
    setMessages(prev => [...prev, userMessage]);
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

      // Add assistant message
      const assistantMessage: Message = {
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("[ConsultantWidget] Error sending message:", error);

      // Add error message
      const errorMessage: Message = {
        role: "assistant",
        content: "عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.",
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  // Extract last topic from conversation
  const extractLastTopic = (msgs: Message[]): string => {
    // Look for room or style mentions in messages
    const roomKeywords = ["غرفة", "صالة", "مطبخ", "حمام", "مكتب", "غرفة نوم", "غرفة أطفال"];
    const styleKeywords = ["مودرن", "كلاسيك", "صناعي", "اسكندنافي", "مينيمال"];

    for (let i = msgs.length - 1; i >= 0; i--) {
      const content = msgs[i].content;
      for (const keyword of roomKeywords) {
        if (content.includes(keyword)) {
          return keyword;
        }
      }
      for (const keyword of styleKeywords) {
        if (content.includes(keyword)) {
          return `التصميم ${keyword}`;
        }
      }
    }
    return "التصميم الداخلي";
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
      {/* Floating Button */}
      <motion.button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110"
        style={{ backgroundColor: "#C5A059" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-6 w-6 text-white" />
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
                <h3 className="font-semibold text-white">مُستشار أزينث</h3>
                <span className="text-xs text-white/80">متصل الآن</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-white/80 transition-colors hover:bg-white/20"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex h-[380px] flex-col gap-3 overflow-y-auto bg-zinc-900 p-4">
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-center text-gray-500">
                  <p>اضغط للبدء</p>
                </div>
              ) : (
                messages.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex max-w-[85%] ${
                      msg.role === "user" ? "ml-auto" : "mr-auto"
                    }`}
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
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="اكتب رسالتك..."
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
