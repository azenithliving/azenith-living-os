import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";
import { resolveRoomSlug } from "@/lib/rooms-catalog";
import { absoluteUrl, buildPageMetadata, SEO_ROOMS, SITE_NAME } from "@/lib/seo";

type RoomMeta = {
  id: string;
  title: string;
  titleEn: string;
  category: string;
  categoryEn: string;
  description: string;
  descriptionEn: string;
  query: string;
};

// Bilingual room metadata
const ROOMS: RoomMeta[] = [
  {
    id: "master-bedroom",
    title: "غرف النوم الرئيسية",
    titleEn: "Master Bedrooms",
    category: "خصوصية ملكية",
    categoryEn: "Royal Privacy",
    description: "ملاذ هادئ يجمع بين الفخامة الفندقية والراحة الشخصية بتفاصيل متقنة.",
    descriptionEn: "A serene sanctuary combining hotel luxury with personal comfort through meticulous details.",
    query: "luxury master bedroom suite hotel interior design",
  },
  {
    id: "children-room",
    title: "غرف الأطفال",
    titleEn: "Children's Rooms",
    category: "أحلام صغيرة",
    categoryEn: "Little Dreams",
    description: "مساحة آمنة ومبهجة تنمو مع طفلك، تجمع بين المرح والوظيفة.",
    descriptionEn: "A safe and joyful space that grows with your child, combining fun and functionality.",
    query: "luxury kids bedroom interior design playful elegant",
  },
  {
    id: "teen-room",
    title: "غرف المراهقين",
    titleEn: "Teen Rooms",
    category: "شخصية ناشئة",
    categoryEn: "Emerging Personality",
    description: "تصميم يناسب مرحلة النضج مع مساحات للدراسة والتعبير الذاتي.",
    descriptionEn: "Design suited for adolescence with spaces for study and self-expression.",
    query: "modern teenager bedroom study area contemporary design",
  },
  {
    id: "living-room",
    title: "غرف المعيشة",
    titleEn: "Living Rooms",
    category: "استقبال بثقة",
    categoryEn: "Confident Reception",
    description: "جلسات مدروسة بصريًا لاستقبال الضيوف ولحظات عائلية لا تُنسى.",
    descriptionEn: "Visually designed seating for welcoming guests and unforgettable family moments.",
    query: "luxury modern living room high-end interior design architectural digest lounge",
  },
  {
    id: "dining-room",
    title: "غرف الطعام",
    titleEn: "Dining Rooms",
    category: "ولائم عائلية",
    categoryEn: "Family Feasts",
    description: "تجارب طعام مريحة بأناقة دافئة تناسب كل مناسبة.",
    descriptionEn: "Comfortable dining experiences with warm elegance for every occasion.",
    query: "bespoke dining area luxury interior dining modern chandelier dining room",
  },
  {
    id: "corner-sofa",
    title: "الكنب الزاوية",
    titleEn: "Corner Sofas",
    category: "راحة مطلقة",
    categoryEn: "Absolute Comfort",
    description: "قطع مفروشات فاخرة تضيف لمسة عصرية ومساحة جلوس واسعة.",
    descriptionEn: "Luxury furniture pieces adding a modern touch with ample seating space.",
    query: "luxury corner sofa sectional living room high-end furniture",
  },
  {
    id: "lounge",
    title: "اللاونج",
    titleEn: "Lounges",
    category: "استرخاء أنيق",
    categoryEn: "Elegant Relaxation",
    description: "زاوية خاصة للاسترخاء والقراءة بلمسات أنيقة وخامات ناعمة.",
    descriptionEn: "A private corner for relaxation and reading with elegant touches and soft materials.",
    query: "luxury lounge seating area interior design modern elegant",
  },
  {
    id: "dressing-room",
    title: "غرف الملابس",
    titleEn: "Dressing Rooms",
    category: "تنظيم فاخر",
    categoryEn: "Luxury Organization",
    description: "تجربة ملابس يومية أنيقة بتقسيم ذكي وإضاءة مثالية.",
    descriptionEn: "An elegant daily dressing experience with smart division and perfect lighting.",
    query: "bespoke walk-in closet luxury dressing room interior",
  },
  {
    id: "kitchen",
    title: "المطابخ",
    titleEn: "Kitchens",
    category: "فن الطهي",
    categoryEn: "Culinary Art",
    description: "مساحة عمل أنيقة تجمع بين الوظيفة والجمال لتجربة طهي فاخرة.",
    descriptionEn: "An elegant workspace combining functionality and beauty for a luxurious cooking experience.",
    query: "luxury high-end kitchen marble bespoke interior design",
  },
  {
    id: "home-office",
    title: "المكاتب المنزلية",
    titleEn: "Home Offices",
    category: "إنتاجية متقنة",
    categoryEn: "Refined Productivity",
    description: "بيئة عمل محفزة تحافظ على التوازن بين المهنية والراحة المنزلية.",
    descriptionEn: "A stimulating work environment balancing professionalism with home comfort.",
    query: "luxury home office study room executive interior",
  },
  {
    id: "interior-design",
    title: "التصميم الداخلي الشامل",
    titleEn: "Comprehensive Interior Design",
    category: "رؤية متكاملة",
    categoryEn: "Integrated Vision",
    description: "تجربة تصميم متناسقة للمنزل بالكامل بلغة بصرية موحدة.",
    descriptionEn: "A harmonious design experience for the entire home with a unified visual language.",
    query: "luxury comprehensive interior design whole house architecture",
  },
  {
    id: "guest-bedroom",
    title: "غرف نوم الضيوف",
    titleEn: "Guest Bedrooms",
    category: "ضيافة أنيقة",
    categoryEn: "Elegant Hospitality",
    description: "راحة فاخرة لضيوفك مع تصميم دافئ يلائم كل الأذواق.",
    descriptionEn: "Luxury comfort for your guests with a warm design suitable for all tastes.",
    query: "luxury guest bedroom interior design cozy elegant",
  },
  {
    id: "study-room",
    title: "غرف الدراسة",
    titleEn: "Study Rooms",
    category: "تركيز وهدوء",
    categoryEn: "Focus & Calm",
    description: "بيئة مثالية للقراءة والتعلم بعيدًا عن المشتتات.",
    descriptionEn: "Ideal environment for reading and learning away from distractions.",
    query: "luxury study room interior design home library focus",
  },
  {
    id: "bathroom",
    title: "الحمامات",
    titleEn: "Bathrooms",
    category: "رفاهية يومية",
    categoryEn: "Daily Luxury",
    description: "تصميم حمامات فاخرة تجمع بين الوظيفة والاسترخاء.",
    descriptionEn: "Luxury bathroom designs combining functionality and relaxation.",
    query: "luxury bathroom interior design spa like marble",
  },
  {
    id: "guest-bathroom",
    title: "حمامات الضيوف",
    titleEn: "Guest Bathrooms",
    category: "ضيافة مثالية",
    categoryEn: "Perfect Hospitality",
    description: "أناقة عملية لحمام الضيوف مع لمسات فاخرة.",
    descriptionEn: "Practical elegance for guest bathrooms with luxury touches.",
    query: "luxury powder room guest bathroom interior design",
  },
  {
    id: "entrance-lobby",
    title: "المداخل",
    titleEn: "Entrances",
    category: "انطباع أول",
    categoryEn: "First Impression",
    description: "مدخل مهيب يعكس أناقة منزلك من أول خطوة.",
    descriptionEn: "A majestic entrance reflecting your home's elegance from the first step.",
    query: "luxury entrance lobby foyer interior design grand",
  },
];

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const STYLE_QUERY_HINTS: Record<string, string> = {
  modern: "modern minimal luxury",
  classic: "classic elegant luxury",
  industrial: "industrial loft luxury",
  scandinavian: "scandinavian cozy luxury",
};

