import { supabaseService } from "@/lib/supabase-service";
import { UltimateAgent } from "@/lib/ultimate-agent/agent-core";

export async function POST(req: Request) {
  try {
    const { data: users } = await supabaseService.from("users").select("id").limit(1);
    const userId = users?.[0]?.id;
    if (!userId) return new Response("No user", { status: 500 });
    
    const { message } = await req.json();
    const agent = new UltimateAgent();
    const reply = await agent.processCommand(message, userId);
    return Response.json({ reply });
  } catch (error) {
    return new Response("Error", { status: 500 });
  }
}

export async function GET() {
  return Response.json({ status: "ok" });
}
