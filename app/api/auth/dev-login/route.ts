import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

// ⚠️ DEVELOPER BACKDOOR - REMOVE BEFORE PRODUCTION
// This is a temporary workaround for local development
// when Google OAuth is not configured
const DEV_PASSWORD = process.env.DEV_BACKDOOR_PASSWORD || "azenith-dev-2024";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    // Validate dev password
    if (password !== DEV_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid developer password" },
        { status: 401 }
      );
    }

    // Only allow in development mode
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Developer backdoor disabled in production" },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdminClient();

    // Create or get dev user
    const devEmail = "dev@azenithliving.local";
    
    // Try to find existing dev user
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", devEmail)
      .maybeSingle();

    let userId: string;

    if (!existingUser) {
      // Get first company
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .limit(1)
        .single();

      if (!company) {
        return NextResponse.json(
          { error: "No company found in database" },
          { status: 500 }
        );
      }

      // Create dev user
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          email: devEmail,
          company_id: company.id,
          role: "master_admin",
          session_id: "dev-session",
          metadata: { is_dev_user: true }
        })
        .select("id")
        .single();

      if (createError || !newUser) {
        return NextResponse.json(
          { error: "Failed to create dev user" },
          { status: 500 }
        );
      }

      userId = newUser.id;
    } else {
      userId = existingUser.id;
    }

    // Create a session for the dev user
    const { data: session, error: sessionError } = await supabase.auth.admin.createUser({
      email: devEmail,
      email_confirm: true,
      user_metadata: { role: "master_admin", is_dev: true }
    });

    if (sessionError) {
      // Try to sign in as existing user
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: devEmail,
        password: DEV_PASSWORD
      });

      if (signInError) {
        return NextResponse.json(
          { error: "Failed to create dev session" },
          { status: 500 }
        );
      }

      return NextResponse.json({ 
        success: true,
        message: "Developer access granted",
        user: { email: devEmail, role: "master_admin" }
      });
    }

    return NextResponse.json({ 
      success: true,
      message: "Developer access granted",
      user: { email: devEmail, role: "master_admin" }
    });

  } catch (error) {
    console.error("Dev login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
