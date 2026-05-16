const fs = require('fs');

let content = fs.readFileSync('components/home-page-client-fixed.tsx', 'utf8');

// Replace roomCard rendering block
content = content.replace(
  /alt=\{`\$\{room\.title\} بتصميم \$\{styleAltLabel\}`\}/g,
  "alt={isRTL ? `${room.title} بتصميم ${styleAltLabel}` : `${room.titleEn || room.title} in ${styleAltLabel} style`}"
);

content = content.replace(
  /<span className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-primary">\{room\.eyebrow\}<\/span>/g,
  '<span className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-primary">{isRTL ? room.eyebrow : (room.eyebrowEn || room.eyebrow)}</span>'
);

content = content.replace(
  /<h3 className="mb-2 text-2xl font-serif font-bold text-white">\{room\.title\}<\/h3>/g,
  '<h3 className="mb-2 text-2xl font-serif font-bold text-white">{isRTL ? room.title : (room.titleEn || room.title)}</h3>'
);

content = content.replace(
  /<p className="line-clamp-2 text-sm leading-relaxed text-white\/70">\{room\.summary\}<\/p>/g,
  '<p className="line-clamp-2 text-sm leading-relaxed text-white/70">{isRTL ? room.summary : (room.summaryEn || room.summary)}</p>'
);

fs.writeFileSync('components/home-page-client-fixed.tsx', content);
console.log("Updated home-page-client-fixed.tsx");
