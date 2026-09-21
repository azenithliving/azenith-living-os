import "server-only";

import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isAuthorizedAdminEmail } from "@/lib/admin-access";

/**
 * Authorize browser requests with the Supabase session. The internal key is
 * intentionally accepted only for server-to-server callers and is never
 * exposed through NEXT_PUBLIC_* variables.
 */
export async function requireAdminApiAccess(request: NextRequest): Promise<{
  userId: string;
  email: string;
  via: "session" | "internal-key";
}> {
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  const presentedKey = request.headers.get("x-internal-key");
  if (internalKey && presentedKey && presentedKey === internalKey) {
    return { userId: "internal-service", email: "internal-service", via: "internal-key" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !isAuthorizedAdminEmail(user.email)) {
    throw new AdminApiAuthError("Unauthorized", 401);
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    via: "session",
  };
}

export class AdminApiAuthError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "AdminApiAuthError";
  }
}
