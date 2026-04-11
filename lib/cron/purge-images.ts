"use server";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/**
 * Data Privacy & Purge System
 * Automatically deletes customer photos and sensitive data after 30 days of inactivity
 * GDPR-compliant data retention policy
 */

const RETENTION_DAYS = 30;
const BATCH_SIZE = 100;

export type PurgeResult = {
  deletedImages: number;
  anonymizedLeads: number;
  deletedEvents: number;
  errors: string[];
  timestamp: string;
};

/**
 * Main purge function - runs daily via cron
 */
export async function purgeOldCustomerData(): Promise<PurgeResult> {
  const supabase = getSupabaseAdminClient();
  const result: PurgeResult = {
    deletedImages: 0,
    anonymizedLeads: 0,
    deletedEvents: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  try {
    // Step 1: Find inactive users (no interaction in 30 days)
    const { data: inactiveUsers, error: usersError } = await supabase
      .from("users")
      .select("id, last_activity_at, created_at, full_name, phone, email")
      .lt("last_activity_at", cutoffDate.toISOString())
      .lt("created_at", cutoffDate.toISOString())
      .limit(BATCH_SIZE);

    if (usersError) {
      throw new Error(`Failed to fetch inactive users: ${usersError.message}`);
    }

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log("[Purge] No inactive users found for purging");
      return result;
    }

    const userIds = inactiveUsers.map((u) => u.id);

    // Step 2: Delete uploaded room photos from storage
    const { data: photoEvents, error: photosError } = await supabase
      .from("events")
      .select("id, metadata")
      .in("user_id", userIds)
      .eq("type", "image_upload")
      .lt("created_at", cutoffDate.toISOString());

    if (photosError) {
      result.errors.push(`Photo query error: ${photosError.message}`);
    } else if (photoEvents && photoEvents.length > 0) {
      // Delete from storage
      for (const event of photoEvents) {
        const paths = event.metadata?.storagePaths || [];
        if (Array.isArray(paths) && paths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from("customer-uploads")
            .remove(paths);

          if (storageError) {
            result.errors.push(`Storage delete error for ${event.id}: ${storageError.message}`);
          } else {
            result.deletedImages += paths.length;
          }
        }
      }
    }

    // Step 3: Anonymize lead personal data (keep analytics, remove PII)
    for (const user of inactiveUsers) {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          full_name: "[REDACTED]",
          phone: "[REDACTED]",
          email: user.email ? `[REDACTED-${user.id.slice(0, 8)}]@purged.local` : null,
          session_id: `[ANON-${user.id.slice(0, 8)}]`,
          // Keep: room_type, budget, style, score (for analytics)
        })
        .eq("id", user.id);

      if (updateError) {
        result.errors.push(`Anonymization error for ${user.id}: ${updateError.message}`);
      } else {
        result.anonymizedLeads++;
      }
    }

    // Step 4: Delete old high-granularity events (keep aggregated stats)
    const { error: deleteError, count } = await supabase
      .from("events")
      .delete({ count: "exact" })
      .in("user_id", userIds)
      .lt("created_at", cutoffDate.toISOString())
      .neq("type", "lead_converted") // Keep conversion events for attribution
      .neq("type", "purchase_completed"); // Keep purchase events

    if (deleteError) {
      result.errors.push(`Event deletion error: ${deleteError.message}`);
    } else {
      result.deletedEvents = count || 0;
    }

    // Step 5: Log purge operation
    await supabase.from("events").insert({
      id: crypto.randomUUID(),
      company_id: "system",
      user_id: "system",
      type: "data_purge_completed",
      value: result.deletedImages + result.anonymizedLeads,
      metadata: {
        ...result,
        retentionDays: RETENTION_DAYS,
        cutoffDate: cutoffDate.toISOString(),
      },
    });

    console.log(`[Purge] Completed: ${result.anonymizedLeads} users anonymized, ${result.deletedImages} images deleted`);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.errors.push(`Critical purge error: ${errorMsg}`);
    console.error("[Purge] Critical error:", error);
  }

  return result;
}

/**
 * Manual purge for specific user (GDPR right to erasure)
 */
export async function purgeSpecificUser(userId: string): Promise<PurgeResult> {
  const supabase = getSupabaseAdminClient();
  const result: PurgeResult = {
    deletedImages: 0,
    anonymizedLeads: 0,
    deletedEvents: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  try {
    // Delete all images
    const { data: uploads } = await supabase
      .from("events")
      .select("metadata")
      .eq("user_id", userId)
      .eq("type", "image_upload");

    if (uploads && uploads.length > 0) {
      for (const upload of uploads) {
        const paths = upload.metadata?.storagePaths || [];
        if (Array.isArray(paths) && paths.length > 0) {
          await supabase.storage.from("customer-uploads").remove(paths);
          result.deletedImages += paths.length;
        }
      }
    }

    // Anonymize user
    const { error: updateError } = await supabase
      .from("users")
      .update({
        full_name: "[GDPR-ERASED]",
        phone: "[GDPR-ERASED]",
        email: null,
        session_id: "[GDPR-ERASED]",
        special_requests: "[REDACTED]",
      })
      .eq("id", userId);

    if (updateError) {
      result.errors.push(updateError.message);
    } else {
      result.anonymizedLeads = 1;
    }

    // Delete events except conversion records
    const { error: deleteError } = await supabase
      .from("events")
      .delete()
      .eq("user_id", userId)
      .neq("type", "lead_converted")
      .neq("type", "purchase_completed");

    if (deleteError) {
      result.errors.push(deleteError.message);
    }

    // Log GDPR deletion
    await supabase.from("events").insert({
      id: crypto.randomUUID(),
      company_id: "system",
      user_id: "system",
      type: "gdpr_erasure_completed",
      value: 1,
      metadata: { targetUserId: userId, timestamp: result.timestamp },
    });

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Unknown error");
  }

  return result;
}

/**
 * Get purge statistics for admin dashboard
 */
export async function getPurgeStats(): Promise<{
  lastPurge: string | null;
  totalUsersAnonymized: number;
  totalImagesDeleted: number;
  pendingPurges: number;
}> {
  const supabase = getSupabaseAdminClient();

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const { data: pendingUsers, error: pendingError } = await supabase
    .from("users")
    .select("count", { count: "exact" })
    .lt("last_activity_at", cutoffDate.toISOString())
    .not("full_name", "eq", "[REDACTED]");

  const { data: purgeEvents, error: eventsError } = await supabase
    .from("events")
    .select("metadata, created_at")
    .eq("type", "data_purge_completed")
    .order("created_at", { ascending: false })
    .limit(1);

  if (eventsError || !purgeEvents || purgeEvents.length === 0) {
    return {
      lastPurge: null,
      totalUsersAnonymized: 0,
      totalImagesDeleted: 0,
      pendingPurges: pendingError ? 0 : (pendingUsers?.[0]?.count || 0),
    };
  }

  const lastPurge = purgeEvents[0];
  const metadata = lastPurge.metadata as Partial<PurgeResult> || {};

  return {
    lastPurge: lastPurge.created_at,
    totalUsersAnonymized: metadata.anonymizedLeads || 0,
    totalImagesDeleted: metadata.deletedImages || 0,
    pendingPurges: pendingError ? 0 : (pendingUsers?.[0]?.count || 0),
  };
}
