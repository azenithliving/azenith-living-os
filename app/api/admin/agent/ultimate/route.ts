import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { UltimateAgent } from "@/lib/ultimate-agent/agent-core";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies(); // ✅ مهم جداً: await في Next.js 16
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore setAll errors
            }
          },
        },
      }
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { message } = await req.json();
    const agent = new UltimateAgent();
    const reply = await agent.processCommand(message, user.id);
    return Response.json({ reply });
  } catch (error) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore setAll errors
            }
          },
        },
      }
    );
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
    
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    if (action === "approvals") {
      return Response.json([]);
    }
    return Response.json({ status: "ok" });
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
}
