const fs = require('fs');
let c = fs.readFileSync('app/api/consultant/route.ts', 'utf8');

c = c.replace(
  /const tRes = await fetch\(`https:\/\/api\.telegram\.org\/bot\$\{telegramToken\}\/sendMessage`, \{\n\s*method: 'POST',\n\s*headers: \{ 'Content-Type': 'application\/json' \},\n\s*body: JSON\.stringify\(\{ chat_id: telegramChatId, text: msg, parse_mode: 'Markdown' \}\),\n\s*\}\);/g,
  `const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const tRes = await fetch(\`https://api.telegram.org/bot\${telegramToken}/sendMessage\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramChatId, text: msg, parse_mode: 'Markdown' }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);`
);

c = c.replace(
  /await fetch\(`https:\/\/api\.telegram\.org\/bot\$\{telegramToken\}\/sendMessage`, \{\n\s*method: "POST",\n\s*headers: \{ "Content-Type": "application\/json" \},\n\s*body: JSON\.stringify\(\{ chat_id: telegramChatId, text: bookingMsg, parse_mode: "Markdown" \}\),\n\s*\}\);/g,
  `const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          await fetch(\`https://api.telegram.org/bot\${telegramToken}/sendMessage\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: telegramChatId, text: bookingMsg, parse_mode: "Markdown" }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);`
);

fs.writeFileSync('app/api/consultant/route.ts', c);
