const fs = require('fs');
let c = fs.readFileSync('app/api/consultant/route.ts', 'utf8');
c = c.replace(
  /if \(!aiResult\.success\) \{[\s\S]*?status: 500[\s\S]*?\}\s*\)/,
  `if (!aiResult.success) {
      console.error("[Consultant] AI error:", aiResult.error);
      const fallbackReply = "أعتذر منك بشدة، أواجه ضغطاً كبيراً في الطلبات حالياً ولا يمكنني إكمال المحادثة بنفس الكفاءة. هل يمكنك ترك رقم هاتفك هنا ليتصل بك كبير المهندسين في أسرع وقت لتلبية طلبك؟";
      const assistantMessage = { role: "assistant", content: fallbackReply, timestamp: new Date().toISOString() };
      conversationHistory.push(assistantMessage);
      await saveSession(sessionId, conversationHistory, existingSession?.insights);
      return NextResponse.json({ reply: fallbackReply, sessionId });
    // `
);
// Fix the trailing brace issue from regex
c = c.replace(/return NextResponse\.json\(\{ reply: fallbackReply, sessionId \}\);\n    \/\/ \n\s*\}/, `return NextResponse.json({ reply: fallbackReply, sessionId });\n    }`);

fs.writeFileSync('app/api/consultant/route.ts', c);
