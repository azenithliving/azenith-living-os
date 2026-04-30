import { useState } from "react";
import useSessionStore from "@/stores/useSessionStore";
import { roomDefinitions } from "@/lib/site-content";

const questions = [
  {
    id: 1,
    question: "ما الذي يجذبك أكثر في التصميم؟",
    options: [
      "الأناقة والفخامة",
      "الراحة والعملية",
      "الحداثة والتكنولوجيا",
      "الدفء والطبيعة"
    ],
    styleMap: ["فاخر", "عملي", "مودرن", "دافئ"]
  },
  {
    id: 2,
    question: "نوع المساحة الرئيسية؟",
    options: roomDefinitions.slice(0, 4).map(r => r.title),
    roomMap: roomDefinitions.slice(0, 4).map(r => r.slug)
  },
  {
    id: 3,
    question: "الميزانية التقريبية؟",
    options: ["اقتصادي", "متوسط", "فاخر", "غير محدد"],
    budgetMap: ["<10k", "10-30k", ">30k", "all"]
  }
];

export default function StyleQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const updateProfile = useSessionStore(state => state.updateProfile);


  const currentQ = questions[step];

  const submitAnswer = (answer: string) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      const style = newAnswers[0];
      updateProfile({ style, quizStyle: style });
      // Track
    }
  };

  const restart = () => {
    setStep(0);
    setAnswers([]);
  };

  return (
    <div className="max-w-md mx-auto bg-white/[0.05] backdrop-blur-xl rounded-[2.5rem] border border-white/10 p-8 space-y-6 animate-fadeInUp">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-brand-primary/30 to-brand-primary/50 flex items-center justify-center">
          <span className="text-2xl">🎯</span>
        </div>
        <h2 className="text-2xl font-semibold text-white mb-2">ستايلك المثالي</h2>
        <p className="text-sm text-white/60">سؤال {step + 1} من 3</p>
      </div>

      <div>
        <p className="text-lg text-white/90 mb-6 text-center">{currentQ.question}</p>
        <div className="grid gap-3">
          {currentQ.options.map((option, index) => (
            <button
              key={index}
              onClick={() => submitAnswer(option)}
              className="group w-full p-6 rounded-2xl border border-white/10 bg-white/[0.04] text-left hover:border-brand-primary/50 hover:bg-brand-primary/10 transition-all text-white hover:text-brand-primary shadow-xl hover:shadow-2xl hover:-translate-y-1"
            >
              <span className="font-medium">{option}</span>
            </button>
          ))}
        </div>
      </div>

      {step > 0 && (
        <div className="flex gap-2 text-xs text-white/50 justify-center">
          <button onClick={restart} className="underline hover:text-white">إعادة</button>
        </div>
      )}
    </div>
  );
}

