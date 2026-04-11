import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import RoomPageClient from "@/components/RoomPageClient";

type RoomMeta = {
  id: string;
  title: string;
  category: string;
  description: string;
  query: string;
};

const ROOMS: RoomMeta[] = [
  {
    id: "master-bedroom",
    title: "غرف النوم الرئيسية",
    category: "خصوصية ملكية",
    description: "ملاذ هادئ يجمع بين الفخامة الفندقية والراحة الشخصية بتفاصيل متقنة.",
    query: "luxury master bedroom suite hotel interior design",
  },
  {
    id: "children-room",
    title: "غرف الأطفال",
    category: "أحلام صغيرة",
    description: "مساحة آمنة ومبهجة تنمو مع طفلك، تجمع بين المرح والوظيفة.",
    query: "luxury kids bedroom interior design playful elegant",
  },
  {
    id: "teen-room",
    title: "غرف المراهقين",
    category: "شخصية ناشئة",
    description: "تصميم يناسب مرحلة النضج مع مساحات للدراسة والتعبير الذاتي.",
    query: "modern teenager bedroom study area contemporary design",
  },
  {
    id: "living-room",
    title: "غرف المعيشة",
    category: "استقبال بثقة",
    description: "جلسات مدروسة بصريًا لاستقبال الضيوف ولحظات عائلية لا تُنسى.",
    query: "luxury modern living room high-end interior design architectural digest lounge",
  },
  {
    id: "dining-room",
    title: "غرف الطعام",
    category: "ولائم عائلية",
    description: "تجارب طعام مريحة بأناقة دافئة تناسب كل مناسبة.",
    query: "bespoke dining area luxury interior dining modern chandelier dining room",
  },
  {
    id: "corner-sofa",
    title: "الكنب الزاوية",
    category: "راحة مطلقة",
    description: "قطع مفروشات فاخرة تضيف لمسة عصرية ومساحة جلوس واسعة.",
    query: "luxury corner sofa sectional living room high-end furniture",
  },
  {
    id: "lounge",
    title: "اللاونج",
    category: "استرخاء أنيق",
    description: "زاوية خاصة للاسترخاء والقراءة بلمسات أنيقة وخامات ناعمة.",
    query: "luxury lounge seating area interior design modern elegant",
  },
  {
    id: "dressing-room",
    title: "غرف الملابس",
    category: "تنظيم فاخر",
    description: "تجربة ملابس يومية أنيقة بتقسيم ذكي وإضاءة مثالية.",
    query: "bespoke walk-in closet luxury dressing room interior",
  },
  {
    id: "kitchen",
    title: "المطابخ",
    category: "فن الطهي",
    description: "مساحة عمل أنيقة تجمع بين الوظيفة والجمال لتجربة طهي فاخرة.",
    query: "luxury high-end kitchen marble bespoke interior design",
  },
  {
    id: "home-office",
    title: "المكاتب المنزلية",
    category: "إنتاجية متقنة",
    description: "بيئة عمل محفزة تحافظ على التوازن بين المهنية والراحة المنزلية.",
    query: "luxury home office study room executive interior",
  },
  {
    id: "interior-design",
    title: "التصميم الداخلي الشامل",
    category: "رؤية متكاملة",
    description: "تجربة تصميم متناسقة للمنزل بالكامل بلغة بصرية موحدة.",
    query: "luxury comprehensive interior design whole house architecture",
  },
];

