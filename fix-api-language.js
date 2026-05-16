const fs = require('fs');

let code = fs.readFileSync('app/api/consultant/route.ts', 'utf8');

// Add language to ConsultantRequest interface
if (!code.includes('language?: string;')) {
  code = code.replace(
    /userEmail\?: string;\n\}/,
    'userEmail?: string;\n  language?: string;\n}'
  );
}

// Extract language from request
code = code.replace(
  /const \{ message, sessionId: providedSessionId, history = \[\], userName, userEmail \} = body;/,
  'const { message, sessionId: providedSessionId, history = [], userName, userEmail, language } = body;'
);

// Add language to buildGroqMessages signature if needed
if (!code.includes('language?: string')) {
  code = code.replace(
    /function buildGroqMessages\(\s*history: Message\[\],\s*userName\?: string,\s*learnings: string\[\] = \[\],\s*insights: Insights = \{\},\s*mutations: any\[\] = \[\]\s*\) \{/,
    'function buildGroqMessages(history: Message[], userName?: string, learnings: string[] = [], insights: Insights = {}, mutations: any[] = [], language?: string) {'
  );
  
  // Inject the language instruction into the system prompt inside buildGroqMessages
  code = code.replace(
    /const systemPrompt = `/,
    `const langInstruction = language === "en" ? "\\n\\nCRITICAL RULE: You MUST reply in English exclusively." : "\\n\\nCRITICAL RULE: You MUST reply in Arabic exclusively.";\n  const systemPrompt = \`\${langInstruction}\n`
  );
}

// Pass language to buildGroqMessages call
code = code.replace(
  /mutations \|\| \[\]\n    \);/,
  'mutations || [],\n      language\n    );'
);

fs.writeFileSync('app/api/consultant/route.ts', code);
