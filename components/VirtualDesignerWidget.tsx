"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, ChevronRight, Loader2, Download, RefreshCw, Send, User, Image as ImageIcon } from "lucide-react";
import { askNileChat, askAllam } from "@/lib/ai-orchestrator";

// Types
interface Question {
  id: number;
  text: string;
  type: "options" | "text" | "final";
  options?: { value: string; label: string; image?: string }[];
}

interface Answers {
  space: string;
  style: string;
  size: string;
  budget: string;
  priorities: string;
  furniture: string;
  notes: string;
  action: string;
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: "أهلاً بك! ما هي المساحة التي تفكر فيها؟",
    type: "options",
    options: [
      { value: "living-room", label: "غرفة معيشة" },
      { value: "bedroom", label: "غرفة نوم" },
      { value: "kitchen", label: "مطبخ" },
      { value: "dining", label: "سفرة" },
      { value: "home-office", label: "مكتب منزلي" },
      { value: "other", label: "أخرى" },
    ],
  },
  {
    id: 2,
    text: "ما هو أسلوب التصميم المفضل لديك؟",
    type: "options",
    options: [
      { value: "modern", label: "مودرن", image: "/images/style-modern.jpg" },
      { value: "classic", label: "كلاسيك", image: "/images/style-classic.jpg" },
      { value: "industrial", label: "صناعي", image: "/images/style-industrial.jpg" },
      { value: "scandinavian", label: "اسكندنافي", image: "/images/style-scandinavian.jpg" },
    ],
  },
  {
    id: 3,
    text: "ما هي أبعاد المساحة تقريباً؟",
    type: "options",
    options: [
      { value: "small", label: "صغيرة (أقل من 20 م²)" },
      { value: "medium", label: "متوسطة (20-40 م²)" },
      { value: "large", label: "كبيرة (أكثر من 40 م²)" },
    ],
  },
  {
    id: 4,
    text: "ما هي ميزانيتك التقريبية؟",
    type: "options",
    options: [
      { value: "economy", label: "اقتصادية" },
      { value: "mid", label: "متوسطة" },
      { value: "luxury", label: "فاخرة" },
    ],
  },
  {
    id: 5,
    text: "ما هي أهم أولوياتك في هذه المساحة؟",
    type: "options",
    options: [
      { value: "comfort", label: "الراحة" },
      { value: "hospitality", label: "الضيافة" },
      { value: "storage", label: "التخزين" },
      { value: "work", label: "العمل" },
    ],
  },
  {
    id: 6,
    text: "هل تفضل القطع الجاهزة أم التفصيل؟",
    type: "options",
    options: [
      { value: "ready", label: "جاهزة" },
      { value: "custom", label: "تفصيل" },
      { value: "mix", label: "مزيج" },
    ],
  },
  {
    id: 7,
    text: "هل هناك أي ملاحظات إضافية؟",
    type: "text",
  },
  {
    id: 8,
    text: "شكراً لك! هل ترغب في مشاهدة اقتراحات مخصصة أم التواصل مع مصمم؟",
    type: "final",
    options: [
      { value: "suggestions", label: "شاهد الاقتراحات" },
      { value: "contact", label: "تواصل مع مصمم" },
    ],
  },
];

// Style keywords for Pexels search
const STYLE_KEYWORDS: Record<string, string> = {
  modern: "modern interior design minimalist",
  classic: "classic luxury interior design elegant",
  industrial: "industrial loft interior design concrete",
  scandinavian: "scandinavian interior design hygge nordic",
};

// Space keywords for Pexels search
const SPACE_KEYWORDS: Record<string, string> = {
  "living-room": "living room",
  bedroom: "bedroom",
  kitchen: "kitchen",
  dining: "dining room",
  "home-office": "home office",
  other: "interior",
};

