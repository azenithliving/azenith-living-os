const fs = require('fs');

let code = fs.readFileSync('app/api/consultant/route.ts', 'utf8');

// Add language to interface ConsultantRequest
if (!code.includes('language?: string;')) {
  code = code.replace(
    /interface ConsultantRequest \{[\s\S]*?\}/,
    `interface ConsultantRequest {
  message: string;
  sessionId?: string;
  history?: Message[];
  userName?: string;
  userEmail?: string;
  language?: string;
}`
  );
}

// Destructure language
code = code.replace(
  /const \{ message, sessionId: providedSessionId, history = \[\], userName, userEmail \} = body;/,
  `const { message, sessionId: providedSessionId, history = [], userName, userEmail, language } = body;`
);

// Fallback reply
code = code.replace(
  /const fallbackReply = "أعتذر منك بشدة، أواجه ضغطاً كبيراً في الطلبات حالياً ولا يمكنني إكمال المحادثة بنفس الكفاءة\. هل يمكنك ترك رقم هاتفك هنا ليتصل بك كبير المهندسين في أسرع وقت لتلبية طلبك؟";/,
  `const fallbackReply = language === "en" 
    ? "I sincerely apologize, I am currently facing a high volume of requests and cannot continue the conversation efficiently. Could you please leave your phone number here so our senior engineer can contact you as soon as possible to fulfill your request?"
    : "أعتذر منك بشدة، أواجه ضغطاً كبيراً في الطلبات حالياً ولا يمكنني إكمال المحادثة بنفس الكفاءة. هل يمكنك ترك رقم هاتفك هنا ليتصل بك كبير المهندسين في أسرع وقت لتلبية طلبك؟";`
);

// buildGroqMessages signature
if (!code.includes('language?: string')) {
  code = code.replace(
    /function buildGroqMessages\(\n\s*history: Message\[\],\n\s*userName\?: string,\n\s*learnings: string\[\] = \[\],\n\s*insights: Insights = \{\},\n\s*mutations: any\[\] = \[\]\n\)\s*\{/,
    `function buildGroqMessages(
  history: Message[],
  userName?: string,
  learnings: string[] = [],
  insights: Insights = {},
  mutations: any[] = [],
  language?: string
) {`
  );

  // System prompt injection
  code = code.replace(
    /const systemPrompt = `/,
    `const langInstruction = language === "en" ? "\\n\\nCRITICAL RULE: You MUST reply in English exclusively." : "\\n\\nCRITICAL RULE: You MUST reply in Arabic exclusively.";\n  const systemPrompt = \`\${langInstruction}\n`
  );

  // Function call injection
  code = code.replace(
    /userName \|\| existingSession\?\.insights\?\.userName, \n\s*allLearnings, \n\s*existingSession\?\.insights,\n\s*mutations \|\| \[\]\n\s*\);/,
    `userName || existingSession?.insights?.userName, 
      allLearnings, 
      existingSession?.insights,
      mutations || [],
      language
    );`
  );
}

fs.writeFileSync('app/api/consultant/route.ts', code);
