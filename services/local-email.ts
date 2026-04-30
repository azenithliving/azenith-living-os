/**
 * Local Email Service
 * Uses Nodemailer with local SMTP (MailHog for development)
 * 100% free, self-hosted email solution
 */

import nodemailer from 'nodemailer';

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

export class LocalEmailService {
  private transporter: nodemailer.Transporter | null = null;
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // SMTP configuration from environment
      const smtpHost = process.env.SMTP_HOST || 'localhost';
      const smtpPort = parseInt(process.env.SMTP_PORT || '1025'); // MailHog default
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpSecure = process.env.SMTP_SECURE === 'true';

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser && smtpPass ? {
          user: smtpUser,
          pass: smtpPass
        } : undefined,
        tls: {
          rejectUnauthorized: false // For self-signed certs
        }
      });

      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      console.log('[Email] SMTP connected successfully');
    } catch (error) {
      console.error('[Email] SMTP connection failed:', error);
      // Don't throw - allow fallback mode
      this.transporter = null;
    }
  }

  /**
   * Send a single email
   */
  async send(email: EmailMessage): Promise<{ success: boolean; messageId?: string; error?: string }> {
    await this.initialize();

    if (!this.transporter) {
      console.log('[Email] Mock send (no SMTP):', email.to, email.subject);
      return { success: true, messageId: 'mock-' + Date.now() };
    }

    try {
      const from = email.from || process.env.EMAIL_FROM || 'noreply@azenith.local';

      const info = await this.transporter.sendMail({
        from,
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments
      });

      console.log('[Email] Sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('[Email] Send error:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send using a template
   */
  async sendTemplate(
    to: string | string[],
    templateName: string,
    variables: Record<string, string>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const template = this.getTemplate(templateName);
    if (!template) {
      return { success: false, error: `Template ${templateName} not found` };
    }

    // Replace variables in template
    let subject = template.subject;
    let html = template.html;
    let text = template.text;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      html = html.replace(regex, value);
      text = text.replace(regex, value);
    }

    return this.send({
      to,
      subject,
      html,
      text
    });
  }

  /**
   * Get email template
   */
  private getTemplate(name: string): EmailTemplate | null {
    const templates: Record<string, EmailTemplate> = {
      'order_confirmation': {
        name: 'order_confirmation',
        subject: 'تم تأكيد طلبك #{{order_number}} - Azenith Living',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>مرحباً {{customer_name}}!</h2>
            <p>تم تأكيد طلبك بنجاح.</p>
            <p><strong>رقم الطلب:</strong> {{order_number}}</p>
            <p><strong>الإجمالي:</strong> {{total_amount}} جنيه</p>
            <p>سنتواصل معك قريباً لتحديد موعد المعاينة.</p>
            <hr>
            <p style="color: #666;">Azenith Living - أثاث حسب الطلب</p>
          </div>
        `,
        text: `مرحباً {{customer_name}}! تم تأكيد طلبك #{{order_number}}. الإجمالي: {{total_amount}} جنيه. سنتواصل معك قريباً.`
      },

      'payment_reminder': {
        name: 'payment_reminder',
        subject: 'تذكير بالدفعة المستحقة - طلب #{{order_number}}',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>مرحباً {{customer_name}}</h2>
            <p>تذكير ودي: دفعة بقيمة {{amount}} جنيه مستحقة بتاريخ {{due_date}}.</p>
            <p><strong>رقم الطلب:</strong> {{order_number}}</p>
            <p>للاستفسار، تواصل معنا على واتساب.</p>
          </div>
        `,
        text: `مرحباً {{customer_name}}، تذكير: دفعة {{amount}} جنيه للطلب #{{order_number}} مستحقة بتاريخ {{due_date}}.`
      },

      'production_update': {
        name: 'production_update',
        subject: 'تحديث حالة الطلب #{{order_number}}',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>أخبار سارة {{customer_name}}!</h2>
            <p>{{item_description}} اكتملت مرحلة {{stage_name}}.</p>
            <p>المرحلة القادمة: {{next_stage}}</p>
            <p>رقم الطلب: {{order_number}}</p>
          </div>
        `,
        text: `أخبار سارة {{customer_name}}! {{item_description}} اكتمل مرحلة {{stage_name}}. المرحلة القادمة: {{next_stage}}.`
      },

      'welcome': {
        name: 'welcome',
        subject: 'أهلاً بيك في Azenith Living!',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>أهلاً بيك {{customer_name}}!</h2>
            <p>أنا {{agent_name}}، مساعدك الشخصي في Azenith Living.</p>
            <p>نحن متخصصون في تصنيع الأثاث حسب الطلب والتشطيبات الداخلية.</p>
            <p>ازاي أقدر أساعدك النهاردة؟</p>
            <hr>
            <p><a href="https://wa.me/201000000000">تواصل معنا على واتساب</a></p>
          </div>
        `,
        text: `أهلاً بيك {{customer_name}}! أنا {{agent_name}} مساعدك في Azenith Living. ازاي أقدر أساعدك النهاردة؟`
      }
    };

    return templates[name] || null;
  }

  /**
   * Send bulk emails
   */
  async sendBulk(
    emails: EmailMessage[],
    batchSize: number = 10,
    delayMs: number = 1000
  ): Promise<Array<{ success: boolean; messageId?: string; error?: string }>> {
    const results = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(e => this.send(e)));
      results.push(...batchResults);

      if (i + batchSize < emails.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Check if email service is available
   */
  isAvailable(): boolean {
    return this.initialized && this.transporter !== null;
  }
}

export const localEmail = new LocalEmailService();
