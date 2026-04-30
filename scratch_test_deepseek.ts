import { config } from "dotenv";
config({ path: ".env.local" });

async function testDeepSeek() {
  const keys = (process.env.DEEPSEEK_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
  console.log(`DeepSeek keys found: ${keys.length}`);
  
  const key = keys[0];
  const conversationHistory = [
    { role: "user", content: "الفرص" },
    { role: "assistant", content: "تم تحليل فرص الإيرادات بنجاح، وتم العثور على فرصة واحدة بقيمة 500$ من خلال AdSense." },
    { role: "user", content: "نفذ" }
  ];

  const historyContext = conversationHistory.slice(0, -1)
    .map(m => `${m.role === "user" ? "User" : "Agent"}: ${m.content}`)
    .join("\n");

  const userMessage = "نفذ";

  const prompt = `أنت مساعد ذكي احترافي لمنصة أزينث ليفينج. مهمتك تلبية طلب المستخدم أو الإجابة على سؤاله.

تاريخ المحادثة (User = المستخدم، Agent = أنت):
${historyContext}

الرسالة الجديدة: ${userMessage}

الأدوات المتاحة:
setupAdSense(accountId) - تفعيل AdSense

قواعد صارمة:
1. إذا قال المستخدم "نفذ" بعد أن ذكرت أداة أو فرصة في المحادثة، قم بتنفيذها مباشرة.
2. ردك حصرياً بهذا JSON:
{
  "thought": "تفكيرك الداخلي",
  "action": "final_answer أو اسم الأداة",
  "params": { "answer": "ردك إذا final_answer" }
}`;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: "json_object" }
    }),
  });

  console.log("Status:", response.status);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  console.log("Response:", content);
}

testDeepSeek();
