import type { Metadata } from "next";

export const SITE_URL = "https://azenith-living.vercel.app";
export const SITE_NAME = "Azenith Living";
export const BRAND_NAME_AR = "أزينث ليفينج";
export const BRAND_NAME_EN = "Azenith Living";
export const CONTACT_PHONE = "+201090819584";
export const CONTACT_EMAIL = "azenithliving@gmail.com";
export const BUSINESS_ADDRESS_AR = "السلام، القاهرة، مصر";

export const DEFAULT_SEO = {
  title: "أزينث ليفينج | تصميم داخلي فاخر وتشطيبات في مصر",
  description:
    "أزينث ليفينج تقدم تصميم داخلي فاخر، ديكور، تشطيبات، أثاث مخصص، غرف نوم، مطابخ، غرف معيشة، ودريسنج في القاهرة ومصر.",
  keywords: [
    "أزينث ليفينج",
    "Azenith Living",
    "تصميم داخلي في مصر",
    "تصميم داخلي فاخر",
    "ديكور فاخر",
    "تشطيبات شقق",
    "تشطيب فيلا",
    "أثاث مخصص",
    "غرف نوم مودرن",
    "مطابخ فاخرة",
    "دريسنج روم",
    "Interior Design Egypt",
    "Luxury Interior Design Cairo",
  ],
};

export const SEO_ROOMS: Record<string, { title: string; description: string; titleEn: string; priority: number }> = {
  "master-bedroom": { title: "غرف نوم رئيسية فاخرة في مصر", titleEn: "Luxury Master Bedrooms", description: "تصميم غرف نوم رئيسية فاخرة بتوزيع عملي، إضاءة هادئة، خامات راقية، وحلول تخزين مخصصة.", priority: 0.9 },
  "children-room": { title: "غرف أطفال آمنة ومبهجة", titleEn: "Children's Room Design", description: "تصميم غرف أطفال تجمع بين الأمان، المرح، التخزين الذكي، والألوان المتناسقة المناسبة للنمو.", priority: 0.84 },
  "teen-room": { title: "غرف مراهقين عملية وعصرية", titleEn: "Teen Room Design", description: "غرف مراهقين بمساحات للدراسة، النوم، التخزين، والتعبير الشخصي بتصميم عصري متوازن.", priority: 0.82 },
  "living-room": { title: "غرف معيشة وصالات استقبال فاخرة", titleEn: "Luxury Living Rooms", description: "تصميم غرف معيشة وصالات استقبال تجمع الراحة، الفخامة، توزيع الجلسات، ومعالجة الجدار الرئيسي.", priority: 0.92 },
  "dining-room": { title: "غرف طعام فاخرة", titleEn: "Luxury Dining Rooms", description: "تصميم غرف طعام فاخرة بطاولات مميزة، إضاءة دافئة، كراسي مريحة، وخزائن عرض أنيقة.", priority: 0.82 },
  "corner-sofa": { title: "كنب زاوية فاخر ومخصص", titleEn: "Luxury Corner Sofas", description: "كنب زاوية مودرن وكلاسيك بتصميم مخصص للمساحات الكبيرة والصغيرة مع خامات فاخرة.", priority: 0.78 },
  lounge: { title: "ركن لاونج واسترخاء فاخر", titleEn: "Luxury Lounge Design", description: "تصميم ركن لاونج للقراءة والاسترخاء بخامات ناعمة، إضاءة مريحة، وتفاصيل أنيقة.", priority: 0.76 },
  "dressing-room": { title: "دريسنج روم وخزائن ملابس فاخرة", titleEn: "Luxury Dressing Rooms", description: "تصميم دريسنج روم وخزائن ملابس بتقسيم داخلي ذكي، مرايا، إضاءة، واستغلال كامل للمساحة.", priority: 0.86 },
  kitchen: { title: "مطابخ فاخرة وعملية", titleEn: "Luxury Kitchen Design", description: "تصميم مطابخ فاخرة بتوزيع عملي، خامات مقاومة، تخزين ذكي، وإضاءة مناسبة لأسطح العمل.", priority: 0.88 },
  "home-office": { title: "مكاتب منزلية فاخرة", titleEn: "Luxury Home Offices", description: "تصميم مكاتب منزلية منتجة ومريحة بخلفيات نظيفة، تخزين عملي، وإضاءة مناسبة للعمل الطويل.", priority: 0.78 },
  "interior-design": { title: "تصميم داخلي شامل للمنازل والفيلات", titleEn: "Complete Interior Design", description: "خدمة تصميم داخلي شاملة للمنازل والفيلات من الفكرة والتوزيع حتى التشطيبات والأثاث.", priority: 0.94 },
  "guest-bedroom": { title: "غرف نوم ضيوف أنيقة", titleEn: "Guest Bedroom Design", description: "تصميم غرف نوم ضيوف مريحة وراقية بتفاصيل ترحيبية تناسب مختلف الأذواق.", priority: 0.74 },
  "study-room": { title: "غرف دراسة ومكتبات منزلية", titleEn: "Study Room Design", description: "تصميم غرف دراسة ومكتبات منزلية تساعد على التركيز والقراءة والعمل بهدوء.", priority: 0.72 },
  bathroom: { title: "حمامات فاخرة بتصميم سبا", titleEn: "Luxury Bathroom Design", description: "تصميم حمامات فاخرة بخامات راقية، مرايا مضاءة، توزيع عملي، وإحساس سبا يومي.", priority: 0.76 },
  "guest-bathroom": { title: "حمامات ضيوف أنيقة", titleEn: "Guest Bathroom Design", description: "تصميم حمامات ضيوف عملية وأنيقة تترك انطباعًا راقيًا في المساحات الصغيرة.", priority: 0.7 },
  "entrance-lobby": { title: "مداخل وفوييهات فاخرة", titleEn: "Luxury Entrance Lobby", description: "تصميم مداخل وفوييهات فاخرة تعكس أناقة المنزل من أول خطوة.", priority: 0.78 },
};

