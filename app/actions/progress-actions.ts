"use server";

import nodemailer from 'nodemailer';
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { 
  getProgressPercentage, 
  isLastStepInStage, 
  isPreFinalStep,
  getPaymentForStageEnd,
  calculatePayments,
  STAGE_NAMES,
  type StageNumber,
  MAX_STEPS_PER_STAGE
} from "@/lib/progress-config";
import type { RequestRecord, RequestUpdate } from "@/lib/progress-types";

// Re-export type for components
export type { RequestRecord } from "@/lib/progress-types";

// Gmail credentials - must be set in environment
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn('[Email] Gmail credentials not configured. Email notifications will be skipped.');
}

// Create transporter only if credentials are available
const transporter = GMAIL_USER && GMAIL_APP_PASSWORD 
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    })
  : null;

/**
 * Update request progress
 * STRICT: Only admin can update, values from PROGRESS_MAP only
 */
export async function updateRequestProgress(
  requestId: string,
  stage: StageNumber,
  step: number
): Promise<{ success: boolean; notificationSent?: boolean; error?: string }> {
  const supabase = getSupabaseAdminClient();
  
  try {
    // Validate inputs
    if (step < 1 || step > MAX_STEPS_PER_STAGE[stage]) {
      return { success: false, error: "Invalid step for stage" };
    }
    
    // Get exact percentage from map (NO calculation)
    const progressPercentage = getProgressPercentage(stage, step);
    
    // Get current request state
    const { data: currentRequest } = await supabase
      .from("requests")
      .select("*")
      .eq("id", requestId)
      .single();
    
    if (!currentRequest) {
      return { success: false, error: "Request not found" };
    }
    
    // Check if this is actually a change
    const isStageChanged = currentRequest.current_stage !== stage;
    const isStepChanged = currentRequest.current_step !== step;
    
    if (!isStageChanged && !isStepChanged) {
      return { success: true, notificationSent: false };
    }
    
    // Build update
    const update: RequestUpdate = {
      current_stage: stage,
      current_step: step,
      progress_percentage: progressPercentage,
      updated_at: new Date().toISOString(),
    };
    
    // Update database
    const { error } = await supabase
      .from("requests")
      .update(update)
      .eq("id", requestId);
    
    if (error) {
      throw error;
    }
    
    // Check notification triggers
    let notificationSent = false;
    
    // Trigger 1: End of stage (last step)
    if (isLastStepInStage(stage, step)) {
      await sendStageCompleteNotification(requestId, stage, step, progressPercentage);
      notificationSent = true;
    }
    // Trigger 2: Pre-final step (before last step)
    else if (isPreFinalStep(stage, step)) {
      await sendPrePaymentNotification(requestId, stage, step, progressPercentage);
      notificationSent = true;
    }
    
    return { success: true, notificationSent };
    
  } catch (error) {
    console.error("Failed to update progress:", error);
    return { success: false, error: "Failed to update progress" };
  }
}

/**
 * Update total price and recalculate payments
 * STRICT: payment_1=50%, payment_2=20%, payment_3=20%, payment_4=10%
 */
