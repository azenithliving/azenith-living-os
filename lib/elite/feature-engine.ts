/**
 * ELITE FEATURE ENGINE
 * Intelligent behavior engine for dynamic content display
 * 
 * CLASSIFICATION: ISOLATE
 * Elite-specific intelligence layer for personalized experiences
 */

import { createClient } from "@/utils/supabase/server";
import { cache } from "react";

export type ProjectStatus = 
  | "pending" 
  | "design" 
  | "approval" 
  | "production" 
  | "installation" 
  | "completed" 
  | "on_hold";

export type PaymentStatus = 
  | "no_payment_due" 
  | "upcoming" 
  | "due_soon" 
  | "overdue" 
  | "paid";

export type ProjectInsight = {
  status: ProjectStatus;
  progressPercentage: number;
  daysInStage: number;
  estimatedCompletion: Date | null;
  nextMilestone: string | null;
  paymentStatus: PaymentStatus;
  daysUntilPayment: number | null;
  urgencyLevel: "none" | "low" | "medium" | "high" | "critical";
};

export type SmartCTA = {
  type: "continue_project" | "view_progress" | "pay_installment" | "schedule_meeting" | "contact_support";
  label: string;
  description: string;
  priority: number;
  urgency: boolean;
};

export type BehaviorState = {
  greeting: string;
  primaryCTA: SmartCTA;
  secondaryCTAs: SmartCTA[];
  alertMessage: string | null;
  encouragementMessage: string | null;
  showUrgency: boolean;
  showImpact: boolean;
  showCelebration: boolean;
};

/**
 * Get project data for a client (read-only from requests table)
 * Classification: ISOLATE - Elite-specific data aggregation
 */
export const getClientProject = cache(async (clientAccessId: string) => {
  const supabase = await createClient();
  
  // Get client access to find linked request
  const { data: clientAccess } = await supabase
    .from("client_access")
    .select("request_id, phone")
    .eq("id", clientAccessId)
    .single();
  
  if (!clientAccess?.request_id) {
    return null;
  }
  
  // Read from requests table (read-only per protocol)
  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", clientAccess.request_id)
    .single();
  
  return request;
});

/**
 * Get payment data for a client
 * Classification: ISOLATE - Elite-specific payment intelligence
 */
export const getClientPayments = cache(async (clientAccessId: string) => {
  const supabase = await createClient();
  
  const { data: clientAccess } = await supabase
    .from("client_access")
    .select("request_id")
    .eq("id", clientAccessId)
    .single();
  
  if (!clientAccess?.request_id) {
    return [];
  }
  
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("request_id", clientAccess.request_id)
    .order("created_at", { ascending: false });
  
  return payments || [];
});

/**
 * Calculate project insight from raw data
 * Classification: ISOLATE - Elite-specific intelligence computation
 */