export const FURNITURE_SEO_TYPES: Record<string, { title: string; description: string; priority: number }> = {
  sofas: { title: "كنب فاخر حسب الغرفة", description: "كتالوج كنب فاخر للصالات، غرف النوم، المكاتب، وغرف الشباب مع خامات وتصميمات متعددة.", priority: 0.72 },
  "corner-sofas": { title: "كنب زاوية فاخر", description: "اختيارات كنب زاوية عملية وفاخرة للمساحات المفتوحة وغرف المعيشة الحديثة.", priority: 0.74 },
};

export type SeoLandingPage = {
  slug: string;
  title: string;
  description: string;
  focus: string;
  intent: string;
  sections: Array<{ heading: string; body: string }>;
  faqs: Array<{ question: string; answer: string }>;
  relatedRooms: string[];
  priority: number;
};

export const SEO_LANDING_PAGES: Record<string, SeoLandingPage> = {
  "interior-design-egypt": {
    slug: "interior-design-egypt",
    title: "تصميم داخلي في مصر للمنازل والفيلات",
    description: "خدمة تصميم داخلي في مصر تجمع بين التخطيط العملي، الفخامة الهادئة، اختيار الخامات، وتنسيق الأثاث لكل مساحة.",
    focus: "تصميم داخلي في مصر",
    intent: "باحث يريد شركة تصميم داخلي موثوقة للمنازل أو الفيلات داخل مصر.",
    sections: [
      { heading: "تصميم يبدأ من نمط الحياة", body: "في أزينث ليفينج لا نبدأ من شكل جميل فقط، بل من طريقة استخدامك اليومية للمساحة: الحركة، التخزين، الإضاءة، الضيافة، الأطفال، والعمل من المنزل." },
      { heading: "رؤية كاملة للمساحة", body: "نربط بين التصميم الداخلي، التشطيبات، الأثاث، الألوان، والخامات حتى يظهر المنزل كهوية واحدة لا كغرف منفصلة." },
      { heading: "مناسب للشقق والفيلات", body: "نخدم المساحات السكنية المختلفة في القاهرة ومصر، من شقة تحتاج إعادة توزيع إلى فيلا تحتاج لغة تصميم متكاملة." },
    ],
    faqs: [
      { question: "هل تقدم أزينث ليفينج تصميم داخلي فقط أم تنفيذ أيضًا؟", answer: "يمكن بدء العمل بتصور تصميمي واضح، ثم الانتقال إلى التجهيز أو التنفيذ حسب احتياج العميل ونطاق المشروع." },
      { question: "ما الذي يميز التصميم الداخلي الفاخر؟", answer: "الفخامة ليست سعر الخامة فقط؛ إنها توزيع مريح، إضاءة محسوبة، تفاصيل متناسقة، وخيارات تدوم بصريًا ووظيفيًا." },
    ],
    relatedRooms: ["interior-design", "living-room", "master-bedroom", "kitchen"],
    priority: 0.96,
  },
  "luxury-interior-design-cairo": {
    slug: "luxury-interior-design-cairo",
    title: "تصميم داخلي فاخر في القاهرة",
    description: "تصميم داخلي فاخر في القاهرة للمنازل الراقية، الشقق، والفيلات مع تجربة واضحة من الفكرة حتى طلب التنفيذ.",
    focus: "تصميم داخلي فاخر في القاهرة",
    intent: "عميل يبحث عن مستوى راق من التصميم الداخلي داخل القاهرة.",
    sections: [
      { heading: "فخامة هادئة قابلة للعيش", body: "نصمم مساحات راقية لا تبدو كصالة عرض جامدة، بل كمنزل مريح يحافظ على أناقته في الاستخدام اليومي." },
      { heading: "تناسق بين المواد والإضاءة", body: "الرخام، الخشب، القماش، المعادن، ودرجات الإضاءة يتم اختيارها كمنظومة واحدة تخدم الإحساس العام للمكان." },
      { heading: "تحويل البحث إلى قرار", body: "كل صفحة ومساحة داخل الموقع مصممة لتقود الزائر من الإلهام إلى اختيار المساحة ثم إرسال طلب واضح للفريق." },
    ],
    faqs: [
      { question: "هل التصميم الفاخر مناسب للمساحات الصغيرة؟", answer: "نعم. الفخامة في المساحة الصغيرة تعتمد على التوزيع الذكي، تقليل الضوضاء البصرية، واختيار خامات محسوبة." },
      { question: "هل يمكن البدء بغرفة واحدة؟", answer: "نعم، يمكن البدء بغرفة نوم، صالة، مطبخ، أو دريسنج ثم توسيع الهوية لباقي المنزل." },
    ],
    relatedRooms: ["living-room", "dressing-room", "entrance-lobby", "bathroom"],
    priority: 0.95,
  },
  "luxury-bedroom-design-cairo": {
    slug: "luxury-bedroom-design-cairo",
    title: "تصميم غرف نوم فاخرة في القاهرة",
    description: "تصميم غرف نوم رئيسية وضيوف بخامات راقية، إضاءة مريحة، تخزين ذكي، وتفاصيل فندقية تناسب القاهرة ومصر.",
    focus: "تصميم غرف نوم فاخرة",
    intent: "عميل يريد غرفة نوم مريحة وفاخرة بتصميم قابل للتنفيذ.",
    sections: [
      { heading: "راحة قبل الشكل", body: "غرفة النوم الناجحة تبدأ من الهدوء، الحركة السهلة، أماكن التخزين، ودرجة الإضاءة المناسبة لكل استخدام." },
      { heading: "تفاصيل فندقية في المنزل", body: "نوازن بين السرير، الخلفية، الكومود، الستائر، الأرضيات، والإضاءة لصنع تجربة نوم متماسكة." },
      { heading: "خامات تعيش طويلًا", body: "اختيار الخشب، الأقمشة، ودرجات اللون يتم وفق الاستخدام اليومي وليس الصورة الأولى فقط." },
    ],
    faqs: [
      { question: "ما أهم عنصر في تصميم غرفة النوم؟", answer: "التوزيع العملي حول السرير والتخزين والإضاءة هو الأساس، ثم تأتي الخامات والتفاصيل الجمالية." },
      { question: "هل يمكن دمج دريسنج مع غرفة النوم؟", answer: "نعم، ويمكن تصميم مسار واضح بين النوم، الملابس، والمرايا حتى تصبح التجربة اليومية أسهل." },
    ],
    relatedRooms: ["master-bedroom", "guest-bedroom", "dressing-room"],
    priority: 0.92,
  },
  "modern-kitchen-design-egypt": {
    slug: "modern-kitchen-design-egypt",
    title: "تصميم مطابخ مودرن في مصر",
    description: "مطابخ مودرن عملية وفاخرة بتخزين ذكي، خامات مقاومة، توزيع حركة مريح، وإضاءة مناسبة لأسطح العمل.",
    focus: "تصميم مطابخ مودرن",
    intent: "باحث يريد مطبخًا حديثًا عمليًا يناسب الاستخدام اليومي.",
    sections: [
      { heading: "المطبخ مساحة عمل يومية", body: "نبدأ من مثلث الحركة بين الحوض، الموقد، والثلاجة ثم نبني التخزين والإضاءة حوله." },
      { heading: "مظهر نظيف وسهل الصيانة", body: "المطبخ الفاخر يجب أن يبدو أنيقًا وأن يتحمل الاستخدام، لذلك نركز على خامات مقاومة وسهلة التنظيف." },
      { heading: "استغلال كامل للمساحة", body: "الارتفاعات، الزوايا، الوحدات المخفية، والإكسسوارات الداخلية تساعد على تقليل الفوضى وزيادة الكفاءة." },
    ],
    faqs: [
      { question: "هل المطبخ المودرن مناسب للمساحات الصغيرة؟", answer: "نعم، بل غالبًا يكون أفضل إذا تم استغلال التخزين الرأسي واختيار واجهات هادئة." },
      { question: "ما الفرق بين مطبخ جميل ومطبخ ناجح؟", answer: "المطبخ الناجح يجمع الجمال مع سهولة الحركة والتنظيف والتخزين اليومي." },
    ],
    relatedRooms: ["kitchen", "dining-room"],
    priority: 0.9,
  },
  "living-room-interior-egypt": {
    slug: "living-room-interior-egypt",
    title: "تصميم صالات وغرف معيشة في مصر",
    description: "تصميم غرف معيشة وصالات استقبال تجمع الراحة، استقبال الضيوف، الجدار الرئيسي، الإضاءة، وتوزيع الجلسات.",
    focus: "تصميم صالات وغرف معيشة",
    intent: "عميل يبحث عن صالة فاخرة ومريحة للعائلة والضيوف.",
    sections: [
      { heading: "الصالة هي واجهة البيت", body: "نصمم غرفة المعيشة لتخدم الاستقبال، الجلسات اليومية، التلفزيون، ومسارات الحركة بدون ازدحام." },
      { heading: "جدار رئيسي قوي", body: "معالجة الجدار الرئيسي، الإضاءة، والكنب تصنع نقطة جذب واضحة وتمنع التشتت البصري." },
      { heading: "راحة تناسب الاستخدام الحقيقي", body: "اختيار الكنب، الأقمشة، الطاولات، والسجاد يتم وفق عدد المستخدمين وطريقة المعيشة اليومية." },
    ],
    faqs: [
      { question: "هل يمكن تصميم صالة صغيرة بشكل فاخر؟", answer: "نعم، باستخدام أثاث مناسب للمقاس، لون هادئ، وتخزين مخفي أو قليل الظهور." },
      { question: "هل تقدمون أفكار كنب زاوية؟", answer: "نعم، كنب الزاوية من أهم حلول غرف المعيشة ويمكن تخصيصه حسب المساحة." },
    ],
    relatedRooms: ["living-room", "corner-sofa", "lounge"],
    priority: 0.9,
  },
  "dressing-room-design-cairo": {
    slug: "dressing-room-design-cairo",
    title: "تصميم دريسنج روم في القاهرة",
    description: "دريسنج روم فاخر بتقسيم داخلي ذكي، مرايا، إضاءة، وحدات تخزين عملية لغرف النوم الرئيسية.",
    focus: "تصميم دريسنج روم",
    intent: "عميل يريد تنظيم ملابس فاخر وعملي داخل غرفة النوم أو مساحة مستقلة.",
    sections: [
      { heading: "تنظيم يقلل الفوضى", body: "نقسم الملابس، الأحذية، الحقائب، الإكسسوارات، والمرايا بطريقة تجعل الاستخدام اليومي أسرع وأكثر راحة." },
      { heading: "إضاءة ومرايا محسوبة", body: "الإضاءة داخل الدريسنج ليست تفصيلة شكلية؛ هي عنصر أساسي لرؤية الألوان والخامات بوضوح." },
      { heading: "اندماج مع غرفة النوم", body: "يمكن ربط الدريسنج بغرفة النوم الرئيسية بلغة خامات واحدة حتى تصبح التجربة كاملة." },
    ],
    faqs: [
      { question: "ما أقل مساحة مناسبة للدريسنج؟", answer: "يمكن تنفيذ حلول دريسنج في مساحات صغيرة إذا تم استخدام وحدات رأسية وتقسيمات داخلية دقيقة." },
      { question: "هل الأفضل أبواب زجاج أم خشب؟", answer: "الاختيار يعتمد على مستوى الخصوصية، كمية الملابس، وأسلوب الغرفة العام." },
    ],
    relatedRooms: ["dressing-room", "master-bedroom"],
    priority: 0.88,
  },
  "villa-finishing-interior-design": {
    slug: "villa-finishing-interior-design",
    title: "تشطيب وتصميم داخلي للفيلات",
    description: "خدمة تصميم وتشطيب فيلات تربط بين توزيع المساحات، الخامات، الإضاءة، المداخل، غرف النوم، والصالات بهوية واحدة.",
    focus: "تشطيب وتصميم داخلي للفيلات",
    intent: "مالك فيلا يبحث عن رؤية تصميم شاملة قبل أو أثناء التشطيب.",
    sections: [
      { heading: "فيلا بهوية واحدة", body: "الفيلات تحتاج لغة تصميم تمتد من المدخل إلى الصالات وغرف النوم والحمامات دون تناقض بين المساحات." },
      { heading: "قرارات تشطيب مبكرة", body: "اختيار الأرضيات، الأسقف، أماكن الكهرباء، والإضاءة مبكرًا يقلل الهدر ويحسن النتيجة النهائية." },
      { heading: "توازن بين الفخامة والميزانية", body: "نحدد أولويات الإنفاق: أين يستحق الاستثمار، وأين يمكن الوصول لمظهر فاخر بتكلفة أذكى." },
    ],
    faqs: [
      { question: "متى يبدأ تصميم الفيلا؟", answer: "الأفضل أن يبدأ قبل التشطيب النهائي حتى تخدم الكهرباء، الإضاءة، والأسقف خطة التصميم." },
      { question: "هل يمكن تصميم الفيلا على مراحل؟", answer: "نعم، لكن يجب تثبيت الهوية والخامات الأساسية من البداية حتى لا تظهر المراحل منفصلة." },
    ],
    relatedRooms: ["interior-design", "entrance-lobby", "living-room", "master-bedroom"],
    priority: 0.93,
  },
  "custom-furniture-egypt": {
    slug: "custom-furniture-egypt",
    title: "أثاث مخصص فاخر في مصر",
    description: "أثاث مخصص للمنازل الراقية: كنب، أسرّة، وحدات تخزين، دريسنج، وطاولات تناسب المقاسات الفعلية والتصميم الداخلي.",
    focus: "أثاث مخصص فاخر",
    intent: "عميل يريد أثاثًا مصممًا حسب المساحة وليس قطعًا جاهزة فقط.",
    sections: [
      { heading: "الأثاث جزء من التصميم", body: "القطعة المناسبة لا تقاس بالشكل فقط، بل بحجم الغرفة، مسارات الحركة، لون الخامات، وطريقة الاستخدام." },
      { heading: "حلول للمقاسات الخاصة", body: "الأثاث المخصص يسمح باستغلال الزوايا، الجدران، والمساحات الصعبة بطريقة أكثر أناقة." },
      { heading: "تناسق مع كل غرفة", body: "نربط الأثاث بالمخطط العام للغرفة حتى يصبح جزءًا من الهوية وليس عنصرًا منفصلًا." },
    ],
    faqs: [
      { question: "هل الأثاث المخصص أفضل من الجاهز؟", answer: "في المساحات الدقيقة أو الفاخرة غالبًا نعم، لأنه يحل مشكلة المقاس والتناسق والاستخدام." },
      { question: "هل يمكن تصميم كنب حسب مساحة الصالة؟", answer: "نعم، خصوصًا كنب الزاوية وغرف المعيشة التي تحتاج توزيعًا محسوبًا." },
    ],
    relatedRooms: ["corner-sofa", "living-room", "dressing-room"],
    priority: 0.86,
  },
};

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}

