"use client";

import { useEffect, useState } from "react";
import { AutomationRule, AutomationAction, AutomationTrigger } from "@/lib/automation";

export default function AutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAutomationRules();
  }, []);

  const loadAutomationRules = async () => {
    setLoading(true);
    try {
      // For now, show default rules. In production, this would fetch from API
      const defaultRules: AutomationRule[] = [
        {
          id: "booking_accepted_whatsapp",
          name: "إشعار قبول الحجز عبر واتساب",
          trigger: "booking_status_changed" as AutomationTrigger["type"],
          conditions: { newStatus: "accepted" },
          actions: [{
            type: "send_whatsapp",
            message: "تم قبول حجزك! سنتواصل معك قريباً لترتيب التفاصيل."
          } as AutomationAction],
          enabled: true
        },
        {
          id: "booking_rejected_whatsapp",
          name: "إشعار رفض الحجز عبر واتساب",
          trigger: "booking_status_changed" as AutomationTrigger["type"],
          conditions: { newStatus: "rejected" },
          actions: [{
            type: "send_whatsapp",
            message: "نعتذر، لم نتمكن من قبول حجزك حالياً. سنتواصل معك لمناقشة البدائل."
          } as AutomationAction],
          enabled: true
        },
        {
          id: "lead_high_score_intent",
          name: "تحديث نية العميل عالي النتيجة",
          trigger: "lead_updated" as AutomationTrigger["type"],
          conditions: { score: { gte: 30 } },
          actions: [{
            type: "update_lead_intent",
            intent: "buyer"
          } as AutomationAction],
          enabled: true
        },
        {
          id: "lead_medium_score_intent",
          name: "تحديث نية العميل متوسط النتيجة",
          trigger: "lead_updated" as AutomationTrigger["type"],
          conditions: { score: { gte: 15, lt: 30 } },
          actions: [{
            type: "update_lead_intent",
            intent: "interested"
          } as AutomationAction],
          enabled: true
        }
      ];
      setRules(defaultRules);
    } catch (error) {
      console.error("Failed to load automation rules:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    // In production, this would update the rule in database
    setRules(prev => prev.map(rule =>
      rule.id === ruleId ? { ...rule, enabled } : rule
    ));
  };

  if (loading) {
    return (
      <main className="px-8 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-white">جاري تحميل قواعد الأتمتة...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="px-8 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-brand-primary/70">Automation system</p>
            <h1 className="mt-3 font-serif text-4xl text-white md:text-5xl">نظام الأتمتة</h1>
          </div>
          <button className="rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-brand-accent transition hover:bg-[#d8b56d]">
            إضافة قاعدة جديدة
          </button>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">قواعد الأتمتة النشطة</h2>
          <p className="mt-2 text-sm text-white/60">إدارة القواعد الآلية للنظام.</p>

          <div className="mt-6 space-y-4">
            {rules.length === 0 ? (
              <div className="text-center text-white/60 py-8">
                لا توجد قواعد أتمتة محددة
              </div>
            ) : (
              rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white">{rule.name}</h3>
                      <p className="mt-1 text-sm text-white/60">
                        الزناد: {rule.trigger === "booking_status_changed" ? "تغيير حالة الحجز" : rule.trigger}
                      </p>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-white/70">
                          الشروط: {Object.entries(rule.conditions).map(([key, value]) => {
                            if (typeof value === 'object' && value !== null) {
                              const conditions = [];
                              if ('gte' in value) conditions.push(`≥ ${value.gte}`);
                              if ('lt' in value) conditions.push(`< ${value.lt}`);
                              return `${key}: ${conditions.join(' و ')}`;
                            }
                            return `${key}: ${value}`;
                          }).join(", ")}
                        </p>
                        <div className="space-y-1">
                          {rule.actions.map((action, index) => (
                            <p key={index} className="text-sm text-white/70">
                              {action.type === "send_whatsapp" && "إرسال واتساب"}
                              {action.type === "update_lead_score" && `تحديث النتيجة إلى ${action.score}`}
                              {action.type === "update_lead_intent" && `تحديث النية إلى ${action.intent}`}
                              {action.message && ` - "${action.message}"`}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => toggleRule(rule.id, e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-white/70">نشط</span>
                      </label>
                      <button className="rounded border border-white/20 px-3 py-1 text-sm text-white/70 hover:border-brand-primary hover:text-brand-primary">
                        تعديل
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Automation Logs */}
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <h2 className="text-2xl font-semibold text-white">سجل الأتمتة</h2>
          <p className="mt-2 text-sm text-white/60">سجل الإجراءات الآلية المنفذة.</p>

          <div className="mt-6 space-y-4">
            <div className="text-center text-white/60 py-8">
              لا توجد سجلات أتمتة حتى الآن
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}