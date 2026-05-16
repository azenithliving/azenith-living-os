const fs = require('fs');

const path = 'components/AzenithLegacy.tsx';
let code = fs.readFileSync(path, 'utf8');

// Replace the slides array definition
const newSlides = `export const slides = [
  {
    id: 1,
    video: \`\${BLOB_BASE}/hero-1.mp4\`,
    pillar: "HERITAGE",
    title: "إرث الخبرة في كل قطعة",
    poeticTitle: "إرث الخبرة في كل قطعة",
    poeticTitleEn: "Legacy of Expertise in Every Piece",
    description: "خبرة متوارثة منذ 1974 تتجسد في أثاث فاخر صُمم ليبقى، ويليق بمساحتك العربية الأصيلة.",
    descriptionEn: "Inherited expertise since 1974 embodied in luxury furniture designed to last, worthy of your authentic space.",
    cta: "اكتشف إرثنا",
    ctaEn: "Discover Our Legacy",
    ariaLabel: "إرث الخبرة في كل قطعة",
    ariaLabelEn: "Legacy of Expertise in Every Piece",
    stats: [
      { label: "الإرث", value: "منذ 1974", labelEn: "Legacy", valueEn: "Since 1974" },
      { label: "الهوية", value: "عربي أصيل", labelEn: "Identity", valueEn: "Authentic" },
      { label: "الوعد", value: "قطع تدوم", labelEn: "Promise", valueEn: "Enduring Pieces" },
    ],
  },
  {
    id: 2,
    video: \`\${BLOB_BASE}/hero-2.mp4\`,
    pillar: "COMMITMENT",
    title: "صلابة الخشب الطبيعي",
    poeticTitle: "صلابة الخشب الطبيعي",
    poeticTitleEn: "Solid Natural Wood",
    description: "خامات مختارة بعناية، تشطيبات دقيقة، والتزام يضمن أثاثًا يعمّر لسنوات طويلة.",
    descriptionEn: "Carefully selected materials, precise finishes, and a commitment ensuring long-lasting furniture.",
    cta: "تعرف على جودتنا",
    ctaEn: "Discover Our Quality",
    ariaLabel: "صلابة الخشب الطبيعي",
    ariaLabelEn: "Solid Natural Wood",
    stats: [
      { label: "الخامة", value: "خشب طبيعي", labelEn: "Material", valueEn: "Natural Wood" },
      { label: "التشطيب", value: "دقة يدوية", labelEn: "Finish", valueEn: "Handcrafted" },
      { label: "الضمان", value: "ثلاث سنوات", labelEn: "Warranty", valueEn: "3 Years" },
    ],
  },
  {
    id: 3,
    video: \`\${BLOB_BASE}/hero-3.mp4\`,
    pillar: "INNOVATION",
    title: "تصميم عصري مبتكر",
    poeticTitle: "تصميم عصري مبتكر",
    poeticTitleEn: "Innovative Modern Design",
    description: "رؤية حديثة تمزج بين الجمال والوظيفة لتمنحك مساحات راقية تناسب أسلوب حياتك.",
    descriptionEn: "A modern vision blending beauty and function for elegant spaces that fit your lifestyle.",
    cta: "ابدأ رحلة التصميم",
    ctaEn: "Start Design Journey",
    ariaLabel: "تصميم عصري مبتكر",
    ariaLabelEn: "Innovative Modern Design",
    stats: [
      { label: "الأسلوب", value: "مودرن راقٍ", labelEn: "Style", valueEn: "Refined Modern" },
      { label: "الوظيفة", value: "حلول ذكية", labelEn: "Function", valueEn: "Smart Solutions" },
      { label: "التجربة", value: "تفصيل مخصص", labelEn: "Experience", valueEn: "Custom Made" },
    ],
  },
  {
    id: 4,
    video: \`\${BLOB_BASE}/hero-4.mp4\`,
    pillar: "SYNERGY",
    title: "تحالف اليد والآلة",
    poeticTitle: "تحالف اليد والآلة",
    poeticTitleEn: "Synergy of Hand & Machine",
    description: "تقنيات تصنيع دقيقة ولمسات يدوية خبيرة تضمن تنفيذًا متوازنًا بين الفن والهندسة.",
    descriptionEn: "Precise manufacturing techniques and expert handmade touches ensure a balanced execution.",
    cta: "اكتشف طريقة التنفيذ",
    ctaEn: "Discover Our Process",
    ariaLabel: "تحالف اليد والآلة",
    ariaLabelEn: "Synergy of Hand & Machine",
    stats: [
      { label: "التصنيع", value: "رقمي دقيق", labelEn: "Manufacturing", valueEn: "Precise Digital" },
      { label: "الدمج", value: "يد + آلة", labelEn: "Fusion", valueEn: "Hand + Machine" },
      { label: "النتيجة", value: "دقة فاخرة", labelEn: "Result", valueEn: "Luxury Precision" },
    ],
  },
  {
    id: 5,
    video: \`\${BLOB_BASE}/hero-5.mp4\`,
    pillar: "TRUST",
    title: "ثقة في أرقى الوحدات",
    poeticTitle: "ثقة في أرقى الوحدات",
    poeticTitleEn: "Trust in Finest Units",
    description: "من مشروعات سكنية خاصة إلى مساحات عائلية راقية، نبني الثقة عبر الجودة والانضباط.",
    descriptionEn: "From private residential projects to elegant family spaces, we build trust through quality.",
    cta: "استكشف المساحات",
    ctaEn: "Explore Spaces",
    ariaLabel: "ثقة في أرقى الوحدات",
    ariaLabelEn: "Trust in Finest Units",
    stats: [
      { label: "العملاء", value: "سكني فاخر", labelEn: "Clients", valueEn: "Luxury Residential" },
      { label: "المعيار", value: "تنفيذ منضبط", labelEn: "Standard", valueEn: "Disciplined Execution" },
      { label: "الأثر", value: "ثقة مستمرة", labelEn: "Impact", valueEn: "Continuous Trust" },
    ],
  },
  {
    id: 6,
    video: \`\${BLOB_BASE}/hero-6.mp4\`,
    pillar: "QUALITY",
    title: "رفاهية مطلقة",
    poeticTitle: "رفاهية مطلقة",
    poeticTitleEn: "Absolute Luxury",
    description: "تفاصيل مريحة، خامات راقية، وتجربة استخدام تمنحك شعور الرفاهية كل يوم.",
    descriptionEn: "Comfortable details, premium materials, and a user experience that grants you luxury daily.",
    cta: "استكشف الجودة",
    ctaEn: "Explore Quality",
    ariaLabel: "رفاهية مطلقة",
    ariaLabelEn: "Absolute Luxury",
    stats: [
      { label: "الإحساس", value: "راحة كاملة", labelEn: "Feeling", valueEn: "Total Comfort" },
      { label: "الخامة", value: "لمسة فاخرة", labelEn: "Material", valueEn: "Luxury Touch" },
      { label: "الوعد", value: "رفاهية مطلقة", labelEn: "Promise", valueEn: "Absolute Luxury" },
    ],
  },
] as any; // Using any to bypass strict type checking temporarily if SlideStat doesn't have En fields
`;

code = code.replace(/export const slides = \[\s*\{[\s\S]*?\] as const;/g, newSlides);

fs.writeFileSync(path, code);
