"use client";

import { useState, useEffect } from "react";
import { 
  MAX_STEPS_PER_STAGE, 
  STAGE_NAMES, 
  calculatePayments,
  type StageNumber 
} from "@/lib/progress-config";
import { 
  updateRequestProgress, 
  updateRequestPrice,
  type RequestRecord 
} from "@/app/actions/progress-actions";

interface AdminProgressPanelProps {
  request: RequestRecord;
  onUpdate?: () => void;
}

export function AdminProgressPanel({ request, onUpdate }: AdminProgressPanelProps) {
  const [stage, setStage] = useState<StageNumber>(request.current_stage);
  const [step, setStep] = useState<number>(request.current_step);
  const [price, setPrice] = useState<number>(request.total_price);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Get max steps for current stage
  const maxSteps = MAX_STEPS_PER_STAGE[stage];
  
  // Generate steps array for dropdown
  const availableSteps = Array.from({ length: maxSteps }, (_, i) => i + 1);

  // Handle stage change
  const handleStageChange = async (newStage: StageNumber) => {
    setStage(newStage);
    setStep(1); // Reset to first step of new stage
  };

  // Handle step change
  const handleStepChange = async (newStep: number) => {
    setStep(newStep);
    await updateProgress(stage, newStep);
  };

  // Update progress
  const updateProgress = async (newStage: StageNumber, newStep: number) => {
    setIsUpdating(true);
    setMessage(null);
    
    const result = await updateRequestProgress(request.id, newStage, newStep);
    
    if (result.success) {
      setMessage(result.notificationSent 
        ? "تم التحديث وإرسال الإشعار بنجاح" 
        : "تم التحديث بنجاح"
      );
      onUpdate?.();
    } else {
      setMessage("حدث خطأ: " + result.error);
    }
    
    setIsUpdating(false);
  };

  // Update price
  const handlePriceUpdate = async () => {
    setIsUpdating(true);
    setMessage(null);
    
    const result = await updateRequestPrice(request.id, price);
    
    if (result.success) {
      setMessage("تم تحديث السعر والدفعات بنجاح");
      onUpdate?.();
    } else {
      setMessage("حدث خطأ: " + result.error);
    }
    
    setIsUpdating(false);
  };

  // Calculate payments
  const payments = calculatePayments(price);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6" dir="rtl">
      <h3 className="mb-6 text-xl font-semibold text-white">لوحة تحكم التقدم</h3>
      
      {/* Message */}
      {message && (
        <div className={`mb-4 rounded-xl p-3 text-sm ${
          message.includes("خطأ") 
            ? "border border-red-500/20 bg-red-500/10 text-red-200" 
            : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
        }`}>
          {message}
        </div>
      )}

      {/* Price Section */}
      <div className="mb-6 space-y-4">
        <h4 className="text-sm font-medium text-white/70">السعر والدفعات</h4>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-white/50">السعر الإجمالي</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary"
              min="0"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handlePriceUpdate}
              disabled={isUpdating}
              className="w-full rounded-xl bg-brand-primary px-4 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d] disabled:opacity-50"
            >
              {isUpdating ? "جاري التحديث..." : "تحديث السعر"}
            </button>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:grid-cols-4">
          <div className="text-center">
            <p className="text-xs text-white/50">الدفعة 1 (50%)</p>
            <p className="text-lg font-semibold text-brand-primary">
              {payments.payment_1.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50">الدفعة 2 (20%)</p>
            <p className="text-lg font-semibold text-blue-400">
              {payments.payment_2.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50">الدفعة 3 (20%)</p>
            <p className="text-lg font-semibold text-purple-400">
              {payments.payment_3.toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50">الدفعة 4 (10%)</p>
            <p className="text-lg font-semibold text-emerald-400">
              {payments.payment_4.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Controls */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-white/70">التحكم في التقدم</h4>
        
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Stage Selector */}
          <div>
            <label className="mb-2 block text-sm text-white/50">المرحلة الحالية</label>
            <select
              value={stage}
              onChange={(e) => handleStageChange(Number(e.target.value) as StageNumber)}
              className="w-full rounded-xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary"
            >
              <option value={1}>{STAGE_NAMES[1]}</option>
              <option value={2}>{STAGE_NAMES[2]}</option>
              <option value={3}>{STAGE_NAMES[3]}</option>
              <option value={4}>{STAGE_NAMES[4]}</option>
            </select>
          </div>

          {/* Step Selector */}
          <div>
            <label className="mb-2 block text-sm text-white/50">
              الخطوة (من {maxSteps})
            </label>
            <select
              value={step}
              onChange={(e) => handleStepChange(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-[#111112] px-4 py-3 text-white outline-none transition focus:border-brand-primary"
            >
              {availableSteps.map((s) => (
                <option key={s} value={s}>الخطوة {s}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Current Status */}
        <div className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/50">الحالة الحالية</p>
              <p className="text-lg font-semibold text-white">
                {STAGE_NAMES[stage]} - الخطوة {step} من {maxSteps}
              </p>
            </div>
            <div className="text-left">
              <p className="text-sm text-white/50">نسبة الإنجاز</p>
              <p className="text-2xl font-bold text-brand-primary">
                {request.progress_percentage}%
              </p>
            </div>
          </div>
        </div>

        {/* Notification Triggers Info */}
        <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4">
          <p className="text-sm text-brand-primary">
            <strong>نقاط التنبيه:</strong>
          </p>
          <ul className="mt-2 space-y-1 text-xs text-white/60">
            <li>• الخطوة {maxSteps - 1}: إشعار قبل الدفع (pre-payment)</li>
            <li>• الخطوة {maxSteps}: إشعار اكتمال المرحلة + طلب الدفعة</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
