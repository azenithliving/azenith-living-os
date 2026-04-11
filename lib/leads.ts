import "server-only";

import { z } from "zod";

import { classifyIntent } from "@/lib/conversion-engine";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTenantByHost } from "@/lib/tenant";
import { processAutomation } from "@/lib/automation";

export const leadSubmissionSchema = z.object({
  sessionId: z.string().min(1),
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(1500).optional().or(z.literal("")),
  roomType: z.string().min(2),
  budget: z.string().min(2),
  style: z.string().min(2),
  serviceType: z.string().min(2),
  score: z.number().min(0).default(0),
  intent: z.enum(["browsing", "interested", "buyer"]).optional(),
  lastPage: z.string().min(1).default("/request"),
});

export type LeadSubmission = z.infer<typeof leadSubmissionSchema>;

export type PersistLeadResult =
  | { ok: true; requestId: string; userId: string; companyId: string }
  | { ok: false; reason: "tenant_not_configured" | "database_unavailable"; host: string | null };

export async function persistLeadSubmission(payload: LeadSubmission, host: string | null): Promise<PersistLeadResult> {
  const tenant = await getTenantByHost(host);

  if (!tenant) {
    return { ok: false, reason: "tenant_not_configured", host };
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error("[leads] Supabase not available, cannot capture lead");
    return { ok: false, reason: "database_unavailable", host };
  }
  
  const intent = payload.intent ?? classifyIntent(payload.score);

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id")
    .eq("company_id", tenant.id)
    .eq("session_id", payload.sessionId)
    .maybeSingle<{ id: string }>();

  if (existingUserError) {
    throw new Error(`Failed to look up lead session: ${existingUserError.message}`);
  }

  const userId = existingUser?.id ?? crypto.randomUUID();

  if (!existingUser) {
    const { error: insertUserError } = await supabase.from("users").insert({
      id: userId,
      company_id: tenant.id,
      session_id: payload.sessionId,
      score: payload.score,
      intent,
      last_page: payload.lastPage,
      room_type: payload.roomType,
      budget: payload.budget,
      style: payload.style,
      service_type: payload.serviceType,
    });

    if (insertUserError) {
      throw new Error(`Failed to create user session: ${insertUserError.message}`);
    }

    // Trigger automation for new lead
    await processAutomation({
      type: "lead_created",
      leadId: userId,
      leadData: {
        score: payload.score,
        intent,
        roomType: payload.roomType,
        budget: payload.budget,
        style: payload.style,
        serviceType: payload.serviceType
      }
    });
  } else {
    // Update existing user with new session data
    const { error: updateUserError } = await supabase
      .from("users")
      .update({
        score: payload.score,
        intent,
        last_page: payload.lastPage,
        room_type: payload.roomType,
        budget: payload.budget,
        style: payload.style,
        service_type: payload.serviceType,
      })
      .eq("id", userId);

    if (updateUserError) {
      throw new Error(`Failed to update user session: ${updateUserError.message}`);
    }

    // Trigger automation for updated lead
    await processAutomation({
      type: "lead_updated",
      leadId: userId,
      leadData: {
        score: payload.score,
        intent,
        roomType: payload.roomType,
        budget: payload.budget,
        style: payload.style,
        serviceType: payload.serviceType
      }
    });
  }

  const requestId = crypto.randomUUID();
  const { error: requestError } = await supabase.from("requests").insert({
    id: requestId,
    company_id: tenant.id,
    user_id: userId,
    room_type: payload.roomType,
    budget: payload.budget,
    style: payload.style,
    service_type: payload.serviceType,
    status: "new",
    paid: false,
    quote_snapshot: {
      notes: payload.notes || null,
      contact: { fullName: payload.fullName, phone: payload.phone, email: payload.email || null },
      score: payload.score,
      intent,
    },
  });

  if (requestError) {
    throw new Error(`Failed to create request: ${requestError.message}`);
  }

  const { error: eventError } = await supabase.from("events").insert({
    id: crypto.randomUUID(),
    company_id: tenant.id,
    user_id: userId,
    type: "request_submit",
    value: payload.serviceType,
    metadata: {
      fullName: payload.fullName,
      phone: payload.phone,
      email: payload.email || null,
      roomType: payload.roomType,
      budget: payload.budget,
      style: payload.style,
      intent,
      lastPage: payload.lastPage,
    },
  });

  if (eventError) {
    throw new Error(`Failed to record request event: ${eventError.message}`);
  }

  return { ok: true, requestId, userId, companyId: tenant.id };
}
