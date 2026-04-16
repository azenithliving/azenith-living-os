import { supabaseService } from "@/lib/supabase-service";
import { UltimateAgent } from "@/lib/ultimate-agent/agent-core";

export async function POST(req: Request) {
  try {
    // الحصول على أول مستخدم من قاعدة البيانات (تجاوز المصادقة)
    const { data: users, error } = await supabaseService
      .from("users")
      .select("id")
      .limit(1);

    if (error || !users || users.length === 0) {
      console.error("No user found", error);
      return new Response(JSON.stringify({ error: "No user available" }), { status: 500 });
    }

    const userId = users[0].id;
    const { message } = await req.json();
    const agent = new UltimateAgent();
    const reply = await agent.processCommand(message, userId);
    return Response.json({ reply });
  } catch (err: any) {
    console.error("API error:", err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), { status: 500 });
  }
}

// GET endpoint (للمؤشرات)
export async function GET(req: Request) {
  try {
    const { data: users, error } = await supabaseService
      .from("users")
      .select("id")
      .limit(1);
    if (error || !users) return new Response("Unauthorized", { status: 401 });
    return Response.json({ status: "ok" });
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
}
