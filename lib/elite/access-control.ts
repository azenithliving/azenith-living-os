/**
 * ELITE ACCESS CONTROL SYSTEM
 * Manages client access levels, permissions, and restrictions
 * 
 * CLASSIFICATION: ISOLATE
 * Elite-specific access control that operates independently
 * from the existing admin/user permission system.
 */

import { createClient } from "@/utils/supabase/server";
import { cache } from "react";

export type AccessLevel = "none" | "pending" | "active" | "premium" | "expired" | "suspended";

export type ClientAccessDetails = {
  id: string;
  phone: string;
  accessLevel: AccessLevel;
  expiresAt: Date | null;
  subscriptionActive: boolean;
  requestId: string | null;
  daysUntilExpiry: number | null;
};

export type PermissionSet = {
  canViewDashboard: boolean;
  canViewProgress: boolean;
  canMakePayments: boolean;
  canAccessDocuments: boolean;
  canScheduleMeetings: boolean;
  canAccessSupport: boolean;
  canViewHistory: boolean;
};

/**
 * Get client access details by phone or ID
 * Classification: ISOLATE - Elite-specific access lookup
 */
export const getClientAccess = cache(async (
  identifier: { phone?: string; id?: string }
): Promise<ClientAccessDetails | null> => {
  const supabase = await createClient();
  
  let query = supabase.from("client_access").select("*");
  
  if (identifier.id) {
    query = query.eq("id", identifier.id);
  } else if (identifier.phone) {
    query = query.eq("phone", identifier.phone.replace(/\D/g, ""));
  } else {
    return null;
  }
  
  const { data: access, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  
  if (error || !access) {
    return null;
  }
  
  const expiresAt = access.expires_at ? new Date(access.expires_at) : null;
  const daysUntilExpiry = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  
  return {
    id: access.id,
    phone: access.phone,
    accessLevel: access.access_status as AccessLevel,
    expiresAt,
    subscriptionActive: access.subscription_active,
    requestId: access.request_id,
    daysUntilExpiry,
  };
});

/**
 * Get permissions based on access level
 * Classification: ISOLATE - Elite-specific permission mapping
 */
export function getPermissions(accessLevel: AccessLevel): PermissionSet {
  const basePermissions: PermissionSet = {
    canViewDashboard: false,
    canViewProgress: false,
    canMakePayments: false,
    canAccessDocuments: false,
    canScheduleMeetings: false,
    canAccessSupport: false,
    canViewHistory: false,
  };
  
  switch (accessLevel) {
    case "active":
      return {
        ...basePermissions,
        canViewDashboard: true,
        canViewProgress: true,
        canAccessSupport: true,
      };
      
    case "premium":
      return {
        ...basePermissions,
        canViewDashboard: true,
        canViewProgress: true,
        canMakePayments: true,
        canAccessDocuments: true,
        canScheduleMeetings: true,
        canAccessSupport: true,
        canViewHistory: true,
      };
      
    case "pending":
      return {
        ...basePermissions,
        canViewDashboard: true,
        canAccessSupport: true,
      };
      
    case "expired":
    case "suspended":
      return {
        ...basePermissions,
        canAccessSupport: true,
      };
      
    default:
      return basePermissions;
  }
}

/**
 * Check if client has active access
 * Classification: ISOLATE - Elite-specific access validation
 */
export async function hasActiveAccess(clientAccessId: string): Promise<boolean> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("client_access")
    .select("access_status, expires_at")
    .eq("id", clientAccessId)
    .single();
  
  if (error || !data) {
    return false;
  }
  
  // Check status
  if (data.access_status !== "active" && data.access_status !== "premium") {
    return false;
  }
  
  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return false;
  }
  
  return true;
}

/**
 * Update client access status
 * Classification: ISOLATE - Elite-specific status management
 */
export async function updateAccessStatus(
  clientAccessId: string,
  status: AccessLevel,
  options?: { expiresAt?: Date; subscriptionActive?: boolean }
): Promise<boolean> {
  const supabase = await createClient();
  
  const updateData: Record<string, unknown> = {
    access_status: status,
    updated_at: new Date().toISOString(),
  };
  
  if (options?.expiresAt) {
    updateData.expires_at = options.expiresAt.toISOString();
  }
  
  if (options?.subscriptionActive !== undefined) {
    updateData.subscription_active = options.subscriptionActive;
  }
  
  const { error } = await supabase
    .from("client_access")
    .update(updateData)
    .eq("id", clientAccessId);
  
  return !error;
}

/**
 * Link client access to request
 * Classification: ISOLATE - Elite-specific request linking
 */
export async function linkClientToRequest(
  clientAccessId: string,
  requestId: string
): Promise<boolean> {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("client_access")
    .update({
      request_id: requestId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientAccessId);
  
  return !error;
}

/**
 * Get all active client accesses
 * Classification: ISOLATE - Elite-specific admin function
 */
export async function getAllActiveClients(): Promise<ClientAccessDetails[]> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("client_access")
    .select("*")
    .in("access_status", ["active", "premium"])
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
  
  if (error || !data) {
    return [];
  }
  
  return data.map((access) => ({
    id: access.id,
    phone: access.phone,
    accessLevel: access.access_status as AccessLevel,
    expiresAt: access.expires_at ? new Date(access.expires_at) : null,
    subscriptionActive: access.subscription_active,
    requestId: access.request_id,
    daysUntilExpiry: access.expires_at
      ? Math.ceil((new Date(access.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null,
  }));
}