export default function VirtualDesignerWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [imagePage, setImagePage] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleWidget = () => setIsOpen(!isOpen);

  const handleAnswer = async (value: string) => {
    const question = QUESTIONS[currentQuestion];
    const key = Object.keys(answers)[currentQuestion] || getAnswerKey(currentQuestion);
    
    setAnswers((prev) => ({ ...prev, [key]: value }));

    if (question.id === 7) {
      // Analyze free text with AI
      setLoading(true);
      const dialect = detectDialect(value);
      let analysis = "";
      
      if (dialect === "egyptian") {
        const result = await askNileChat(
          `حلل هذا الطلب واقترح أفكار تصميم داخلي: "${value}"`
        );
        analysis = result.success ? result.content : "";
      } else if (dialect === "gulf") {
        const result = await askAllam(
          `حلل هذا الطلب واقترح أفكار تصميم داخلي: "${value}"`
        );
        analysis = result.success ? result.content : "";
      }
      
      setAiAnalysis(analysis);
      setLoading(false);
    }

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      handleAnswer(textInput.trim());
      setTextInput("");
    }
  };

  const getAnswerKey = (index: number): keyof Answers => {
    const keys: (keyof Answers)[] = [
      "space",
      "style",
      "size",
      "budget",
      "priorities",
      "furniture",
      "notes",
      "action",
    ];
    return keys[index];
  };

  const detectDialect = (text: string): "egyptian" | "gulf" | "none" => {
    const lower = text.toLowerCase();
    
    // Egyptian patterns
    const egyptianPatterns = [
      /\b(احنا|مش|عايز|عاوز|كده|يعني|بجد|ازيك|ي3ني|7ader)\b/,
      /\b(ana|enta|enti|eh|leh|izaay|keda|mesh|awyz|3ayez)\b/i,
      /[3ع7ح8]/,
    ];
    
    // Gulf patterns
    const gulfPatterns = [
      /\b(نبي|عندي|عندك|هذا|هذي|ايش|وش|شلون|وش في)\b/,
      /\b(shlon|ish|wesh|wain|haadha|hadhi|yalla|inshallah)\b/i,
    ];
    
    for (const pattern of egyptianPatterns) {
      if (pattern.test(lower)) return "egyptian";
    }
    
    for (const pattern of gulfPatterns) {
      if (pattern.test(lower)) return "gulf";
    }
    
    return "none";
  };

  const fetchPexelsImages = useCallback(async (page: number = 1) => {
    setLoading(true);
    
    const styleQuery = STYLE_KEYWORDS[answers.style || "modern"];
    const spaceQuery = SPACE_KEYWORDS[answers.space || "living-room"];
    const query = `${spaceQuery} ${styleQuery}`;
    
    try {
      const response = await fetch(
        `/api/pexels?query=${encodeURIComponent(query)}&page=${page}&per_page=10`
      );
      const data = await response.json();
      
      if (data.photos) {
        const urls = data.photos.map((p: any) => p.src.large);
        if (page === 1) {
          setImages(urls);
        } else {
          setImages((prev) => [...prev, ...urls]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch images:", error);
    } finally {
      setLoading(false);
    }
  }, [answers.style, answers.space]);

  const handleFinalAction = async (action: string) => {
    setAnswers((prev) => ({ ...prev, action }));
    
    if (action === "suggestions") {
      setShowResults(true);
      await fetchPexelsImages(1);
    } else if (action === "contact") {
      // Show contact form
      setShowResults(true);
    }
  };

  const loadMoreImages = () => {
    const nextPage = imagePage + 1;
    setImagePage(nextPage);
    fetchPexelsImages(nextPage);
  };

  const submitLead = async () => {
    if (!contactForm.name || !contactForm.phone) return;
    
    setSubmitting(true);
    
    try {
      const response = await fetch("/api/elite-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactForm.name,
          email: contactForm.email,
          phone: contactForm.phone,
          preferences: answers,
          aiAnalysis,
          source: "virtual_designer_widget",
        }),
      });
      
      if (response.ok) {
        setSubmitted(true);
      }
    } catch (error) {
      console.error("Failed to submit lead:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const resetWidget = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setTextInput("");
    setImages([]);
    setImagePage(1);
    setShowResults(false);
    setAiAnalysis("");
    setContactForm({ name: "", email: "", phone: "" });
    setSubmitted(false);
  };

  const currentQ = QUESTIONS[currentQuestion];

  return (
    <>
      {/* Chat Button */}
      <motion.button
        onClick={toggleWidget}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"
        style={{ backgroundColor: "#C5A059" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <MessageSquare className="w-6 h-6 text-white" />
        )}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-[400px] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
            style={{ maxHeight: "calc(100vh - 120px)" }}
          >
            {/* Header */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ backgroundColor: "#C5A059" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">المصمم الافتراضي</h3>
                  <p className="text-xs text-white/80">متاح للمساعدة</p>
                </div>
              </div>
              <button
                onClick={toggleWidget}
                className="p-1 rounded-full hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 240px)" }}>
              {!showResults ? (
                <div className="space-y-4">
                  {/* Progress */}
                  <div className="flex items-center gap-1 mb-4">
                    {QUESTIONS.map((_, idx) => (
                      <div
                        key={idx}
                        className="h-1 flex-1 rounded-full transition-colors"
                        style={{
                          backgroundColor:
                            idx <= currentQuestion ? "#C5A059" : "#E5E7EB",
                        }}
                      />
                    ))}
                  </div>

                  {/* Question */}
                  <motion.div
                    key={currentQ.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-4"
                  >
                    <p className="text-lg font-medium text-gray-800 leading-relaxed">
                      {currentQ.text}
                    </p>

                    {/* Options */}
                    {currentQ.type === "options" && currentQ.options && (
                      <div className="grid grid-cols-2 gap-3">
                        {currentQ.options.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleAnswer(option.value)}
                            disabled={loading}
                            className="p-4 rounded-xl border-2 border-gray-200 hover:border-[#C5A059] hover:bg-[#C5A059]/5 transition-all text-right disabled:opacity-50"
                          >
                            {option.image ? (
                              <div className="space-y-2">
                                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                                  <ImageIcon className="w-8 h-8 text-gray-400" />
                                </div>
                                <span className="font-medium text-sm">
                                  {option.label}
                                </span>
                              </div>
                            ) : (
                              <span className="font-medium">
                                {option.label}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Text Input */}
                    {currentQ.type === "text" && (
                      <div className="space-y-3">
                        <textarea
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="اكتب ملاحظاتك هنا..."
                          className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[#C5A059] focus:outline-none resize-none text-right"
                          rows={4}
                        />
                        <button
                          onClick={handleTextSubmit}
                          disabled={!textInput.trim() || loading}
                          className="w-full py-3 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{ backgroundColor: "#C5A059" }}
                        >
                          {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Send className="w-5 h-5" />
                              إرسال
                            </>
                          )}
                        </button>
                        {aiAnalysis && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-amber-50 rounded-xl text-sm text-amber-800"
                          >
                            <p className="font-medium mb-2">تحليل الملاحظات:</p>
                            <p>{aiAnalysis}</p>
                          </motion.div>
                        )}
                      </div>
                    )}

                    {/* Final Options */}
                    {currentQ.type === "final" && currentQ.options && (
                      <div className="space-y-3">
                        {currentQ.options.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleFinalAction(option.value)}
                            disabled={loading}
                            className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-[#C5A059] hover:bg-[#C5A059]/5 transition-all flex items-center justify-between disabled:opacity-50"
                          >
                            <span className="font-medium">
                              {option.label}
                            </span>
                            <ChevronRight
                              className="w-5 h-5"
                              style={{ color: "#C5A059" }}
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {answers.action === "suggestions" ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">اقتراحات التصميم</h4>
                        <button
                          onClick={resetWidget}
                          className="text-sm flex items-center gap-1"
                          style={{ color: "#C5A059" }}
                        >
                          <RefreshCw className="w-4 h-4" />
                          البداية
                        </button>
                      </div>
                      
                      {aiAnalysis && (
                        <div className="p-3 bg-amber-50 rounded-xl text-sm text-amber-800">
                          {aiAnalysis}
                        </div>
                      )}

                      {/* Images Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {images.map((url, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="aspect-square rounded-lg overflow-hidden bg-gray-100"
                          >
                            <img
                              src={url}
                              alt={`Suggestion ${idx + 1}`}
                              className="w-full h-full object-cover hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          </motion.div>
                        ))}
                      </div>

                      {loading && (
                        <div className="flex justify-center py-4">
                          <Loader2
                            className="w-8 h-8 animate-spin"
                            style={{ color: "#C5A059" }}
                          />
                        </div>
                      )}

                      {images.length > 0 && images.length < 30 && (
                        <button
                          onClick={loadMoreImages}
                          disabled={loading}
                          className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#C5A059] hover:text-[#C5A059] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Download className="w-5 h-5" />
                          تحميل المزيد
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!submitted ? (
                        <>
                          <h4 className="font-semibold">
                            أرسل بياناتك للتواصل مع مصمم
                          </h4>
                          
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="الاسم *"
                              value={contactForm.name}
                              onChange={(e) =>
                                setContactForm((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#C5A059] focus:outline-none text-right"
                            />
                            <input
                              type="email"
                              placeholder="البريد الإلكتروني"
                              value={contactForm.email}
                              onChange={(e) =>
                                setContactForm((prev) => ({
                                  ...prev,
                                  email: e.target.value,
                                }))
                              }
                              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#C5A059] focus:outline-none text-right"
                            />
                            <input
                              type="tel"
                              placeholder="رقم الهاتف *"
                              value={contactForm.phone}
                              onChange={(e) =>
                                setContactForm((prev) => ({
                                  ...prev,
                                  phone: e.target.value,
                                }))
                              }
                              className="w-full p-3 border-2 border-gray-200 rounded-xl focus:border-[#C5A059] focus:outline-none text-right"
                            />
                          </div>

                          <button
                            onClick={submitLead}
                            disabled={
                              !contactForm.name ||
                              !contactForm.phone ||
                              submitting
                            }
                            className="w-full py-3 rounded-xl text-white font-medium disabled:opacity-50"
                            style={{ backgroundColor: "#C5A059" }}
                          >
                            {submitting ? (
                              <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                            ) : (
                              "إرسال الطلب"
                            )}
                          </button>
                        </>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="text-center py-8 space-y-4"
                        >
                          <div
                            className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
                            style={{ backgroundColor: "#C5A059" }}
                          >
                            <Send className="w-8 h-8 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">
                              تم إرسال طلبك!
                            </h4>
                            <p className="text-gray-600">
                              سيتواصل معك فريقنا قريباً
                            </p>
                          </div>
                          <button
                            onClick={resetWidget}
                            className="text-sm"
                            style={{ color: "#C5A059" }}
                          >
                            بدء محادثة جديدة
                          </button>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