export async function updateRequestPrice(
  requestId: string,
  totalPrice: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseAdminClient();
  
  try {
    // Calculate exact payments
    const payments = calculatePayments(totalPrice);
    
    const { error } = await supabase
      .from("requests")
      .update({
        total_price: totalPrice,
        payment_1: payments.payment_1,
        payment_2: payments.payment_2,
        payment_3: payments.payment_3,
        payment_4: payments.payment_4,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error("Failed to update price:", error);
    return { success: false, error: "Failed to update price" };
  }
}

/**
 * Send notification when stage is complete (last step)
 * Trigger: Last step in any stage
 */
async function sendStageCompleteNotification(
  requestId: string,
  stage: StageNumber,
  step: number,
  percentage: number
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  // Get request details
  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .single();
  
  if (!request) return;
  
  // Duplicate prevention: Check if already notified for this stage/step
  if (
    request.last_notified_stage === stage &&
    request.last_notified_step === step &&
    request.last_notification_type === 'stage_complete'
  ) {
    return; // Already sent
  }
  
  const stageName = STAGE_NAMES[stage];
  const nextPaymentNumber = getPaymentForStageEnd(stage);
  
  // Build message
  let message = `تم الانتهاء من ${stageName} بنجاح ✅\n`;
  message += `نسبة الإنجاز: ${percentage}%\n`;
  message += `التفاصيل: تم إكمال جميع خطوات ${stageName}`;
  
  // Add payment info if applicable
  if (nextPaymentNumber) {
    const paymentKey = `payment_${nextPaymentNumber}` as keyof typeof request;
    const amount = request[paymentKey] as number;
    message += `\n\nالدفعة التالية: ${amount.toLocaleString()} جنيه\n`;
    message += `برجاء السداد للانتقال للمرحلة التالية`;
  } else {
    message += `\n\n🎉 تم إكمال المشروع بنجاح!`;
  }
  
  // Send notifications
  await sendNotification(request, `اكتمال ${stageName}`, message);
  
  // Mark as notified
  await markAsNotified(requestId, stage, step, 'stage_complete');
}

/**
 * Send pre-payment notification (step before last)
 * Trigger: Step before final in any stage
 */
async function sendPrePaymentNotification(
  requestId: string,
  stage: StageNumber,
  step: number,
  percentage: number
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  // Get request details
  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .single();
  
  if (!request) return;
  
  // Duplicate prevention
  if (
    request.last_notified_stage === stage &&
    request.last_notified_step === step &&
    request.last_notification_type === 'pre_payment'
  ) {
    return; // Already sent
  }
  
  const stageName = STAGE_NAMES[stage];
  const nextPaymentNumber = getPaymentForStageEnd(stage);
  
  let message = `اقتربنا من إتمام ${stageName}\n`;
  message += `نسبة الإنجاز الحالية: ${percentage}%\n`;
  
  if (nextPaymentNumber) {
    const paymentKey = `payment_${nextPaymentNumber}` as keyof typeof request;
    const amount = request[paymentKey] as number;
    message += `الخطوة القادمة ستتطلب سداد دفعة قدرها ${amount.toLocaleString()} جنيه\n`;
    message += `تفاصيل المرحلة الحالية: نحن في الخطوة ${step} من ${MAX_STEPS_PER_STAGE[stage]}`;
  }
  
  // Send notifications
  await sendNotification(request, `اقتراب إتمام ${stageName}`, message);
  
  // Mark as notified
  await markAsNotified(requestId, stage, step, 'pre_payment');
}

/**
 * Helper: Send both WhatsApp and Email notifications
 */
async function sendNotification(
  request: RequestRecord,
  subject: string,
  message: string
): Promise<void> {
  // Send WhatsApp
  await sendWhatsAppNotification(request.client_phone, message);
  
  // Send Email
  await sendEmailNotification(request.client_email, subject, message);
}

/**
 * Helper: Mark request as notified to prevent duplicates
 */
async function markAsNotified(
  requestId: string,
  stage: StageNumber,
  step: number,
  notificationType: 'stage_complete' | 'pre_payment'
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  
  await supabase
    .from("requests")
    .update({
      last_notification_sent_at: new Date().toISOString(),
      last_notification_type: notificationType,
      last_notified_stage: stage,
      last_notified_step: step,
    })
    .eq("id", requestId);
}

/**
 * Send WhatsApp notification via local API
 * Calls the Express server running on port 3001
 */
async function sendWhatsAppNotification(phone: string, message: string): Promise<void> {
  try {
    // Format phone (remove non-digits)
    const formattedPhone = phone.replace(/\D/g, '');
    
    console.log(`[WhatsApp] Sending to +${formattedPhone}...`);
    
    // Call local WhatsApp API
    const response = await fetch('http://localhost:3001/send-message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message: message,
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ WhatsApp sent to +${formattedPhone}`);
    } else {
      console.error(`❌ WhatsApp failed:`, result.error);
    }
  } catch (error) {
    console.error(`❌ WhatsApp API error:`, error);
    console.log('   Make sure whatsapp-init.js is running (node scripts/whatsapp-init.js)');
  }
}

/**
 * Send Email notification using Gmail SMTP
 */
async function sendEmailNotification(to: string, subject: string, body: string): Promise<void> {
  if (!transporter) {
    console.log(`[Email] Skipping email to ${to} - transporter not configured`);
    return;
  }
  
  try {
    await transporter.sendMail({
      from: `"Azenith Living" <${GMAIL_USER}>`,
      to,
      subject,
      text: body,
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
  }
}

/**
 * Get request with progress details
 */
export async function getRequestWithProgress(requestId: string): Promise<RequestRecord | null> {
  const supabase = getSupabaseAdminClient();
  
  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("id", requestId)
    .single();
  
  return data as RequestRecord | null;
}

/**
 * Get all requests for a company
 */
export async function getCompanyRequests(companyId: string): Promise<RequestRecord[]> {
  const supabase = getSupabaseAdminClient();
  
  const { data } = await supabase
    .from("requests")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  
  return (data as RequestRecord[]) || [];
}
