import { UltimateAgent } from "@/lib/ultimate-agent/agent-core";

// معرف مستخدم ثابت (مؤقت) - استخدم أي ID موجود في جدول users لديك
// إذا لم يكن لديك أي مستخدم، سنستخدم هذا الـ ID كقيمة وهمية
const TEMP_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const agent = new UltimateAgent();
    // استخدام المعرف الثابت مؤقتاً
    const reply = await agent.processCommand(message, TEMP_USER_ID);
    return Response.json({ reply });
  } catch (error: any) {
    console.error("API error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), { status: 500 });
  }
}

export async function GET(req: Request) {
  return Response.json({ status: "ok" });
}
