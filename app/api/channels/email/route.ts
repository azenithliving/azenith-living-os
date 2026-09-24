/**
 * ────────────────────────────────────────────────────────────────────────────
 * API Route: /api/channels/email
 * ────────────────────────────────────────────────────────────────────────────
 * Phase 3: Task 8 – Email webhook endpoint (Resend)
 * 
 * POST: Email events webhook (sent, delivered, bounced, complained, opened, clicked)
 */

import { NextRequest, NextResponse } from "next/server";
import { createEmailAdapter } from "@/lib/vanguard/channels/email_adapter";
import { logger } from "@/lib/vanguard/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── POST: Email Events Webhook ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Resend webhook signature verification (optional - add if Resend supports it)
    // const signature = request.headers.get("resend-signature");
    
    logger.info("[Email Webhook] Event received", {
      type: body.type,
      emailId: body.data?.email_id,
    });

    const adapter = createEmailAdapter();
    const event = adapter.parseWebhookEvent(body);

    // Handle different email events
    switch (event.type) {
      case "email.sent":
        logger.debug("[Email Webhook] Email sent", {
          emailId: event.emailId,
          to: event.to,
        });
        // Update email status in database if needed
        break;

      case "email.delivered":
        logger.info("[Email Webhook] Email delivered", {
          emailId: event.emailId,
          to: event.to,
        });
        // Mark as delivered in tracking
        break;

      case "email.bounced":
        logger.warn("[Email Webhook] Email bounced", {
          emailId: event.emailId,
          to: event.to,
        });
        // Handle bounce - mark email as invalid, update lead status
        await handleBounce(event.emailId, event.to);
        break;

      case "email.complained":
        logger.warn("[Email Webhook] Spam complaint", {
          emailId: event.emailId,
          to: event.to,
        });
        // Handle complaint - unsubscribe user, flag for review
        await handleComplaint(event.emailId, event.to);
        break;

      case "email.opened":
        logger.debug("[Email Webhook] Email opened", {
          emailId: event.emailId,
          to: event.to,
        });
        // Track engagement - update lead score
        await handleEngagement(event.emailId, event.to, "opened");
        break;

      case "email.clicked":
        logger.info("[Email Webhook] Email link clicked", {
          emailId: event.emailId,
          to: event.to,
        });
        // Track high engagement - boost lead score significantly
        await handleEngagement(event.emailId, event.to, "clicked");
        break;

      default:
        logger.warn("[Email Webhook] Unknown event type", {
          type: event.type,
        });
    }

    return NextResponse.json({ status: "ok", received: true });
  } catch (error) {
    logger.error("[Email Webhook] Processing error", { error });
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// ── Helper: Handle Bounce ────────────────────────────────────────────────────

async function handleBounce(emailId: string, recipients: string[]): Promise<void> {
  try {
    const { createServiceRoleClient } = await import(
      "@/lib/vanguard/memory/supabase_persistence"
    );
    const supabase = createServiceRoleClient();

    for (const email of recipients) {
      // Mark email as bounced in leads table
      // First fetch current metadata
      const { data: lead } = await supabase
        .from("vanguard_leads")
        .select("metadata")
        .eq("session_id", email)
        .single();

      if (lead) {
        const updatedMetadata = {
          ...(lead.metadata || {}),
          email_bounced: true,
        };

        await supabase
          .from("vanguard_leads")
          .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", email)
          .single();
      }

      logger.info("[Email Webhook] Bounce handled", { email });
    }
  } catch (error) {
    logger.error("[Email Webhook] handleBounce error", { error });
  }
}

// ── Helper: Handle Complaint ─────────────────────────────────────────────────

async function handleComplaint(emailId: string, recipients: string[]): Promise<void> {
  try {
    const { createServiceRoleClient } = await import(
      "@/lib/vanguard/memory/supabase_persistence"
    );
    const supabase = createServiceRoleClient();

    for (const email of recipients) {
      // Add to suppression list (create table if needed)
      await supabase.from("vanguard_email_suppressions").insert({
        email,
        reason: "complaint",
        suppressed_at: new Date().toISOString(),
      });

      // Update lead metadata
      const { data: lead } = await supabase
        .from("vanguard_leads")
        .select("metadata")
        .eq("session_id", email)
        .single();

      if (lead) {
        const updatedMetadata = {
          ...(lead.metadata || {}),
          email_suppressed: true,
        };

        await supabase
          .from("vanguard_leads")
          .update({
            metadata: updatedMetadata,
            updated_at: new Date().toISOString(),
          })
          .eq("session_id", email)
          .single();
      }

      logger.warn("[Email Webhook] Complaint handled - email suppressed", { email });
    }
  } catch (error) {
    logger.error("[Email Webhook] handleComplaint error", { error });
  }
}

// ── Helper: Handle Engagement ────────────────────────────────────────────────

async function handleEngagement(
  emailId: string,
  recipients: string[],
  type: "opened" | "clicked"
): Promise<void> {
  try {
    const { createServiceRoleClient } = await import(
      "@/lib/vanguard/memory/supabase_persistence"
    );
    const supabase = createServiceRoleClient();

    const scoreBoost = type === "clicked" ? 10 : 5;

    for (const email of recipients) {
      // Update lead score
      await supabase.rpc("increment_lead_score", {
        p_session_id: email,
        p_score_delta: scoreBoost,
      });

      // Log engagement event
      await supabase.from("vanguard_email_engagement").insert({
        email_id: emailId,
        recipient: email,
        event_type: type,
        timestamp: new Date().toISOString(),
      });

      logger.debug("[Email Webhook] Engagement tracked", {
        email,
        type,
        scoreBoost,
      });
    }
  } catch (error) {
    logger.error("[Email Webhook] handleEngagement error", { error });
  }
}

// ── GET: Health Check ────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    service: "vanguard-email-webhook",
    status: "operational",
    version: "3.0.0",
    supportedEvents: [
      "email.sent",
      "email.delivered",
      "email.bounced",
      "email.complained",
      "email.opened",
      "email.clicked",
    ],
  });
}
