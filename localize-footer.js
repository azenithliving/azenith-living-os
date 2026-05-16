const fs = require('fs');

const path = 'components/Footer.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Import useSessionStore
if (!code.includes('useSessionStore')) {
  code = code.replace(
    /import type \{ RuntimeConfig \} from "@\/lib\/runtime-config";/,
    'import type { RuntimeConfig } from "@/lib/runtime-config";\nimport useSessionStore from "@/stores/useSessionStore";'
  );
}

// 2. Add isRTL variable inside the component
if (!code.includes('const isRTL = currentLang === "ar";')) {
  code = code.replace(
    /export default function Footer\(\{ contactEmail, contactPhone, businessAddress \}: FooterProps\) \{/,
    `export default function Footer({ contactEmail, contactPhone, businessAddress }: FooterProps) {
  const currentLang = useSessionStore((state) => state.language);
  const isRTL = currentLang === "ar";`
  );
}

// 3. Translate hardcoded strings
code = code.replace(
  /toast\.error\("أدخل بريدك الإلكتروني أولًا\."\);/,
  'toast.error(isRTL ? "أدخل بريدك الإلكتروني أولًا." : "Please enter your email first.");'
);
code = code.replace(
  /toast\.error\("حدث خطأ غير متوقع\. حاول مرة أخرى\."\);/,
  'toast.error(isRTL ? "حدث خطأ غير متوقع. حاول مرة أخرى." : "An unexpected error occurred. Please try again.");'
);

code = code.replace(
  />\s*راحة وفخامة تدوم إلى الأبد\s*<\/p>/,
  '>{isRTL ? "راحة وفخامة تدوم إلى الأبد" : "Comfort and luxury that lasts forever"}</p>'
);

code = code.replace(
  />\s*الملاحة الذكية\s*<\/h4>/,
  '>{isRTL ? "الملاحة الذكية" : "Smart Navigation"}</h4>'
);

code = code.replace(
  /\{\s*label:\s*"قصة الإرث",\s*href:\s*"\/about"\s*\}/,
  '{ label: isRTL ? "قصة الإرث" : "Legacy Story", href: "/about" }'
);
code = code.replace(
  /\{\s*label:\s*"استكشف الوحدات",\s*href:\s*"\/rooms"\s*\}/,
  '{ label: isRTL ? "استكشف الوحدات" : "Explore Units", href: "/rooms" }'
);
code = code.replace(
  /\{\s*label:\s*"معرض الأثاث",\s*href:\s*"\/furniture"\s*\}/,
  '{ label: isRTL ? "معرض الأثاث" : "Furniture Gallery", href: "/furniture" }'
);
code = code.replace(
  /\{\s*label:\s*"ابدأ رحلتك",\s*href:\s*"\/start"\s*\}/,
  '{ label: isRTL ? "ابدأ رحلتك" : "Start Journey", href: "/start" }'
);

code = code.replace(
  />\s*تواصل مباشر\s*<\/h4>/,
  '>{isRTL ? "تواصل مباشر" : "Direct Contact"}</h4>'
);

code = code.replace(
  />البريد:<\/span>/,
  '>{isRTL ? "البريد:" : "Email:"}</span>'
);
code = code.replace(
  />الهاتف:<\/span>/,
  '>{isRTL ? "الهاتف:" : "Phone:"}</span>'
);
code = code.replace(
  />العنوان:<\/span>/,
  '>{isRTL ? "العنوان:" : "Address:"}</span>'
);

code = code.replace(
  />\s*قائمة النخبة\s*<\/h4>/,
  '>{isRTL ? "قائمة النخبة" : "Elite List"}</h4>'
);

code = code.replace(
  />\s*البريد الإلكتروني\s*<\/label>/,
  '>{isRTL ? "البريد الإلكتروني" : "Email Address"}</label>'
);

code = code.replace(
  /placeholder="أدخل بريدك الإلكتروني"/,
  'placeholder={isRTL ? "أدخل بريدك الإلكتروني" : "Enter your email"}'
);

code = code.replace(
  />\s*جارٍ الإرسال\.\.\.\s*<\/span>/,
  '>{isRTL ? "جارٍ الإرسال..." : "Sending..."}</span>'
);

code = code.replace(
  /انضم الآن/,
  '{isRTL ? "انضم الآن" : "Join Now"}'
);

fs.writeFileSync(path, code);