/**
 * Deterministic seed generator for consistent image fetching per room+style
 */
function getDeterministicSeed(roomId: string, style: string): number {
  let hash = 0;
  const str = `${roomId}-${style}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 1000 + 1; // Page 1-1000
}

const ROOM_STYLE_DESCRIPTIONS: Record<string, Record<string, { category: string; categoryEn: string; description: string; descriptionEn: string }>> = {
  "master-bedroom": {
    modern: { category: "نقاء عصري", categoryEn: "Modern Purity", description: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي.", descriptionEn: "Clean lines and minimalist design that gives you modern serenity with hidden smart storage." },
    classic: { category: "فخامة ملكية", categoryEn: "Royal Luxury", description: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية.", descriptionEn: "Royal luxury and rich details that redefine classical elegance in every corner." },
    industrial: { category: "خامة أصيلة", categoryEn: "Authentic Texture", description: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء.", descriptionEn: "A serene space with hotel-like details and premium materials combining strength and warmth." },
    scandinavian: { category: "دفء شمالي", categoryEn: "Nordic Warmth", description: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق.", descriptionEn: "Calm colors and natural wood creating a sanctuary for rest and deep relaxation." },
  },
  "living-room": {
    modern: { category: "أناقة معاصرة", categoryEn: "Contemporary Elegance", description: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية.", descriptionEn: "Open design and clean lines combining simplicity with high functionality." },
    classic: { category: "عراقة وجمال", categoryEn: "Heritage & Beauty", description: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة.", descriptionEn: "Carved details and luxurious chandeliers giving the space a historic noble spirit." },
    industrial: { category: "روح المدينة", categoryEn: "Urban Spirit", description: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية.", descriptionEn: "Brick walls and high ceilings with bold metallic touches and strong personality." },
    scandinavian: { category: "بساطة شمالية", categoryEn: "Nordic Simplicity", description: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة.", descriptionEn: "Natural lighting and comfortable fabric making every relaxation moment a unique experience." },
  },
  "kitchen": {
    modern: { category: "أداء ذكي", categoryEn: "Smart Performance", description: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية.", descriptionEn: "Clean wooden surfaces and hidden appliances for an elegant and practical cooking space." },
    classic: { category: "تراث الطبخ", categoryEn: "Culinary Heritage", description: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي.", descriptionEn: "Carved wooden cabinets and marble floors reflecting traditional kitchen authenticity." },
    industrial: { category: "قوة الخامة", categoryEn: "Raw Power", description: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة.", descriptionEn: "Metallic surfaces and strong wooden touches for professional chefs and bold enthusiasts." },
    scandinavian: { category: "نقاء وضوء", categoryEn: "Purity & Light", description: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة.", descriptionEn: "Pure white and light wood with natural lighting providing energy and cleanliness." },
  },
  "dressing-room": {
    modern: { category: "تنظيم عصري", categoryEn: "Modern Organization", description: "أدراج مخفية وإضاءة LED ذكية لتجربة ملابس منظمة وهادئة.", descriptionEn: "Hidden drawers and smart LED lighting for an organized and calm dressing experience." },
    classic: { category: "خزائن ملكية", categoryEn: "Royal Wardrobes", description: "مرايا مزخرفة وخزائن خشبية ثقيلة بتفاصيل ذهبية راقية.", descriptionEn: "Decorated mirrors and heavy wooden cabinets with elegant golden details." },
    industrial: { category: "عرض جريء", categoryEn: "Bold Display", description: "أنابيب معدنية ورفوف خشبية لعرض الملابس بأسلوب لوفت عصري.", descriptionEn: "Metal pipes and wooden shelves for displaying clothes in a modern loft style." },
    scandinavian: { category: "بساطة عملية", categoryEn: "Practical Simplicity", description: "تنظيم واضح وإضاءة ناعمة مع خشب فاتح لراحة يومية.", descriptionEn: "Clear organization and soft lighting with light wood for daily comfort." },
  },
  "home-office": {
    modern: { category: "تركيز عصري", categoryEn: "Modern Focus", description: "خطوط نظيفة وتقنية متكاملة لبيئة عمل منتجة بدون تشويش.", descriptionEn: "Clean lines and integrated technology for a productive work environment without distractions." },
    classic: { category: "مكتب تنفيذي", categoryEn: "Executive Office", description: "خشب داكن وجلد فاخر يخلقان حضوراً مهنياً يليق بالقرارات الكبرى.", descriptionEn: "Dark wood and premium leather creating a professional presence worthy of major decisions." },
    industrial: { category: "إبداع صناعي", categoryEn: "Industrial Creativity", description: "جدران طوبية وطاولات معدنية لمساحة عمل ملهمة وقوية الشخصية.", descriptionEn: "Brick walls and metal desks for an inspiring workspace with strong personality." },
    scandinavian: { category: "توازن وهدوء", categoryEn: "Balance & Calm", description: "ضوء طبيعي ونباتات وألوان هادئة تدعم الإنتاجية والراحة النفسية.", descriptionEn: "Natural light, plants, and calm colors supporting productivity and mental well-being." },
  },
  "dining-room": {
    modern: { category: "تجمع عصري", categoryEn: "Modern Gathering", description: "طاولات نظيفة وإضاءة معمارية لجلسات طعام أنيقة وعصرية.", descriptionEn: "Clean tables and architectural lighting for elegant and modern dining sessions." },
    classic: { category: "ولائم تقليدية", categoryEn: "Traditional Feasts", description: "أثاث نقشي وثريات كريستال لجلسات عائلية ذات طابع تاريخي.", descriptionEn: "Carved furniture and crystal chandeliers for family sessions with historic character." },
    industrial: { category: "طعام بروح المدينة", categoryEn: "Urban Dining", description: "طاولات خشبية ثقيلة ولمسات معدنية لأجواء طعام جريئة.", descriptionEn: "Heavy wooden tables and metallic touches for bold dining atmospheres." },
    scandinavian: { category: "دفء المائدة", categoryEn: "Table Warmth", description: "خشب فاتح وإضاءة شمعدانية لجلسات طعام دافئة ومريحة.", descriptionEn: "Light wood and candle lighting for warm and comfortable dining sessions." },
  },
  "interior-design": {
    modern: { category: "رؤية متكاملة", categoryEn: "Integrated Vision", description: "تصميم مفتوح ومينيمال يربط كل مساحات المنزل بأناقة عصرية.", descriptionEn: "Open and minimal design connecting all home spaces with contemporary elegance." },
    classic: { category: "تراث متناسق", categoryEn: "Harmonious Heritage", description: "لغة تصميم موحدة تعكس الأصالة والفخامة في كل ركن من المنزل.", descriptionEn: "Unified design language reflecting authenticity and luxury in every corner of the home." },
    industrial: { category: "شخصية قوية", categoryEn: "Strong Character", description: "مزيج متناسق من الخامات الصناعية يخلق منزلاً بروح المدينة.", descriptionEn: "A harmonious blend of industrial materials creating a home with urban spirit." },
    scandinavian: { category: "نقاء متناغم", categoryEn: "Harmonious Purity", description: "تدفق طبيعي للضوء والهواء مع ألوان هادئة في كل مساحة.", descriptionEn: "Natural flow of light and air with calm colors in every space." },
  },
  "children-room": {
    modern: { category: "عالم ألوان", categoryEn: "Color World", description: "تصميم آمن ومبهج يناسب تطور طفلك مع ألوان متناسقة.", descriptionEn: "Safe and joyful design suited for your child's development with harmonious colors." },
    classic: { category: "أحلام دافئة", categoryEn: "Warm Dreams", description: "تفاصيل دافئة وخشب نقي لبيئة آمنة ومريحة.", descriptionEn: "Warm details and pure wood for a safe and comfortable environment." },
    industrial: { category: "مغامرة صغيرة", categoryEn: "Little Adventure", description: "لمسات معدنية وخشبية تناسب روح المغامرة لدى الأطفال.", descriptionEn: "Metallic and wooden touches matching the adventurous spirit of children." },
    scandinavian: { category: "نقاء ومرح", categoryEn: "Purity & Play", description: "ألوان هادئة ومساحات آمنة للعب والنمو.", descriptionEn: "Calm colors and safe spaces for play and growth." },
  },
  "teen-room": {
    modern: { category: "استقلالية عصرية", categoryEn: "Modern Independence", description: "مساحة متكاملة للدراسة والاسترخاء بتصميم عصري.", descriptionEn: "Integrated space for study and relaxation with contemporary design." },
    classic: { category: "أناقة ناشئة", categoryEn: "Emerging Elegance", description: "خشب داكن وتفاصيل راقية تناسب مرحلة النضج.", descriptionEn: "Dark wood and refined details suited for the maturity phase." },
    industrial: { category: "شخصية جريئة", categoryEn: "Bold Personality", description: "لمسات معدنية وخشب خام تعبر عن الاستقلالية.", descriptionEn: "Metallic touches and raw wood expressing independence." },
    scandinavian: { category: "تركيز وهدوء", categoryEn: "Focus & Calm", description: "إضاءة طبيعية وتنظيم واضح للدراسة والراحة.", descriptionEn: "Natural lighting and clear organization for study and rest." },
  },
  "corner-sofa": {
    modern: { category: "أناقة عملية", categoryEn: "Practical Elegance", description: "تصميم عصري يوفر مساحة جلوس واسعة بأناقة.", descriptionEn: "Modern design providing ample seating space with elegance." },
    classic: { category: "فخامة تقليدية", categoryEn: "Traditional Luxury", description: "خامات فاخرة وتفاصيل نقشية لجلسات راقية.", descriptionEn: "Premium materials and carved details for refined seating sessions." },
    industrial: { category: "خامة أصيلة", categoryEn: "Authentic Texture", description: "جلد طبيعي وهيكل معدني لمساحة جريئة.", descriptionEn: "Natural leather and metal frame for a bold space." },
    scandinavian: { category: "راحة شمالية", categoryEn: "Nordic Comfort", description: "قماش ناعم وألوان فاتحة لراحة مطلقة.", descriptionEn: "Soft fabric and light colors for absolute comfort." },
  },
  "lounge": {
    modern: { category: "زاوية هادئة", categoryEn: "Quiet Corner", description: "مساحة استرخاء عصرية بتصميم مينيمال أنيق.", descriptionEn: "Contemporary relaxation space with elegant minimalist design." },
    classic: { category: "أناقة قراءة", categoryEn: "Reading Elegance", description: "كرسي استرخاء فاخر وإضاءة دافئة للقراءة.", descriptionEn: "Luxury relaxation chair and warm lighting for reading." },
    industrial: { category: "استرخاء صناعي", categoryEn: "Industrial Relaxation", description: "كرسي جلد وطاولة خشبية خام لزاوية مميزة.", descriptionEn: "Leather chair and raw wooden table for a distinctive corner." },
    scandinavian: { category: "دفء وقراءة", categoryEn: "Warmth & Reading", description: "كرسي ناعم وإضاءة طبيعية لزاوية قراءة مريحة.", descriptionEn: "Soft chair and natural lighting for a comfortable reading corner." },
  },
  "guest-bedroom": {
    modern: { category: "ضيافة عصرية", categoryEn: "Modern Hospitality", description: "تصميم فندقي مريح بألوان هادئة وإضاءة دافئة ترحب بضيوفك.", descriptionEn: "Comfortable hotel design with calm colors and warm lighting welcoming your guests." },
    classic: { category: "فخامة الأصالة", categoryEn: "Heritage Luxury", description: "سرير فخم ومفارش حريرية تمنح ضيوفك تجربة إقامة ملكية.", descriptionEn: "Luxurious bed and silk linens giving your guests a royal stay experience." },
    industrial: { category: "لمسة عصرية", categoryEn: "Urban Touch", description: "تفاصيل معدنية وألوان دافئة لجلسة ضيوف مريحة وغير تقليدية.", descriptionEn: "Metal details and warm colors for a comfortable, unconventional guest stay." },
    scandinavian: { category: "هدوء الاسكندنافي", categoryEn: "Nordic Serenity", description: "ألوان فاتحة وأنسجة قطنية طبيعية تشعر ضيفك بالراحة المنزلية.", descriptionEn: "Light colors and natural cotton fabrics making your guest feel right at home." },
  },
  "study-room": {
    modern: { category: "تركيز معماري", categoryEn: "Architectural Focus", description: "إضاءة صحية ومكتب متكامل لعمل ذكي وقراءة عميقة.", descriptionEn: "Healthy lighting and integrated desk for smart working and deep reading." },
    classic: { category: "مكتبة الفكر", categoryEn: "Intellectual Library", description: "خزائن كتب جدارية من الخشب الصافي وتفاصيل راقية تعين على الابتكار.", descriptionEn: "Solid wood wall bookcases and refined details aiding innovation." },
    industrial: { category: "إنتاجية خام", categoryEn: "Raw Productivity", description: "طاولات معدنية وأرفف مفتوحة لبيئة دراسية محفزة للإبداع.", descriptionEn: "Metal desks and open shelves for a study environment inspiring creativity." },
    scandinavian: { category: "هدوء وتفكير", categoryEn: "Calm Thinking", description: "إضاءة ناعمة ونباتات طبيعية تجعل الدراسة وقتًا ممتعًا.", descriptionEn: "Soft lighting and natural plants making study time enjoyable." },
  },
  bathroom: {
    modern: { category: "سبا مودرن", categoryEn: "Modern Spa", description: "تكسيات رخامية ومرايا مضاءة تحول حمامك إلى سبا شخصي.", descriptionEn: "Marble cladding and illuminated mirrors turning your bathroom into a personal spa." },
    classic: { category: "رخام ملكي", categoryEn: "Royal Marble", description: "رخام إيطالي وخلاطات ذهبية تعيد تعريف الفخامة في الاستحمام.", descriptionEn: "Italian marble and golden faucets redefining bathing luxury." },
    industrial: { category: "تصميم حجري", categoryEn: "Stone Design", description: "خرسانة مصقولة وتكسيات داكنة لأجواء استحمام عصرية جريئة.", descriptionEn: "Polished concrete and dark cladding for a bold modern bathing ambiance." },
    scandinavian: { category: "نقاء الانتعاش", categoryEn: "Refreshing Purity", description: "سيراميك أبيض وأخشاب طبيعية مقاومة للمياه للانتعاش اليومي.", descriptionEn: "White ceramic and water-resistant natural wood for daily freshness." },
  },
  "guest-bathroom": {
    modern: { category: "أناقة مدمجة", categoryEn: "Compact Elegance", description: "حوض رخام فاخر وإضاءة مخفية تترك انطباعًا متميزًا لدى الضيوف.", descriptionEn: "Luxury marble basin and hidden lighting leaving a distinct impression on guests." },
    classic: { category: "ضيافة كلاسيكية", categoryEn: "Classic Hospitality", description: "تفاصيل ذهبية ومرايا مزخرفة تعكس كرم الضيافة في المساحات الصغرى.", descriptionEn: "Gold details and ornate mirrors reflecting hospitality in small spaces." },
    industrial: { category: "جرأة التصميم", categoryEn: "Bold Design", description: "لمسات معدنية وأحواض حجرية فريدة تعطي طابعًا استثنائيًا.", descriptionEn: "Metal accents and unique stone basins providing an exceptional character." },
    scandinavian: { category: "بساطة ناصعة", categoryEn: "Pure Simplicity", description: "ألوان فاتحة ونباتات صغيرة تجعل حمام الضيوف أنيقًا ومنتعشًا.", descriptionEn: "Light colors and small plants making the guest bathroom elegant and fresh." },
  },
  "entrance-lobby": {
    modern: { category: "مدخل مهيب", categoryEn: "Majestic Foyer", description: "مرايا عملاقة وطاولة كونسول رخام لاستقبال ينبض بالأناقة.", descriptionEn: "Giant mirrors and a marble console table for a reception pulsing with elegance." },
    classic: { category: "انطباع ملوك", categoryEn: "Royal Impression", description: "ثريا كريستال وأرضيات تطعيم رخامي تعبر عن فخامة بيتك.", descriptionEn: "Crystal chandelier and marble inlay floors expressing your home's luxury." },
    industrial: { category: "حضور مميز", categoryEn: "Distinct Presence", description: "إضاءة معلقة وهياكل معدنية سوداء لمدخل عصري جريء.", descriptionEn: "Pendant lighting and black metal structures for a bold modern entry." },
    scandinavian: { category: "ترحيب دافئ", categoryEn: "Warm Welcome", description: "إضاءة ناعمة وخشب فاتح يمنح الزوار شعورًا بالراحة والدفء فورًا.", descriptionEn: "Soft lighting and light wood giving visitors an instant sense of warmth." },
  },
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = resolveRoomSlug(rawSlug);
  const roomSeo = SEO_ROOMS[slug];

  if (!roomSeo) {
    return {
      title: "صفحة غير موجودة",
      robots: { index: false, follow: false },
    };
  }

  return buildPageMetadata({
    title: roomSeo.title,
    description: roomSeo.description,
    path: `/rooms/${slug}`,
    keywords: [roomSeo.title, roomSeo.titleEn, "تصميم غرف", "Interior design"],
  });
}

async function fetchRoomPhotos(query: string, style: string, roomId: string) {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const styleHint = STYLE_QUERY_HINTS[style] || style;
  const fullQuery = `${styleHint} luxury interior design ${query}`;
  const deterministicPage = getDeterministicSeed(roomId, style);
  const url = `${protocol}://${host}/api/pexels?query=${encodeURIComponent(fullQuery)}&per_page=50&page=${deterministicPage}&room=${encodeURIComponent(roomId)}&style=${encodeURIComponent(style)}`;

  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json().catch(() => null);
    return Array.isArray(data?.photos) ? data.photos : [];
  } catch {
    return [];
  }
}

