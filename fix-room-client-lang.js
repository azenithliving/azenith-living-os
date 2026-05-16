const fs = require('fs');

const path = 'components/RoomPageClient.tsx';
let code = fs.readFileSync(path, 'utf8');

// Liked/Like
code = code.replace(
  /<span>\{isLiked \? "أعجبني" : "أعجبني"\}<\/span>/,
  '<span>{isLiked ? (isRTL ? "أعجبني" : "Liked") : (isRTL ? "أعجبني" : "Like")}</span>'
);

// Saved/Save
code = code.replace(
  /<span>\{isFavorited \? "محفوظ" : "حفظ"\}<\/span>/,
  '<span>{isFavorited ? (isRTL ? "محفوظ" : "Saved") : (isRTL ? "حفظ" : "Save")}</span>'
);

// Design Tip Batch
code = code.replace(
  /معلومة تصميمية - الدفعة \{batchIndex \+ 1\}/,
  '{isRTL ? `معلومة تصميمية - الدفعة ${batchIndex + 1}` : `Design Tip - Batch ${batchIndex + 1}`}'
);

// Tip Title & Content
code = code.replace(
  /\{tip\.title\}/g,
  '{isRTL ? tip.title : ((tip as any).titleEn || tip.title)}'
);
code = code.replace(
  /\{tip\.content\}/g,
  '{isRTL ? tip.content : ((tip as any).contentEn || tip.content)}'
);

// Tip Categories
code = code.replace(
  /\{tip\.category === "furniture" && "أثاث"\}/,
  '{tip.category === "furniture" && (isRTL ? "أثاث" : "Furniture")}'
);
code = code.replace(
  /\{tip\.category === "lighting" && "إضاءة"\}/,
  '{tip.category === "lighting" && (isRTL ? "إضاءة" : "Lighting")}'
);
code = code.replace(
  /\{tip\.category === "colors" && "ألوان"\}/,
  '{tip.category === "colors" && (isRTL ? "ألوان" : "Colors")}'
);
code = code.replace(
  /\{tip\.category === "layout" && "تخطيط"\}/,
  '{tip.category === "layout" && (isRTL ? "تخطيط" : "Layout")}'
);
code = code.replace(
  /\{tip\.category === "materials" && "خامات"\}/,
  '{tip.category === "materials" && (isRTL ? "خامات" : "Materials")}'
);

// Also fix some other UI strings in RoomPageClient.tsx
code = code.replace(
  /جاري تحميل المزيد من الإلهام\.\.\./g,
  '{isRTL ? "جاري تحميل المزيد من الإلهام..." : "Loading more inspiration..."}'
);
code = code.replace(
  /مشاهدة المزيد/g,
  '{isRTL ? "مشاهدة المزيد" : "View More"}'
);
code = code.replace(
  /يمكنك تحميل/g,
  '{isRTL ? "يمكنك تحميل" : "You can load"}'
);
code = code.replace(
  /دفعات إضافية/g,
  '{isRTL ? "دفعات إضافية" : "more batches"}'
);
code = code.replace(
  /صورة لكل دفعة/g,
  '{isRTL ? "صورة لكل دفعة" : "images per batch"}'
);

fs.writeFileSync(path, code);
