"use server";

import { z } from "zod";
import { Resend } from "resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

const resend = new Resend(process.env.RESEND_API_KEY);

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
  source: z.string().optional().default("footer_elite_form"),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export type SubscribeResult =
  | { success: true; message: string }
  | { success: false; error: string };

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 5;

  const record = rateLimitMap.get(identifier);

  if (!record) {
    rateLimitMap.set(identifier, { count: 1, timestamp: now });
    return true;
  }

  if (now - record.timestamp > windowMs) {
    rateLimitMap.set(identifier, { count: 1, timestamp: now });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

export async function subscribeToNewsletter(
  formData: FormData
): Promise<SubscribeResult> {
  try {
    const email = formData.get("email") as string;
    const source = formData.get("source") as string | undefined;
    const utmSource = formData.get("utmSource") as string | undefined;
    const utmMedium = formData.get("utmMedium") as string | undefined;
    const utmCampaign = formData.get("utmCampaign") as string | undefined;

    if (!checkRateLimit(email.toLowerCase())) {
      return {
        success: false,
        error: "Too many attempts. Please try again in a minute.",
      };
    }

    const validationResult = emailSchema.safeParse({
      email,
      source,
      utmSource,
      utmMedium,
      utmCampaign,
    });

    if (!validationResult.success) {
      return {
        success: false,
        error: "Please enter a valid email address.",
      };
    }

    const validatedData = validationResult.data;
    const supabase = getSupabaseAdminClient();

    const { data: existingSubscriber } = await supabase
      .from("newsletter_subscribers")
      .select("id, status")
      .eq("email", validatedData.email.toLowerCase())
      .single();

    if (existingSubscriber) {
      if (existingSubscriber.status === "active") {
        return {
          success: false,
          error: "This email is already subscribed to our Elite Access list.",
        };
      } else {
        const { error: updateError } = await supabase
          .from("newsletter_subscribers")
          .update({
            status: "active",
            updated_at: new Date().toISOString(),
            metadata: {
              resubscribed_at: new Date().toISOString(),
              source: validatedData.source,
              utm_source: validatedData.utmSource,
              utm_medium: validatedData.utmMedium,
              utm_campaign: validatedData.utmCampaign,
            },
          })
          .eq("id", existingSubscriber.id);

        if (updateError) {
          console.error("Error updating subscriber:", updateError);
          return {
            success: false,
            error: "Failed to resubscribe. Please try again later.",
          };
        }

        await sendWelcomeEmail(validatedData.email);

        return {
          success: true,
          message: "Welcome back! Your subscription has been reactivated.",
        };
      }
    }

    const { error: insertError } = await supabase
      .from("newsletter_subscribers")
      .insert({
        email: validatedData.email.toLowerCase(),
        status: "active",
        metadata: {
          source: validatedData.source,
          subscribed_at: new Date().toISOString(),
          utm_source: validatedData.utmSource,
          utm_medium: validatedData.utmMedium,
          utm_campaign: validatedData.utmCampaign,
          user_agent: "server",
        },
      });

    if (insertError) {
      console.error("Error inserting subscriber:", insertError);
      return {
        success: false,
        error: "Failed to subscribe. Please try again later.",
      };
    }

    await sendWelcomeEmail(validatedData.email);

    return {
      success: true,
      message: "Welcome to Elite Access! Check your email for confirmation.",
    };
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return {
      success: false,
      error: "An unexpected error occurred. Please try again later.",
    };
  }
}

async function sendWelcomeEmail(email: string): Promise<void> {
  try {
    await resend.emails.send({
      from: "Azenith Living <noreply@azenithliving.com>",
      to: email,
      subject: "Welcome to Elite Access | Azenith Living",
      html: `
        <!DOCTYPE html>
        <html lang="en" dir="ltr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Elite Access</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
            body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #000000; }
            .container { max-width: 600px; margin: 0 auto; background-color: #000000; }
            .header { padding: 40px 30px; text-align: center; border-bottom: 1px solid #1A1A1A; }
            .logo { color: #C5A059; font-size: 24px; font-weight: 600; letter-spacing: 0.15em; }
            .content { padding: 50px 30px; color: #ffffff; }
            .title { font-size: 28px; font-weight: 300; margin-bottom: 20px; color: #ffffff; }
            .subtitle { font-size: 14px; color: #C5A059; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 30px; }
            .text { font-size: 16px; line-height: 1.7; color: #A0A0A0; margin-bottom: 20px; }
            .highlight { color: #C5A059; }
            .divider { height: 1px; background: linear-gradient(90deg, transparent, #C5A059, transparent); margin: 40px 0; }
            .benefits { margin: 30px 0; }
            .benefit { display: flex; align-items: flex-start; margin-bottom: 15px; }
            .benefit-icon { color: #C5A059; margin-right: 12px; font-size: 18px; }
            .benefit-text { color: #A0A0A0; font-size: 14px; }
            .cta-button { display: inline-block; padding: 16px 40px; background-color: transparent; border: 1px solid #C5A059; color: #C5A059; text-decoration: none; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 30px; transition: all 0.3s ease; }
            .footer { padding: 30px; text-align: center; border-top: 1px solid #1A1A1A; }
            .footer-text { font-size: 11px; color: #666666; letter-spacing: 0.1em; }
            .social-links { margin-top: 20px; }
            .social-link { display: inline-block; margin: 0 10px; color: #666666; text-decoration: none; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">AZENITH LIVING</div>
            </div>
            <div class="content">
              <div class="subtitle">Elite Access Membership</div>
              <h1 class="title">Welcome to the Inner Circle</h1>
              <p class="text">
                You've just unlocked <span class="highlight">exclusive access</span> to Azenith Living's most coveted interior design insights, early access to new collections, and private invitations to our signature events.
              </p>
              <div class="divider"></div>
              <div class="benefits">
                <div class="benefit">
                  <span class="benefit-icon">◆</span>
                  <span class="benefit-text">First access to new furniture collections and limited editions</span>
                </div>
                <div class="benefit">
                  <span class="benefit-icon">◆</span>
                  <span class="benefit-text">Exclusive design guides from our master craftsmen</span>
                </div>
                <div class="benefit">
                  <span class="benefit-icon">◆</span>
                  <span class="benefit-text">Priority booking for private consultations</span>
                </div>
                <div class="benefit">
                  <span class="benefit-icon">◆</span>
                  <span class="benefit-text">Members-only pricing and seasonal privileges</span>
                </div>
              </div>
              <center>
                <a href="https://azenithliving.com/rooms" class="cta-button">Explore Collections</a>
              </center>
            </div>
            <div class="footer">
              <p class="footer-text">
                © 2025 AZENITH LIVING. ALL RIGHTS RESERVED.<br>
                ALSALAM, CAIRO, EGYPT
              </p>
              <div class="social-links">
                <a href="https://www.instagram.com/alaa92aziz" class="social-link">Instagram</a>
                <a href="https://www.facebook.com/share/1bWWgfDTTk/" class="social-link">Facebook</a>
                <a href="https://t.me/azenith_living" class="social-link">Telegram</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
}
