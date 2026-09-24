/**
 * ────────────────────────────────────────────────────────────────────────────
 * VANGUARD – Email Adapter
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 2 – Email integration with Resend
 * 
 * Features:
 * - Send transactional emails
 * - HTML template rendering
 * - Attachment support
 * - Bounce/complaint webhook handling
 * - Email tracking (opens, clicks)
 * - Rate limiting
 * 
 * Uses Resend API: https://resend.com/docs/api-reference/emails/send-email
 */

import { logger } from "@/lib/vanguard/observability/logger";
import { rateLimiter } from "@/lib/vanguard/observability/rate_limiter";
import type { Result, VanguardError } from "@/lib/vanguard/types";
import { Ok, Err, makeError } from "@/lib/vanguard/types";

// ─── Configuration ───────────────────────────────────────────────────────────

const RESEND_API_URL = "https://api.resend.com";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailConfig {
  apiKey: string; // Resend API key
  fromEmail: string; // Sender email (must be verified domain)
  fromName?: string; // Sender name
  replyTo?: string; // Reply-to email
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  headers?: Record<string, string>;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailAttachment {
  filename: string;
  content: string; // Base64-encoded content
  contentType?: string;
}

export interface SendEmailResponse {
  emailId: string;
  success: boolean;
}

export interface EmailWebhookEvent {
  type: "email.sent" | "email.delivered" | "email.bounced" | "email.complained" | "email.opened" | "email.clicked";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    html?: string;
    text?: string;
  };
}

// ─── Email Templates ─────────────────────────────────────────────────────────

const EMAIL_TEMPLATES = {
  welcome: (name: string, link: string) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مرحباً بك في VANGUARD</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #2c3e50; text-align: center;">مرحباً ${name}! 👋</h1>
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      نحن سعداء بانضمامك إلى VANGUARD — نظام المبيعات الذكي المدعوم بالذكاء الاصطناعي.
    </p>
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      سأكون مساعدك الشخصي في رحلة البيع، وأساعدك في:
    </p>
    <ul style="color: #555; font-size: 16px; line-height: 1.8;">
      <li>إدارة العملاء المحتملين</li>
      <li>إنشاء عروض الأسعار</li>
      <li>تحليل السوق</li>
      <li>التنبؤ بالمبيعات</li>
    </ul>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${link}" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">ابدأ الآن</a>
    </div>
    <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
      إذا كان لديك أي استفسار، لا تتردد في التواصل معنا.
    </p>
  </div>
</body>
</html>`,

  quote: (customerName: string, quoteNumber: string, totalAmount: number, pdfLink: string) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>عرض السعر رقم ${quoteNumber}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h1 style="color: #2c3e50; text-align: center;">عرض السعر 📋</h1>
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      عزيزي ${customerName}،
    </p>
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      نرسل إليك عرض السعر رقم <strong>${quoteNumber}</strong> بناءً على طلبك.
    </p>
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h3 style="color: #2c3e50; margin-top: 0;">ملخص العرض</h3>
      <p style="color: #555; font-size: 18px; margin: 10px 0;">
        <strong>المبلغ الإجمالي:</strong> ${totalAmount.toLocaleString("ar-EG")} جنيه مصري
      </p>
    </div>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${pdfLink}" style="background-color: #27ae60; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">تحميل العرض (PDF)</a>
    </div>
    <p style="color: #888; font-size: 14px; line-height: 1.6;">
      هذا العرض صالح لمدة 30 يوماً من تاريخ الإصدار.
    </p>
    <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
      نتطلع للعمل معك! 🚀
    </p>
  </div>
</body>
</html>`,

  notification: (title: string, message: string, actionLink?: string) => `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h2 style="color: #2c3e50;">${title}</h2>
    <p style="color: #555; font-size: 16px; line-height: 1.6;">
      ${message}
    </p>
    ${actionLink ? `
    <div style="text-align: center; margin: 30px 0;">
      <a href="${actionLink}" style="background-color: #3498db; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">عرض التفاصيل</a>
    </div>
    ` : ""}
    <p style="color: #888; font-size: 14px; text-align: center; margin-top: 30px;">
      VANGUARD — نظام المبيعات الذكي
    </p>
  </div>
</body>
</html>`,
};

// ─── Email Adapter Class ─────────────────────────────────────────────────────