export function calculateProjectInsight(
  request: Record<string, unknown> | null,
  payments: Record<string, unknown>[]
): ProjectInsight {
  if (!request) {
    return {
      status: "pending",
      progressPercentage: 0,
      daysInStage: 0,
      estimatedCompletion: null,
      nextMilestone: null,
      paymentStatus: "no_payment_due",
      daysUntilPayment: null,
      urgencyLevel: "none",
    };
  }
  
  const status = (request.status as ProjectStatus) || "pending";
  const createdAt = request.created_at ? new Date(request.created_at as string) : new Date();
  const updatedAt = request.updated_at ? new Date(request.updated_at as string) : createdAt;
  
  // Calculate days in current stage
  const daysInStage = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // Map status to progress percentage
  const progressMap: Record<ProjectStatus, number> = {
    pending: 5,
    design: 20,
    approval: 35,
    production: 60,
    installation: 85,
    completed: 100,
    on_hold: 0,
  };
  
  const progressPercentage = progressMap[status] || 0;
  
  // Determine payment status
  const paid = request.paid as boolean;
  const price = request.price as number | null;
  
  let paymentStatus: PaymentStatus = "no_payment_due";
  let daysUntilPayment: number | null = null;
  
  if (price && !paid) {
    // Logic: if project is in production or later, payment is due soon
    if (["production", "installation"].includes(status)) {
      paymentStatus = "due_soon";
      daysUntilPayment = 7;
    } else if (status === "approval") {
      paymentStatus = "upcoming";
      daysUntilPayment = 14;
    }
    
    // Check payments to see if any are pending
    const pendingPayment = payments.find((p) => p.status === "pending");
    if (pendingPayment) {
      const paymentCreated = new Date(pendingPayment.created_at as string);
      const daysSince = Math.floor((Date.now() - paymentCreated.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSince > 7) {
        paymentStatus = "overdue";
      }
      daysUntilPayment = Math.max(0, 7 - daysSince);
    }
  }
  
  // Calculate urgency level
  let urgencyLevel: ProjectInsight["urgencyLevel"] = "none";
  if (paymentStatus === "overdue") {
    urgencyLevel = "critical";
  } else if (paymentStatus === "due_soon" && daysUntilPayment !== null && daysUntilPayment <= 3) {
    urgencyLevel = "high";
  } else if (daysInStage > 14 && status !== "completed") {
    urgencyLevel = "medium";
  } else if (daysInStage > 7 && status !== "completed") {
    urgencyLevel = "low";
  }
  
  // Determine next milestone
  const milestoneMap: Record<ProjectStatus, string | null> = {
    pending: "بدء مرحلة التصميم",
    design: "مراجعة التصميم الأولي",
    approval: "الموافقة النهائية على التصميم",
    production: "بدء التصنيع",
    installation: "التركيب والتشطيب النهائي",
    completed: "المشروع مكتمل",
    on_hold: "استئناف المشروع",
  };
  
  // Estimate completion (rough heuristic)
  let estimatedCompletion: Date | null = null;
  if (status !== "completed" && status !== "on_hold") {
    estimatedCompletion = new Date();
    const remainingProgress = 100 - progressPercentage;
    const daysPerPercent = 2; // Rough estimate
    estimatedCompletion.setDate(estimatedCompletion.getDate() + remainingProgress * daysPerPercent);
  }
  
  return {
    status,
    progressPercentage,
    daysInStage,
    estimatedCompletion,
    nextMilestone: milestoneMap[status],
    paymentStatus,
    daysUntilPayment,
    urgencyLevel,
  };
}

/**
 * Generate behavior state based on project insight
 * Classification: ISOLATE - Elite-specific dynamic content generation
 */
export function generateBehaviorState(
  clientName: string | null,
  insight: ProjectInsight
): BehaviorState {
  const name = clientName || "عميلنا الكريم";
  
  // Generate personalized greeting
  const hour = new Date().getHours();
  let timeGreeting = "أهلاً";
  if (hour >= 5 && hour < 12) timeGreeting = "صباح الخير";
  else if (hour >= 12 && hour < 17) timeGreeting = "مساء النور";
  else timeGreeting = "مساء الخير";
  
  const greeting = `${timeGreeting}، ${name}`;
  
  // Determine primary CTA based on state
  let primaryCTA: SmartCTA;
  const secondaryCTAs: SmartCTA[] = [];
  let alertMessage: string | null = null;
  let encouragementMessage: string | null = null;
  let showUrgency = false;
  let showImpact = false;
  let showCelebration = false;
  
  // Payment urgency takes highest priority
  if (insight.paymentStatus === "overdue") {
    primaryCTA = {
      type: "pay_installment",
      label: "سداد الدفعة المتأخرة",
      description: "لضمان استمرار العمل على مشروعك",
      priority: 100,
      urgency: true,
    };
    alertMessage = "تنبيه: لديك دفعة مستحقة لتجنب تأخير المشروع";
    showUrgency = true;
  } else if (insight.paymentStatus === "due_soon" && insight.daysUntilPayment !== null && insight.daysUntilPayment <= 3) {
    primaryCTA = {
      type: "pay_installment",
      label: `سداد الدفعة المتبقية (${insight.daysUntilPayment} أيام)`,
      description: "للإبقاء على المشروع في المسار الصحيح",
      priority: 90,
      urgency: true,
    };
    alertMessage = `تذكير: موعد سداد الدفعة خلال ${insight.daysUntilPayment} أيام`;
    showUrgency = true;
  } else if (insight.status === "on_hold") {
    primaryCTA = {
      type: "contact_support",
      label: "التواصل لفك التجميد",
      description: "نحتاج للتواصل لاستئناف المشروع",
      priority: 85,
      urgency: true,
    };
    alertMessage = "المشروع متوقف حالياً - تواصل معنا للاستئناف";
    showImpact = true;
  } else if (insight.progressPercentage >= 85) {
    // Project nearly complete - celebration mode
    primaryCTA = {
      type: "view_progress",
      label: "شاهد إنجازنا معاً",
      description: "المشروع على وشك الانتهاء!",
      priority: 80,
      urgency: false,
    };
    encouragementMessage = "أصبحنا على بعد خطوات قليلة من تحقيق رؤيتك! 🎉";
    showCelebration = true;
  } else if (insight.daysInStage > 14) {
    // Delayed project
    primaryCTA = {
      type: "view_progress",
      label: "متابعة حالة المشروع",
      description: "نحن نعمل على تسريع الخطوات",
      priority: 75,
      urgency: true,
    };
    alertMessage = "نحن ندرك التأخير ونعمل على تسريع الإنجاز";
    showImpact = true;
  } else if (insight.progressPercentage === 0) {
    // New project
    primaryCTA = {
      type: "continue_project",
      label: "ابدأ رحلتك معنا",
      description: "دعنا نحول رؤيتك إلى واقع",
      priority: 70,
      urgency: false,
    };
  } else {
    // Default active project
    primaryCTA = {
      type: "view_progress",
      label: "متابعة تقدم المشروع",
      description: `التقدم الحالي: ${insight.progressPercentage}%`,
      priority: 60,
      urgency: false,
    };
    
    if (insight.progressPercentage > 50) {
      encouragementMessage = "أنت في منتصف الطريق! المشروع يسير بخطى ثابتة.";
    }
  }
  
  // Add secondary CTAs
  if (primaryCTA.type !== "view_progress" && insight.progressPercentage > 0) {
    secondaryCTAs.push({
      type: "view_progress",
      label: "عرض التقدم",
      description: "راجع مراحل إنجاز مشروعك",
      priority: 50,
      urgency: false,
    });
  }
  
  if (insight.paymentStatus === "upcoming" && primaryCTA.type !== "pay_installment") {
    secondaryCTAs.push({
      type: "pay_installment",
      label: "الدفعة القادمة",
      description: "تحضيراً للمرحلة القادمة",
      priority: 40,
      urgency: false,
    });
  }
  
  secondaryCTAs.push({
    type: "schedule_meeting",
    label: "جدولة اجتماع",
    description: "للتباحث مباشرة مع فريقك",
    priority: 30,
    urgency: false,
  });
  
  return {
    greeting,
    primaryCTA,
    secondaryCTAs,
    alertMessage,
    encouragementMessage,
    showUrgency,
    showImpact,
    showCelebration,
  };
}

/**
 * Get complete elite state for a client
 * Classification: ISOLATE - Elite-specific state aggregation
 */
export async function getEliteState(clientAccessId: string, clientName?: string | null) {
  const project = await getClientProject(clientAccessId);
  const payments = await getClientPayments(clientAccessId);
  const insight = calculateProjectInsight(project, payments);
  const behavior = generateBehaviorState(clientName || null, insight);
  
  return {
    project,
    payments,
    insight,
    behavior,
  };
}
