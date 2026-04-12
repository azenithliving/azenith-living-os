#!/usr/bin/env tsx
/**
 * Bulk Translation Script for Server-Side Vault
 * Pre-translates all UI strings and saves to Supabase cache
 * Usage: npx tsx scripts/bulk-translate-vault.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load env BEFORE any other imports
config({ path: resolve(process.cwd(), ".env.local") });

// Now safe to import modules that read env vars
import { bulkTranslateAndCache } from "@/lib/translation-vault";

// Collect all UI strings that need translation from the site
const UI_STRINGS = [
  // Header Navigation
  { text: "الرئيسية", context: "header" },
  { text: "المساحات", context: "header" },
  { text: "من نحن", context: "header" },
  { text: "الأثاث", context: "header" },
  { text: "ابدأ مشروعك", context: "header" },
  { text: "اتصل بنا", context: "header" },
  { text: "تسجيل الدخول", context: "header" },

  // Elite Intelligence Form
  { text: "تحليل ذكي", context: "elite" },
  { text: "ما نوع المساحة التي تريد تحويلها؟", context: "elite" },
  { text: "أي أسلوب تصميم يعجبك أكثر؟", context: "elite" },
  { text: "ما الميزانية التقريبية لمشروعك؟", context: "elite" },
  { text: "هل تريد تقييم مجاني عبر واتساب؟", context: "elite" },
  { text: "للتحليل الذكي، أخبرنا بالمزيد:", context: "elite" },
  { text: "الاسم الكامل", context: "elite" },
  { text: "رقم الهاتف", context: "elite" },
  { text: "البريد الإلكتروني", context: "elite" },
  { text: "إرسال الطلب", context: "elite" },
  { text: "ملاحظات إضافية", context: "elite" },
  { text: "أو تواصل عبر واتساب مباشرة", context: "elite" },

  // Room Categories
  { text: "الكل", context: "rooms" },
  { text: "غرف النوم", context: "rooms" },
  { text: "غرف المعيشة", context: "rooms" },
  { text: "المطابخ", context: "rooms" },
  { text: "غرف الطعام", context: "rooms" },
  { text: "المكاتب", context: "rooms" },

  // Room Titles
  { text: "غرف النوم الرئيسية", context: "rooms" },
  { text: "غرف الأطفال", context: "rooms" },
  { text: "غرف المراهقين", context: "rooms" },
  { text: "غرف المعيشة", context: "rooms" },
  { text: "غرف الطعام", context: "rooms" },
  { text: "الكنب الزاوية", context: "rooms" },
  { text: "اللاونج", context: "rooms" },
  { text: "غرف الملابس", context: "rooms" },
  { text: "المطابخ", context: "rooms" },
  { text: "المكاتب المنزلية", context: "rooms" },
  { text: "التصميم الداخلي الشامل", context: "rooms" },

  // Room Categories/Descriptions
  { text: "خصوصية ملكية", context: "rooms" },
  { text: "أحلام صغيرة", context: "rooms" },
  { text: "شخصية ناشئة", context: "rooms" },
  { text: "استقبال بثقة", context: "rooms" },
  { text: "ولائم عائلية", context: "rooms" },
  { text: "راحة مطلقة", context: "rooms" },
  { text: "استرخاء أنيق", context: "rooms" },
  { text: "تنظيم فاخر", context: "rooms" },
  { text: "فن الطهي", context: "rooms" },
  { text: "إنتاجية متقنة", context: "rooms" },
  { text: "رؤية متكاملة", context: "rooms" },

  // Room Descriptions
  { text: "ملاذ هادئ يجمع بين الفخامة الفندقية والراحة الشخصية بتفاصيل متقنة.", context: "rooms" },
  { text: "مساحة آمنة ومبهجة تنمو مع طفلك، تجمع بين المرح والوظيفة.", context: "rooms" },
  { text: "تصميم يناسب مرحلة النضج مع مساحات للدراسة والتعبير الذاتي.", context: "rooms" },
  { text: "جلسات مدروسة بصريًا لاستقبال الضيوف ولحظات عائلية لا تُنسى.", context: "rooms" },
  { text: "تجارب طعام مريحة بأناقة دافئة تناسب كل مناسبة.", context: "rooms" },
  { text: "قطع مفروشات فاخرة تضيف لمسة عصرية ومساحة جلوس واسعة.", context: "rooms" },
  { text: "زاوية خاصة للاسترخاء والقراءة بلمسات أنيقة وخامات ناعمة.", context: "rooms" },
  { text: "تجربة ملابس يومية أنيقة بتقسيم ذكي وإضاءة مثالية.", context: "rooms" },
  { text: "مساحة عمل أنيقة تجمع بين الوظيفة والجمال لتجربة طهي فاخرة.", context: "rooms" },
  { text: "بيئة عمل محفزة تحافظ على التوازن بين المهنية والراحة المنزلية.", context: "rooms" },
  { text: "تجربة تصميم متناسقة للمنزل بالكامل بلغة بصرية موحدة.", context: "rooms" },

  // Style Names
  { text: "عصري", context: "styles" },
  { text: "كلاسيكي", context: "styles" },
  { text: "صناعي", context: "styles" },
  { text: "اسكندنافي", context: "styles" },

  // CTA & General
  { text: "اكتشف المزيد", context: "cta" },
  { text: "احجز استشارة", context: "cta" },
  { text: "تواصل معنا", context: "cta" },
  { text: "تصفح الأثاث", context: "cta" },
  { text: "استكشف غرفنا", context: "cta" },

  // Footer
  { text: "تواصل معنا للحصول على استشارة مجانية", context: "footer" },
  { text: "تابعنا على", context: "footer" },
  { text: "سياسة الخصوصية", context: "footer" },
  { text: "شروط الاستخدام", context: "footer" },

  // Error/Status Messages
  { text: "جاري التحميل...", context: "ui" },
  { text: "تم بنجاح", context: "ui" },
  { text: "حدث خطأ", context: "ui" },
  { text: "يرجى المحاولة مرة أخرى", context: "ui" },
  { text: "انقر للتكبير", context: "ui" },
  { text: "تبديل", context: "ui" },
  { text: "جاري تحديث الصور...", context: "ui" },

  // Request Page
  { text: "Request intake", context: "request" },
  { text: "حوّل التقييم إلى طلب فعلي.", context: "request" },
  { text: "هذه المرحلة تحفظ بيانات العميل وتجهز رسالة الإغلاق عبر واتساب.", context: "request" },
  { text: "الملف الحالي", context: "request" },
  { text: "لم تُحدد المساحة بعد", context: "request" },
  { text: "لم تُحدد الخدمة بعد", context: "request" },
  { text: "حفظ الطلب", context: "request" },
  { text: "الانتقال إلى واتساب", context: "request" },
  { text: "تقدير مبدئي", context: "request" },
  { text: "رسوم التصميم", context: "request" },
  { text: "نطاق التنفيذ", context: "request" },
  { text: "النية الحالية", context: "request" },
  { text: "الباقات الأنسب", context: "request" },
  { text: "تم حفظ الطلب", context: "request" },
  { text: "الخطوة التالية", context: "request" },
  { text: "أكمل خطوة التقييم السريع أولًا حتى نبني التقدير الصحيح.", context: "request" },

  // About Page
  { text: "تصميم فاخر يرتقي بتطلعاتك", context: "about" },
  { text: "نحن نؤمن بأن كل مساحة لها قصة تستحق أن تُروى بأناقة.", context: "about" },
  { text: "فريقنا", context: "about" },
  { text: "خبراء في التصميم الداخلي الفاخر", context: "about" },
];

// Collect all Room Style Descriptions
const ROOM_STYLE_STRINGS = [
  // Master Bedroom Styles
  { text: "نقاء عصري", context: "styles" },
  { text: "خطوط نظيفة وتصميم مينيمال يمنحك هدوءاً عصرياً مع تخزين ذكي خفي.", context: "styles" },
  { text: "فخامة ملكية", context: "styles" },
  { text: "فخامة ملكية وتفاصيل غنية تعيد تعريف الرقي الكلاسيكي في كل زاوية.", context: "styles" },
  { text: "خامة أصيلة", context: "styles" },
  { text: "مساحة هادئة بتفاصيل فندقية وخامات راقية تجمع بين القوة والدفء.", context: "styles" },
  { text: "دفء شمالي", context: "styles" },
  { text: "ألوان هادئة وخشب طبيعي يخلق ملاذاً للراحة والاسترخاء العميق.", context: "styles" },

  // Living Room Styles
  { text: "أناقة معاصرة", context: "styles" },
  { text: "تصميم مفتوح وخطوط نقية تجمع بين البساطة والوظيفة العالية.", context: "styles" },
  { text: "عراقة وجمال", context: "styles" },
  { text: "تفاصيل نحتية وثريات فاخرة تمنح المكان روحاً تاريخية عريقة.", context: "styles" },
  { text: "روح المدينة", context: "styles" },
  { text: "جدران طوبية وأسقف عالية مع لمسات معدنية جريئة وشخصية قوية.", context: "styles" },
  { text: "بساطة شمالية", context: "styles" },
  { text: "إضاءة طبيعية وقماش مريح يجعل كل لحظة استرخاء تجربة فريدة.", context: "styles" },

  // Kitchen Styles
  { text: "أداء ذكي", context: "styles" },
  { text: "أسطح خشبية نظيفة وأجهزة مخفية لمساحة طهي أنيقة وعملية.", context: "styles" },
  { text: "تراث الطبخ", context: "styles" },
  { text: "خزائن خشبية نقشية وأرضيات رخامية تعكس أصالة المطبخ التقليدي.", context: "styles" },
  { text: "قوة الخامة", context: "styles" },
  { text: "أسطح معدنية ولمسات خشبية قوية للطهاة المحترفين والمحبي الجرأة.", context: "styles" },
  { text: "نقاء وضوء", context: "styles" },
  { text: "أبيض نقي وخشب فاتح مع إضاءة طبيعية تمنح الطاقة والنظافة.", context: "styles" },

  // Dressing Room Styles
  { text: "تنظيم عصري", context: "styles" },
  { text: "أدراج مخفية وإضاءة LED ذكية لتجربة ملابس منظمة وهادئة.", context: "styles" },
  { text: "خزائن ملكية", context: "styles" },
  { text: "مرايا مزخرفة وخزائن خشبية ثقيلة بتفاصيل ذهبية راقية.", context: "styles" },
  { text: "عرض جريء", context: "styles" },
  { text: "أنابيب معدنية ورفوف خشبية لعرض الملابس بأسلوب لوفت عصري.", context: "styles" },
  { text: "بساطة عملية", context: "styles" },
  { text: "تنظيم واضح وإضاءة ناعمة مع خشب فاتح لراحة يومية.", context: "styles" },

  // Home Office Styles
  { text: "تركيز عصري", context: "styles" },
  { text: "خطوط نظيفة وتقنية متكاملة لبيئة عمل منتجة بدون تشويش.", context: "styles" },
  { text: "مكتب تنفيذي", context: "styles" },
  { text: "خشب داكن وجلد فاخر يخلقان حضوراً مهنياً يليق بالقرارات الكبرى.", context: "styles" },
  { text: "إبداع صناعي", context: "styles" },
  { text: "جدران طوبية وطاولات معدنية لمساحة عمل ملهمة وقوية الشخصية.", context: "styles" },
  { text: "توازن وهدوء", context: "styles" },
  { text: "ضوء طبيعي ونباتات وألوان هادئة تدعم الإنتاجية والراحة النفسية.", context: "styles" },

  // Youth Room Styles
  { text: "مرونة عصرية", context: "styles" },
  { text: "تصميم متكيف مع مساحات تخزين ذكية تنمو مع احتياجات الشباب المتغيرة.", context: "styles" },
  { text: "أناقة شبابية", context: "styles" },
  { text: "خشب نقي وتفاصيل دافئة تمنح الأبناء قيمة الجودة منذ الصغر.", context: "styles" },
  { text: "شخصية قوية", context: "styles" },
  { text: "لمسات معدنية وخشب خام لمساحة تعبر عن الجرأة والاستقلالية.", context: "styles" },
  { text: "نمو بصحة", context: "styles" },
  { text: "ألوان هادئة وإضاءة طبيعية تخلق بيئة مثالية للدراسة والراحة.", context: "styles" },

  // Dining Room Styles
  { text: "تجمع عصري", context: "styles" },
  { text: "طاولات نظيفة وإضاءة معمارية لجلسات طعام أنيقة وعصرية.", context: "styles" },
  { text: "ولائم تقليدية", context: "styles" },
  { text: "أثاث نقشي وثريات كريستال لجلسات عائلية ذات طابع تاريخي.", context: "styles" },
  { text: "طعام بروح المدينة", context: "styles" },
  { text: "طاولات خشبية ثقيلة ولمسات معدنية لأجواء طعام جريئة.", context: "styles" },
  { text: "دفء المائدة", context: "styles" },
  { text: "خشب فاتح وإضاءة شمعدانية لجلسات طعام دافئة ومريحة.", context: "styles" },

  // Interior Design Styles
  { text: "رؤية متكاملة", context: "styles" },
  { text: "تصميم مفتوح ومينيمال يربط كل مساحات المنزل بأناقة عصرية.", context: "styles" },
  { text: "تراث متناسق", context: "styles" },
  { text: "لغة تصميم موحدة تعكس الأصالة والفخامة في كل ركن من المنزل.", context: "styles" },
  { text: "شخصية قوية", context: "styles" },
  { text: "مزيج متناسق من الخامات الصناعية يخلق منزلاً بروح المدينة.", context: "styles" },
  { text: "نقاء متناغم", context: "styles" },
  { text: "تدفق طبيعي للضوء والهواء مع ألوان هادئة في كل مساحة.", context: "styles" },

  // Children Room Styles
  { text: "عالم ألوان", context: "styles" },
  { text: "تصميم آمن ومبهج يناسب تطور طفلك مع ألوان متناسقة.", context: "styles" },
  { text: "أحلام دافئة", context: "styles" },
  { text: "تفاصيل دافئة وخشب نقي لبيئة آمنة ومريحة.", context: "styles" },
  { text: "مغامرة صغيرة", context: "styles" },
  { text: "لمسات معدنية وخشبية تناسب روح المغامرة لدى الأطفال.", context: "styles" },
  { text: "نقاء ومرح", context: "styles" },
  { text: "ألوان هادئة ومساحات آمنة للعب والنمو.", context: "styles" },

  // Teen Room Styles
  { text: "استقلالية عصرية", context: "styles" },
  { text: "مساحة متكاملة للدراسة والاسترخاء بتصميم عصري.", context: "styles" },
  { text: "أناقة ناشئة", context: "styles" },
  { text: "خشب داكن وتفاصيل راقية تناسب مرحلة النضج.", context: "styles" },
  { text: "شخصية جريئة", context: "styles" },
  { text: "لمسات معدنية وخشب خام تعبر عن الاستقلالية.", context: "styles" },
  { text: "تركيز وهدوء", context: "styles" },
  { text: "إضاءة طبيعية وتنظيم واضح للدراسة والراحة.", context: "styles" },

  // Corner Sofa Styles
  { text: "أناقة عملية", context: "styles" },
  { text: "تصميم عصري يوفر مساحة جلوس واسعة بأناقة.", context: "styles" },
  { text: "فخامة تقليدية", context: "styles" },
  { text: "خامات فاخرة وتفاصيل نقشية لجلسات راقية.", context: "styles" },
  { text: "خامة أصيلة", context: "styles" },
  { text: "جلد طبيعي وهيكل معدني لمساحة جريئة.", context: "styles" },
  { text: "راحة شمالية", context: "styles" },
  { text: "قماش ناعم وألوان فاتحة لراحة مطلقة.", context: "styles" },

  // Lounge Styles
  { text: "زاوية هادئة", context: "styles" },
  { text: "مساحة استرخاء عصرية بتصميم مينيمال أنيق.", context: "styles" },
  { text: "أناقة قراءة", context: "styles" },
  { text: "كرسي استرخاء فاخر وإضاءة دافئة للقراءة.", context: "styles" },
  { text: "استرخاء صناعي", context: "styles" },
  { text: "كرسي جلد وطاولة خشبية خام لزاوية مميزة.", context: "styles" },
  { text: "دفء وقراءة", context: "styles" },
  { text: "كرسي ناعم وإضاءة طبيعية لزاوية قراءة مريحة.", context: "styles" },
];

async function main() {
  console.log("=".repeat(60));
  console.log("🌍 Server-Side Translation Vault - Bulk Translation");
  console.log("=".repeat(60));
  console.log(`\nTranslating ${UI_STRINGS.length + ROOM_STYLE_STRINGS.length} strings...\n`);

  // Combine all strings
  const allStrings = [...UI_STRINGS, ...ROOM_STYLE_STRINGS];

  // Translate in batches to avoid rate limiting
  const batchSize = 10;
  const totalBatches = Math.ceil(allStrings.length / batchSize);

  for (let i = 0; i < allStrings.length; i += batchSize) {
    const batch = allStrings.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} items)...`);

    const result = await bulkTranslateAndCache(batch);
    console.log(`  ✓ Success: ${result.success}, ✗ Failed: ${result.failed}`);

    // Add delay between batches
    if (i + batchSize < allStrings.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ Bulk translation complete!");
  console.log("Your translation vault is now pre-populated.");
  console.log("Future users will experience ZERO AI calls for cached strings.");
  console.log("=".repeat(60));
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { main };