const ROOM_ALIASES: Record<string, string> = {
  office: "home-office",
  "kids-room": "youth-room",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const STYLE_QUERY_HINTS: Record<string, string> = {
  modern: "modern minimal luxury",
  classic: "classic elegant luxury",
  industrial: "industrial loft luxury",
  scandinavian: "scandinavian cozy luxury",
};

const ROOM_STYLE_DESCRIPTIONS: Record<string, Record<string, { category: string; description: string }>> = {
  "master-bedroom": {
    modern: { category: "نقاء عصري", description: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي." },
    classic: { category: "فخامة ملكية", description: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية." },
    industrial: { category: "خامة أصيلة", description: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء." },
    scandinavian: { category: "دفء شمالي", description: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق." },
  },
  "living-room": {
    modern: { category: "أناقة معاصرة", description: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية." },
    classic: { category: "عراقة وجمال", description: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة." },
    industrial: { category: "روح المدينة", description: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية." },
    scandinavian: { category: "بساطة شمالية", description: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة." },
  },
  kitchen: {
    modern: { category: "أداء ذكي", description: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية." },
    classic: { category: "تراث الطبخ", description: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي." },
    industrial: { category: "قوة الخامة", description: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة." },
    scandinavian: { category: "نقاء وضوء", description: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة." },
  },
  "dressing-room": {
    modern: { category: "تنظيم عصري", description: "أدراج مخفية وإضاءة LED ذكية لتجربة ملابس منظمة وهادئة." },
    classic: { category: "خزائن ملكية", description: "مرايا مزخرفة وخزائن خشبية ثقيلة بتفاصيل ذهبية راقية." },
    industrial: { category: "عرض جريء", description: "أنابيب معدنية ورفوف خشبية لعرض الملابس بأسلوب لوفت عصري." },
    scandinavian: { category: "بساطة عملية", description: "تنظيم واضح وإضاءة ناعمة مع خشب فاتح لراحة يومية." },
  },
  "home-office": {
    modern: { category: "تركيز عصري", description: "خطوط نظيفة وتقنية متكاملة لبيئة عمل منتجة بدون تشويش." },
    classic: { category: "مكتب تنفيذي", description: "خشب داكن وجلد فاخر يخلقان حضوراً مهنياً يليق بالقرارات الكبرى." },
    industrial: { category: "إبداع صناعي", description: "جدران طوبية وطاولات معدنية لمساحة عمل ملهمة وقوية الشخصية." },
    scandinavian: { category: "توازن وهدوء", description: "ضوء طبيعي ونباتات وألوان هادئة تدعم الإنتاجية والراحة النفسية." },
  },
  "youth-room": {
    modern: { category: "مرونة عصرية", description: "تصميم متكيف مع مساحات تخزين ذكية تنمو مع احتياجات الشباب المتغيرة." },
    classic: { category: "أناقة شبابية", description: "خشب نقي وتفاصيل دافئة تمنح الأبناء قيمة الجودة منذ الصغر." },
    industrial: { category: "شخصية قوية", description: "لمسات معدنية وخشب خام لمساحة تعبر عن الجرأة والاستقلالية." },
    scandinavian: { category: "نمو بصحة", description: "ألوان هادئة وإضاءة طبيعية تخلق بيئة مثالية للدراسة والراحة." },
  },
  "dining-room": {
    modern: { category: "تجمع عصري", description: "طاولات نظيفة وإضاءة معمارية لجلسات طعام أنيقة وعصرية." },
    classic: { category: "ولائم تقليدية", description: "أثاث نقشي وثريات كريستال لجلسات عائلية ذات طابع تاريخي." },
    industrial: { category: "طعام بروح المدينة", description: "طاولات خشبية ثقيلة ولمسات معدنية لأجواء طعام جريئة." },
    scandinavian: { category: "دفء المائدة", description: "خشب فاتح وإضاءة شمعدانية لجلسات طعام دافئة ومريحة." },
  },
  "interior-design": {
    modern: { category: "رؤية متكاملة", description: "تصميم مفتوح ومينيمال يربط كل مساحات المنزل بأناقة عصرية." },
    classic: { category: "تراث متناسق", description: "لغة تصميم موحدة تعكس الأصالة والفخامة في كل ركن من المنزل." },
    industrial: { category: "شخصية قوية", description: "مزيج متناسق من الخامات الصناعية يخلق منزلاً بروح المدينة." },
    scandinavian: { category: "نقاء متناغم", description: "تدفق طبيعي للضوء والهواء مع ألوان هادئة في كل مساحة." },
  },
  "children-room": {
    modern: { category: "عالم ألوان", description: "تصميم آمن ومبهج يناسب تطور طفلك مع ألوان متناسقة." },
    classic: { category: "أحلام دافئة", description: "تفاصيل دافئة وخشب نقي لبيئة آمنة ومريحة." },
    industrial: { category: "مغامرة صغيرة", description: "لمسات معدنية وخشبية تناسب روح المغامرة لدى الأطفال." },
    scandinavian: { category: "نقاء ومرح", description: "ألوان هادئة ومساحات آمنة للعب والنمو." },
  },
  "teen-room": {
    modern: { category: "استقلالية عصرية", description: "مساحة متكاملة للدراسة والاسترخاء بتصميم عصري." },
    classic: { category: "أناقة ناشئة", description: "خشب داكن وتفاصيل راقية تناسب مرحلة النضج." },
    industrial: { category: "شخصية جريئة", description: "لمسات معدنية وخشب خام تعبر عن الاستقلالية." },
    scandinavian: { category: "تركيز وهدوء", description: "إضاءة طبيعية وتنظيم واضح للدراسة والراحة." },
  },
  "corner-sofa": {
    modern: { category: "أناقة عملية", description: "تصميم عصري يوفر مساحة جلوس واسعة بأناقة." },
    classic: { category: "فخامة تقليدية", description: "خامات فاخرة وتفاصيل نقشية لجلسات راقية." },
    industrial: { category: "خامة أصيلة", description: "جلد طبيعي وهيكل معدني لمساحة جريئة." },
    scandinavian: { category: "راحة شمالية", description: "قماش ناعم وألوان فاتحة لراحة مطلقة." },
  },
  lounge: {
    modern: { category: "زاوية هادئة", description: "مساحة استرخاء عصرية بتصميم مينيمال أنيق." },
    classic: { category: "أناقة قراءة", description: "كرسي استرخاء فاخر وإضاءة دافئة للقراءة." },
    industrial: { category: "استرخاء صناعي", description: "كرسي جلد وطاولة خشبية خام لزاوية مميزة." },
    scandinavian: { category: "دفء وقراءة", description: "كرسي ناعم وإضاءة طبيعية لزاوية قراءة مريحة." },
  },
};

async function fetchRoomPhotos(query: string, style: string, roomId: string) {
  const headerStore = await headers();
  const host = headerStore.get("host") ?? "localhost:3000";
  const protocol = headerStore.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const styleHint = STYLE_QUERY_HINTS[style] || style;
  const fullQuery = `${styleHint} luxury interior design ${query}`;
  const randomPage = Math.floor(Math.random() * 5) + 1;
  const url = `${protocol}://${host}/api/pexels?query=${encodeURIComponent(fullQuery)}&per_page=50&page=${randomPage}`;

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
  const { id: rawId } = await params;
  const id = ROOM_ALIASES[rawId] ?? rawId;
  const room = ROOMS.find((item) => item.id === id);

  if (!room) {
    notFound();
  }

  const paramsObj = await searchParams;
  const style = typeof paramsObj.style === "string" ? paramsObj.style : "modern";
  const photos = await fetchRoomPhotos(room.query, style, id);
  const styleDesc = ROOM_STYLE_DESCRIPTIONS[id]?.[style];

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <RoomPageClient
            room={room}
            initialPhotos={photos}
            styleDesc={styleDesc}
          />
        </div>
      </div>
    </main>
  );
}
