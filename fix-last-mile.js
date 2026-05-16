const fs = require('fs');

// 1. Fix app/api/consultant/route.ts (translate fallback message)
let apiRoute = fs.readFileSync('app/api/consultant/route.ts', 'utf8');

apiRoute = apiRoute.replace(
  /const fallbackReply = "أعتذر منك بشدة، أواجه ضغطاً كبيراً في الطلبات حالياً ولا يمكنني إكمال المحادثة بنفس الكفاءة\. هل يمكنك ترك رقم هاتفك هنا ليتصل بك كبير المهندسين في أسرع وقت لتلبية طلبك؟";/,
  `const fallbackReply = language === "en" 
    ? "I sincerely apologize, I am currently facing a high volume of requests and cannot continue the conversation efficiently. Could you please leave your phone number here so our senior engineer can contact you as soon as possible to fulfill your request?"
    : "أعتذر منك بشدة، أواجه ضغطاً كبيراً في الطلبات حالياً ولا يمكنني إكمال المحادثة بنفس الكفاءة. هل يمكنك ترك رقم هاتفك هنا ليتصل بك كبير المهندسين في أسرع وقت لتلبية طلبك؟";`
);

fs.writeFileSync('app/api/consultant/route.ts', apiRoute);

// 2. Fix home-page-client-fixed.tsx (add useSessionStore and isRTL support)
let homeClient = fs.readFileSync('components/home-page-client-fixed.tsx', 'utf8');

// Add import
if (!homeClient.includes('import useSessionStore')) {
  homeClient = homeClient.replace(
    /import \{ useSearchParams, useRouter \} from "next\/navigation";/,
    `import { useSearchParams, useRouter } from "next/navigation";\nimport useSessionStore from "@/stores/useSessionStore";`
  );
}

// Add isRTL definition inside component
if (!homeClient.includes('const isRTL = currentLang === "ar"')) {
  homeClient = homeClient.replace(
    /export default function HomePageClient\(\{(.*?)\}\) \{/,
    `export default function HomePageClient({$1}) {\n  const currentLang = useSessionStore((state) => state.language);\n  const isRTL = currentLang === "ar";`
  );
}

// Update roomList mapping
homeClient = homeClient.replace(
  /eyebrow: styleDesc\.eyebrow,\s*title: styleDesc\.title,\s*summary: styleDesc\.summary,/g,
  `eyebrow: isRTL ? styleDesc.eyebrow : (styleDesc.eyebrowEn || room.eyebrowEn || styleDesc.eyebrow),
          title: isRTL ? styleDesc.title : (styleDesc.titleEn || room.titleEn || styleDesc.title),
          summary: isRTL ? styleDesc.summary : (styleDesc.summaryEn || room.summaryEn || styleDesc.summary),`
);

homeClient = homeClient.replace(
  /return \{ \.\.\.room \};/g,
  `return { 
        ...room,
        eyebrow: isRTL ? room.eyebrow : (room.eyebrowEn || room.eyebrow),
        title: isRTL ? room.title : (room.titleEn || room.title),
        summary: isRTL ? room.summary : (room.summaryEn || room.summary),
      };`
);

// Update link href style parameter
homeClient = homeClient.replace(
  /href=\{`\/rooms\/\$\{room\.slug\}\?style=\$\{displayStyle\}`\}/g,
  `href={\`/rooms/\${room.slug}?style=\${displayStyle}\`}`
);

fs.writeFileSync('components/home-page-client-fixed.tsx', homeClient);