export function buildPageMetadata({
  title,
  description,
  path = "/",
  keywords = [],
}: {
  title: string;
  description: string;
  path?: string;
  keywords?: string[];
}): Metadata {
  const url = absoluteUrl(path);

  return {
    title,
    description,
    keywords: [...DEFAULT_SEO.keywords, ...keywords],
    alternates: {
      canonical: url,
      languages: { ar: url, "en-US": url, "x-default": url },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "ar_EG",
      alternateLocale: ["en_US"],
      type: "website",
      images: [{ url: absoluteUrl("/logo.png"), width: 1200, height: 630, alt: `${BRAND_NAME_EN} luxury interior design` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl("/logo.png")],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export function getOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: BRAND_NAME_EN,
        alternateName: BRAND_NAME_AR,
        url: SITE_URL,
        logo: absoluteUrl("/logo.png"),
        email: CONTACT_EMAIL,
        telephone: CONTACT_PHONE,
      },
      {
        "@type": "LocalBusiness",
        "@id": `${SITE_URL}/#localbusiness`,
        name: `${BRAND_NAME_AR} | ${BRAND_NAME_EN}`,
        image: absoluteUrl("/logo.png"),
        url: SITE_URL,
        telephone: CONTACT_PHONE,
        email: CONTACT_EMAIL,
        priceRange: "$$$",
        address: {
          "@type": "PostalAddress",
          streetAddress: BUSINESS_ADDRESS_AR,
          addressLocality: "القاهرة",
          addressCountry: "EG",
        },
        areaServed: ["القاهرة", "مصر", "Cairo", "Egypt"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        alternateName: BRAND_NAME_AR,
        url: SITE_URL,
        inLanguage: ["ar-EG", "en-US"],
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Service",
        "@id": `${SITE_URL}/#interior-design-service`,
        name: "Luxury interior design and finishing",
        serviceType: "Interior design, finishing, furniture selection, and custom room design",
        provider: { "@id": `${SITE_URL}/#organization` },
        areaServed: ["Cairo", "Egypt"],
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name: "Azenith Living services",
          itemListElement: Object.values(SEO_ROOMS).map((room) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name: room.title, alternateName: room.titleEn, description: room.description },
          })),
        },
      },
    ],
  };
}
