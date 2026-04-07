import { useEffect, useState } from 'react';

export default function MainContent() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // حساب الشفافية بناءً على التمرير (يبدأ من 0 ويصل لـ 1 بعد سكرول 300px مثلاً)
  const overlayOpacity = Math.min(scrollY / 300, 1);

  return (
    <div className="relative">
      {/* 1. قسم الهيرو (يبقى نظيفاً دائماً) */}
      <section className="relative h-screen w-full flex items-center justify-center">
        {/* محتوى الهيرو الخاص بك هنا */}
        <h1 className="text-white text-6xl font-bold z-10">Azenith Living</h1>
      </section>

      {/* 2. حاوية المحتوى مع التظليل الذكي */}
      <section className="relative z-20 min-h-screen">
        
        {/* طبقة التظليل الزجاجي المتدرج - تظهر فقط خلف هذا القسم */}
        <div 
          className="sticky top-0 left-0 w-full h-screen -z-10 pointer-events-none transition-all duration-300"
          style={{
            opacity: overlayOpacity,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 100%)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        />

        {/* 3. محتوى الصفحة (الكروت) */}
        <div className="max-w-7xl mx-auto px-4 -mt-[30vh]"> 
           {/* الكروت هنا - استخدم -mt لرفعها فوق الهيرو */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1, Card 2, Card 3 */}
           </div>
        </div>
      </section>
    </div>
  );
}
