import { supabaseService } from "@/lib/supabase-service";
import { UltimateAgent } from "@/lib/ultimate-agent/agent-core";

export async function POST(req: Request) {
  try {
    // تجاوز المصادقة: استخدام service role والحصول على أول مستخدم من جدول users
    const { data: users, error } = await supabaseService
      .from("users")
      .select("id")
      .limit(1);

    if (error || !users || users.length === 0) {
      console.error("No user found", error);
      return new Response("No user", { status: 500 });
    }

    const userId = users[0].id; // استخدام أول مستخدم في قاعدة البيانات

    const { message } = await req.json();
    const agent = new UltimateAgent();
    const reply = await agent.processCommand(message, userId);
    return Response.json({ reply });
  } catch (error) {
    console.error("API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
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
