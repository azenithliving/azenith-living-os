/**
 * Metadata Translations
 * SEO and page metadata in both Arabic and English
 */

type Language = 'ar' | 'en';

export const SITE_METADATA: Record<Language, {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
}> = {
  ar: {
    title: "أزينث ليفينج | تصميم داخلي فاخر",
    description: "استشارة تصميم مبدئية وتجربة عربية أولًا ومسار واضح من الاستكشاف حتى التواصل.",
    keywords: "تصميم داخلي, ديكور فاخر, أثاث مصري, تصميم غرف, مطابخ فاخرة, غرف نوم, التصميم الداخلي",
    ogTitle: "أزينث ليفينج - عالم من الفخامة",
    ogDescription: "اكتشف مساحات فاخرة مصممة خصيصًا لأسلوب حياتك",
  },
  en: {
    title: "Azenith Living | Luxury Interior Design",
    description: "An initial design consultation with an Arabic-first experience and a clear path from exploration to contact.",
    keywords: "interior design, luxury decor, Egyptian furniture, room design, luxury kitchens, bedrooms, interior design",
    ogTitle: "Azenith Living - A World of Luxury",
    ogDescription: "Discover luxurious spaces designed exclusively for your lifestyle",
  },
};

export const PAGE_METADATA: Record<string, Record<Language, {
  title: string;
  description: string;
}>> = {
  home: {
    ar: {
      title: "الرئيسية | أزينث ليفينج",
      description: "استكشف المساحات الفاخرة وابدأ استشارة تصميم تناسب منزلك.",
    },
    en: {
      title: "Home | Azenith Living",
      description: "Explore luxury spaces and start a design consultation for your home.",
    },
  },
  rooms: {
    ar: {
      title: "المساحات | أزينث ليفينج",
      description: "استكشف مجموعتنا من المساحات الفاخرة: غرف نوم، مطابخ، غرف معيشة، وأكثر.",
    },
    en: {
      title: "Spaces | Azenith Living",
      description: "Explore our collection of luxury spaces: bedrooms, kitchens, living rooms, and more.",
    },
  },
  about: {
    ar: {
      title: "من نحن | أزينث ليفينج",
      description: "نحن نصنع الفخامة. تعرف على فريقنا وقصة علامتنا التجارية.",
    },
    en: {
      title: "About | Azenith Living",
      description: "We craft luxury. Meet our team and discover our brand story.",
    },
  },
  contact: {
    ar: {
      title: "تواصل معنا | أزينث ليفينج",
      description: "تواصل مع فريقنا للحصول على استشارة تصميم فاخرة مخصصة.",
    },
    en: {
      title: "Contact | Azenith Living",
      description: "Connect with our team for a personalized luxury design consultation.",
    },
  },
  elite: {
    ar: {
      title: "استشارة تصميم | أزينث ليفينج",
      description: "شارك تفاصيل رؤيتك لبدء استشارة تصميم مخصصة.",
    },
    en: {
      title: "Design Consultation | Azenith Living",
      description: "Share your vision to begin a personalized design consultation.",
    },
  },
};

/**
 * Get metadata for a specific page and language
 */
export function getPageMetadata(page: string, lang: Language) {
  const pageData = PAGE_METADATA[page]?.[lang];
  const siteData = SITE_METADATA[lang];

  if (!pageData) {
    return {
      title: siteData.title,
      description: siteData.description,
      keywords: siteData.keywords,
    };
  }

  return {
    title: pageData.title,
    description: pageData.description,
    keywords: siteData.keywords,
    openGraph: {
      title: siteData.ogTitle,
      description: siteData.ogDescription,
    },
  };
}

/**
 * Generate dynamic metadata for a room/space
 */
export function getRoomMetadata(
  roomName: string,
  roomDescription: string,
  lang: Language
) {
  const siteData = SITE_METADATA[lang];

  if (lang === "ar") {
    return {
      title: `${roomName} | أزينث ليفينج`,
      description: roomDescription,
      keywords: `${roomName}, تصميم داخلي, ${siteData.keywords}`,
    };
  }

  return {
    title: `${roomName} | Azenith Living`,
    description: roomDescription,
    keywords: `${roomName}, interior design, ${siteData.keywords}`,
  };
}