export default async function Page({ params, searchParams }: PageProps) {
  const { slug: rawSlug } = await params;
  const slug = resolveRoomSlug(rawSlug);
  const room = ROOMS.find((item) => item.id === slug);
  const roomSeo = SEO_ROOMS[slug];

  if (!room) {
    notFound();
  }

  const paramsObj = await searchParams;
  const style = typeof paramsObj.style === "string" ? paramsObj.style : "modern";
  const photos = await fetchRoomPhotos(room.query, style, slug);
  const styleDesc = ROOM_STYLE_DESCRIPTIONS[slug]?.[style];
  const seoTitle = roomSeo?.title ?? room.titleEn;
  const seoDescription = roomSeo?.description ?? room.descriptionEn;
  const roomUrl = absoluteUrl(`/rooms/${slug}`);
  const roomFaqs = [
    {
      question: `ما الذي تقدمه ${SITE_NAME} في ${seoTitle}؟`,
      answer: `${SITE_NAME} تقدم رؤية تصميم متكاملة تشمل توزيع المساحة، اختيار الخامات، الإضاءة، الأثاث، وحلول التخزين بما يناسب الاستخدام اليومي والطابع الفاخر للمنزل.`,
    },
    {
      question: `هل يمكن تخصيص تصميم ${seoTitle} حسب مساحة المنزل؟`,
      answer: "نعم، يتم التعامل مع كل مشروع حسب المقاسات الفعلية، أسلوب الحياة، الميزانية، وطريقة استخدام الغرفة حتى تكون النتيجة عملية وراقية في نفس الوقت.",
    },
    {
      question: "هل الخدمة مناسبة للشقق والفيلات في مصر؟",
      answer: "نعم، صفحات أزينث ليفينج مهيأة لخدمات التصميم الداخلي والتشطيبات والأثاث المخصص للشقق والفيلات داخل القاهرة ومصر.",
    },
  ];
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Service",
      "@id": `${roomUrl}#service`,
      name: seoTitle,
      alternateName: roomSeo?.titleEn ?? room.titleEn,
      description: seoDescription,
      provider: { "@id": `${absoluteUrl("/")}#organization` },
      areaServed: ["Cairo", "Egypt"],
      serviceType: "Interior design and custom furniture",
      url: roomUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "@id": `${roomUrl}#faq`,
      mainEntity: roomFaqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "@id": `${roomUrl}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Rooms", item: absoluteUrl("/rooms") },
        { "@type": "ListItem", position: 3, name: seoTitle, item: roomUrl },
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl space-y-14">
          <RoomPageClient
            room={room}
            initialPhotos={photos}
            styleDesc={styleDesc}
          />
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10" dir="rtl" aria-labelledby="room-seo-heading">
            <div className="max-w-4xl space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-primary/80">
                Azenith Living SEO Guide
              </p>
              <h2 id="room-seo-heading" className="font-serif text-3xl leading-tight text-white md:text-5xl">
                {seoTitle}
              </h2>
              <p className="text-base leading-8 text-white/72 md:text-lg">
                {seoDescription}
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  "تخطيط عملي للحركة والتخزين والإضاءة قبل اختيار الشكل النهائي.",
                  "اختيار خامات وألوان وأثاث مخصص يناسب الشقق والفيلات في القاهرة ومصر.",
                  "ربط التصميم الداخلي بالتشطيبات وقطع الأثاث حتى تظهر الغرفة كجزء من هوية واحدة.",
                ].map((item) => (
                  <p key={item} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-7 text-white/68">
                    {item}
                  </p>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {roomFaqs.map((faq) => (
                  <article key={faq.question} className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                    <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                    <p className="text-sm leading-7 text-white/65">{faq.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
