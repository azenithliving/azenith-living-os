import nodemailer from 'nodemailer';

// Gmail credentials from environment
const GMAIL_USER = process.env.GMAIL_USER || 'azenithliving@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || 'mmnz nwhk itgo ayac';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const info = await transporter.sendMail({
      from: `"Azenith Living" <${GMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    return { success: false, error: String(error) };
  }
}

// Verify transporter connection
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('✅ Gmail SMTP connection verified');
    return true;
  } catch (error) {
    console.error('❌ Gmail SMTP connection failed:', error);
    return false;
  }
}