export class EmailAdapter {
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }

  // ── Send Email ───────────────────────────────────────────────────────────

  async sendEmail(message: EmailMessage): Promise<Result<SendEmailResponse, VanguardError>> {
    // Rate limit check
    const canProceed = await rateLimiter.waitAndCheck("resend");
    if (!canProceed) {
      return Err(makeError("RATE_LIMIT_EXCEEDED", "Resend rate limit exceeded"));
    }

    // Validate
    if (!message.to || (!message.html && !message.text)) {
      return Err(
        makeError("INVALID_EMAIL", "Email must have 'to' and either 'html' or 'text'")
      );
    }

    try {
      const payload: Record<string, unknown> = {
        from: this.config.fromName
          ? `${this.config.fromName} <${this.config.fromEmail}>`
          : this.config.fromEmail,
        to: Array.isArray(message.to) ? message.to : [message.to],
        subject: message.subject,
      };

      if (message.html) payload.html = message.html;
      if (message.text) payload.text = message.text;
      if (message.cc) payload.cc = Array.isArray(message.cc) ? message.cc : [message.cc];
      if (message.bcc) payload.bcc = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
      if (message.replyTo || this.config.replyTo) {
        payload.reply_to = message.replyTo || this.config.replyTo;
      }
      if (message.attachments && message.attachments.length > 0) {
        payload.attachments = message.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
          content_type: att.contentType,
        }));
      }
      if (message.headers) payload.headers = message.headers;
      if (message.tags) payload.tags = message.tags;

      logger.debug("[EmailAdapter] Sending email", {
        to: message.to,
        subject: message.subject,
      });

      const response = await fetch(`${RESEND_API_URL}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error("[EmailAdapter] Send failed", {
          status: response.status,
          error: errorData,
        });

        if (response.status === 429) {
          await rateLimiter.handleRateLimitResponse("resend", response.headers);
        }

        return Err(
          makeError("EMAIL_SEND_FAILED", `Failed to send email: ${response.status}`, {
            status: response.status,
            error: errorData,
          })
        );
      }

      const data = await response.json();
      logger.info("[EmailAdapter] Email sent", {
        to: message.to,
        emailId: data.id,
      });

      return Ok({
        emailId: data.id,
        success: true,
      });
    } catch (error) {
      logger.error("[EmailAdapter] Unexpected send error", { error });
      return Err(
        makeError("EMAIL_ADAPTER_ERROR", "Failed to send email", {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  // ── Send Welcome Email ───────────────────────────────────────────────────

  async sendWelcomeEmail(
    to: string,
    name: string,
    dashboardLink: string
  ): Promise<Result<SendEmailResponse, VanguardError>> {
    return this.sendEmail({
      to,
      subject: `مرحباً ${name}! 🎉 — VANGUARD`,
      html: EMAIL_TEMPLATES.welcome(name, dashboardLink),
    });
  }

  // ── Send Quote Email ─────────────────────────────────────────────────────

  async sendQuoteEmail(
    to: string,
    customerName: string,
    quoteNumber: string,
    totalAmount: number,
    pdfLink: string,
    pdfBase64?: string
  ): Promise<Result<SendEmailResponse, VanguardError>> {
    const attachments: EmailAttachment[] = [];

    if (pdfBase64) {
      attachments.push({
        filename: `quote-${quoteNumber}.pdf`,
        content: pdfBase64,
        contentType: "application/pdf",
      });
    }

    return this.sendEmail({
      to,
      subject: `عرض السعر رقم ${quoteNumber} — VANGUARD`,
      html: EMAIL_TEMPLATES.quote(customerName, quoteNumber, totalAmount, pdfLink),
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  // ── Send Notification Email ──────────────────────────────────────────────

  async sendNotification(
    to: string,
    title: string,
    message: string,
    actionLink?: string
  ): Promise<Result<SendEmailResponse, VanguardError>> {
    return this.sendEmail({
      to,
      subject: `🔔 ${title} — VANGUARD`,
      html: EMAIL_TEMPLATES.notification(title, message, actionLink),
    });
  }

  // ── Parse Webhook Event ──────────────────────────────────────────────────

  parseWebhookEvent(payload: EmailWebhookEvent): {
    type: EmailWebhookEvent["type"];
    emailId: string;
    to: string[];
    timestamp: string;
  } {
    return {
      type: payload.type,
      emailId: payload.data.email_id,
      to: payload.data.to,
      timestamp: payload.created_at,
    };
  }
}

// ─── Helper: Create Email Adapter from Environment ───────────────────────────

export function createEmailAdapter(): EmailAdapter {
  const config: EmailConfig = {
    apiKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.EMAIL_FROM || "",
    fromName: process.env.EMAIL_FROM_NAME || "VANGUARD",
    replyTo: process.env.EMAIL_REPLY_TO,
  };

  if (!config.apiKey || !config.fromEmail) {
    throw new Error(
      "[EmailAdapter] Missing required environment variables: RESEND_API_KEY, EMAIL_FROM"
    );
  }

  return new EmailAdapter(config);
}
