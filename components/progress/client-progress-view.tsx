"use client";

import { STAGE_NAMES, MAX_STEPS_PER_STAGE, type StageNumber } from "@/lib/progress-config";
import type { RequestRecord } from "@/app/actions/progress-actions";

interface ClientProgressViewProps {
  request: RequestRecord;
}

export function ClientProgressView({ request }: ClientProgressViewProps) {
  const { 
    client_name, 
    current_stage, 
    current_step, 
    progress_percentage,
    total_price,
    payment_1,
    payment_2,
    payment_3,
    payment_4
  } = request;

  const stageName = STAGE_NAMES[current_stage];
  const maxSteps = MAX_STEPS_PER_STAGE[current_stage];

  // Determine status message
  const getStatusMessage = () => {
    if (progress_percentage === 100) {
      return "🎉 تم إكمال المشروع بنجاح!";
    }
    if (current_step === maxSteps) {
      return "✅ تم إنجاز هذه المرحلة، في انتظار الدفعة للمتابعة";
    }
    return `🔄 العمل جارٍ في ${stageName}`;
  };

  // Progress bar color based on percentage
  const getProgressColor = () => {
    if (progress_percentage >= 90) return "bg-emerald-500";
    if (progress_percentage >= 70) return "bg-blue-500";
    if (progress_percentage >= 50) return "bg-brand-primary";
    return "bg-amber-500";
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8" dir="rtl">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">تقدم مشروعك</h1>
          <p className="text-white/50">أزنيث للأثاث الفاخر</p>
        </div>

        {/* Client Info Card */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <p className="text-sm text-white/50">العميل</p>
          <p className="text-xl font-semibold text-white">{client_name}</p>
        </div>

        {/* Main Progress Card */}
        <div className="mb-6 rounded-2xl border border-brand-primary/20 bg-brand-primary/[0.05] p-6">
          {/* Percentage */}
          <div className="mb-6 text-center">
            <p className="text-sm text-white/50 mb-2">نسبة الإنجاز</p>
            <p className="text-5xl font-bold text-brand-primary">
              {progress_percentage}%
            </p>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="h-3 w-full rounded-full bg-white/10 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressColor()}`}
                style={{ width: `${progress_percentage}%` }}
              />
            </div>
          </div>

          {/* Stage Info */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-sm text-white/50 mb-1">المرحلة الحالية</p>
            <p className="text-lg font-semibold text-white">{stageName}</p>
            <p className="text-sm text-white/50 mt-2">
              الخطوة {current_step} من {maxSteps}
            </p>
          </div>
        </div>

        {/* Status Message */}
        <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <p className="text-white">{getStatusMessage()}</p>
        </div>

        {/* Payment Summary */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">ملخص الدفعات</h3>
          
          <div className="mb-4 flex items-center justify-between">
            <span className="text-white/50">السعر الإجمالي</span>
            <span className="text-xl font-bold text-brand-primary">
              {total_price.toLocaleString()} ج.م
            </span>
          </div>

          <div className="space-y-2">
            <PaymentRow 
              label="الدفعة الأولى (50%)" 
              amount={payment_1} 
              isPaid={progress_percentage >= 12.5}
            />
            <PaymentRow 
              label="الدفعة الثانية (20%)" 
              amount={payment_2} 
              isPaid={progress_percentage >= 55}
            />
            <PaymentRow 
              label="الدفعة الثالثة (20%)" 
              amount={payment_3} 
              isPaid={progress_percentage >= 74}
            />
            <PaymentRow 
              label="الدفعة الرابعة (10%)" 
              amount={payment_4} 
              isPaid={progress_percentage >= 92}
            />
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-white/30">
          نظام تتبع أزنيث © 2024
        </p>
      </div>
    </div>
  );
}

// Payment Row Component
interface PaymentRowProps {
  label: string;
  amount: number;
  isPaid: boolean;
}

function PaymentRow({ label, amount, isPaid }: PaymentRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${
          isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white/30"
        }`}>
          {isPaid ? "✓" : "○"}
        </div>
        <span className={isPaid ? "text-white/70" : "text-white/40"}>{label}</span>
      </div>
      <span className={isPaid ? "font-semibold text-white" : "text-white/40"}>
        {amount.toLocaleString()} ج.م
      </span>
    </div>
  );
}
