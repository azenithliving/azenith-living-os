import "server-only";

import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/utils/supabase/server";

// Master admin domains - these bypass tenant isolation and see all data
const MASTER_DOMAINS = [
  "admin.azenithliving.com",
  "localhost:3000",
  "127.0.0.1:3000",
];

// Master admin emails from environment variable (comma-separated)
const getMasterAdminEmails = (): string[] => {
  const emails = process.env.MASTER_ADMIN_EMAILS || "";
  return emails.split(",").map(e => e.trim()).filter(Boolean);
};

export interface AdminContext {
  isMasterAdmin: boolean;
  currentTenantId: string | null;
  currentTenantName: string | null;
  userEmail: string | null;
}

/**
 * Detects if current user is a master admin based on domain OR identity
 */
export async function getAdminContext(): Promise<AdminContext> {
  // Get authenticated user from Supabase
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  const userEmail = user?.email || null;
  const masterEmails = getMasterAdminEmails();
  const isMasterByEmail = userEmail ? masterEmails.includes(userEmail) : false;

  // Get tenant info
  const tenant = await getCurrentTenant();
  
  if (!tenant) {
    // No tenant, but check if user is master by email
    return {
      isMasterAdmin: isMasterByEmail,
      currentTenantId: null,
      currentTenantName: null,
      userEmail,
    };
  }

  const isMasterByDomain = MASTER_DOMAINS.includes(tenant.domain);
  
  // Master if either by domain OR by email
  const isMasterAdmin = isMasterByDomain || isMasterByEmail;

  return {
    isMasterAdmin,
    currentTenantId: tenant.id,
    currentTenantName: tenant.name,
    userEmail,
  };
}

/**
 * Check if current session has master admin privileges
 */
export async function isMasterAdmin(): Promise<boolean> {
  const context = await getAdminContext();
  return context.isMasterAdmin;
}

/**
 * Require master admin access or throw error
 */
export async function requireMasterAdmin(): Promise<void> {
  if (!(await isMasterAdmin())) {
    throw new Error("Master admin access required");
  }
}
