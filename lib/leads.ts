import "server-only";

import { z } from "zod";

import { classifyIntent } from "@/lib/conversion-engine";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getTenantByHost } from "@/lib/tenant";
import { processAutomation } from "@/lib/automation";
import { areaLabel } from "@/lib/regions";
import { storedTaste } from "@/lib/taste-words";
import { fireAndForget } from "@/lib/background-processor";

export const leadSubmissionSchema = z.object({
  sessionId: z.string().min(1),
  fullName: z.string().min(2),
  phone: z.string().min(8),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(1500).optional().or(z.literal("")),
  /** His area, tapped from the store's map or typed in his words. Optional: nobody is refused for it. */
  area: z.string().max(60).optional().or(z.literal("")),
  roomType: z.string().min(2),
  budget: z.string().min(2),
  /**
   * His taste, and allowed to be empty. A screen used to answer for him because this field refused
   * a blank — measured 2026-10-09: 14 of 27 rows held the page's own name where his style goes.
   */
  style: z.string().max(120).optional().or(z.literal("")),
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
  // His words when they are off the map, the map's spelling when they reach it — the same rule the
  // advisor's door and his sheet use, so «زايد» and «الشيخ زايد» are one area and not two silos.
  // An empty answer stays null: a blank in a column is not «he told us nothing» to the next reader.
  const area = areaLabel(payload.area) || null;
  // A page name, the store's own word for blank, or nothing at all — none of them are a taste,
  // and the taste column says nothing rather than filing the screen that asked.
  const style = storedTaste(payload.style, payload.lastPage);

  const { data: existingUser, error: existingUserError } = await supabase
    .from("users")
    .select("id,area,style")
    .eq("company_id", tenant.id)
    .eq("session_id", payload.sessionId)
    .maybeSingle<{ id: string; area: string | null; style: string | null }>();

  if (existingUserError) {
    throw new Error(`Failed to look up lead session: ${existingUserError.message}`);
  }

  const userId = existingUser?.id ?? crypto.randomUUID();

  if (!existingUser) {
    const { data: created, error: insertUserError } = await supabase.from("users").insert({
      id: userId,
      company_id: tenant.id,
      session_id: payload.sessionId,
      full_name: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      score: payload.score,
      intent,
      tier: intent,
      last_page: payload.lastPage,
      area,
      room_type: payload.roomType,
      budget: payload.budget,
      style,
      service_type: payload.serviceType,
    }).select("id,area,style").single<{ id: string; area: string | null; style: string | null }>();

    if (insertUserError) {
      throw new Error(`Failed to create user session: ${insertUserError.message}`);
    }
    console.log(
      `[Leads] ${payload.sessionId}: منطقة مطلوبة «${area ?? "مفيش"}» والمحفوظة «${created?.area ?? "مقراش"}»` +
        ` · طراز مطلوب «${style ?? "مفيش"}» والمحفوظ «${created?.style ?? "مقراش"}»`,
    );

    // Trigger automation for new lead - ASYNC (non-blocking)
    fireAndForget(
      () => processAutomation({
        type: "lead_created",
        leadId: userId,
        leadData: {
          score: payload.score,
          intent,
          roomType: payload.roomType,
          budget: payload.budget,
          style,
          serviceType: payload.serviceType,
          isDiamond: payload.score >= 60, // Flag for Diamond leads
        }
      }),
      (error) => console.error("[Leads] Automation error (new lead):", error)
    );
  } else {
    // Update existing user with new session data
    const patch: Record<string, unknown> = {
      full_name: payload.fullName,
      phone: payload.phone,
      email: payload.email,
      score: payload.score,
      intent,
      tier: intent,
      last_page: payload.lastPage,
      room_type: payload.roomType,
      budget: payload.budget,
      service_type: payload.serviceType,
    };
    // The area goes in once. A row that already knows where he lives is not asked to name it
    // again, and a second answer would silently rewrite the first rather than show both.
    if (area && !existingUser.area) patch.area = area;
    // His newest taste wins: a second brief is a newer answer, not a rival copy of the first.
    // What never goes in is an answer that is not a taste — that is exactly how a screen's own
    // name reached this column and became, on the owner's charts, the store's most popular style.
    if (style) patch.style = style;
    const { data: updated, error: updateUserError } = await supabase
      .from("users")
      .update(patch)
      .eq("id", userId)
      .select("id,area,style")
      .single<{ id: string; area: string | null; style: string | null }>();

    if (updateUserError) {
      throw new Error(`Failed to update user session: ${updateUserError.message}`);
    }
    console.log(
      `[Leads] ${payload.sessionId}: منطقة مطلوبة «${area ?? "مفيش"}» والمحفوظة «${updated?.area ?? "مقراش"}»` +
        ` · طراز مطلوب «${style ?? "مفيش"}» والمحفوظ «${updated?.style ?? "مفيش"}»${
        area && existingUser.area && existingUser.area !== area ? " — السطر كان يعرف منطقة قبل كده، فما اتغيرتش" : ""
      }${style && existingUser.style && existingUser.style !== style ? ` — كان مكتوب «${existingUser.style}»، بقى «${style}»` : ""}`,
    );

    // Trigger automation for updated lead - ASYNC (non-blocking)
    fireAndForget(
      () => processAutomation({
        type: "lead_updated",
        leadId: userId,
        leadData: {
          score: payload.score,
          intent,
          roomType: payload.roomType,
          budget: payload.budget,
          style,
          serviceType: payload.serviceType,
          isDiamond: payload.score >= 60, // Flag for Diamond leads
        }
      }),
      (error) => console.error("[Leads] Automation error (updated lead):", error)
    );
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
