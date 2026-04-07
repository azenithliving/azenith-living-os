"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const slides = [
  { 
    id: 1, 
    video: '/videos/hero-1.mp4', 
    title: 'إرث الخبرة في كل قطعة',
    description: 'نحمل معنا 50 عاماً من الخبرة العائلية في كل تفصيلة',
    stats: [
      { label: 'تأسست عام', value: '2012' }, 
      { label: 'خبرة عائلية', value: '+50 عاماً' }, 
      { label: 'الكيان', value: 'رسمي موثق' }
    ],
  },
  { 
    id: 2, 
    video: '/videos/hero-2.mp4', 
    title: 'صلابة الخشب الطبيعي',
    description: 'تعشيقات خشبية متينة تصمد أمام اختبار الزمن',
    stats: [
      { label: 'الصلابة', value: 'تعشيقات خشبية' }, 
      { label: 'المتانة', value: 'خشب طبيعي' }, 
      { label: 'الجودة', value: 'صمود حقيقي' }
    ],
  },
  { 
    id: 3, 
    video: '/videos/hero-3.mp4', 
    title: 'تصميم عصري مبتكر',
    description: 'ندمج أصول الصنعة التقليدية مع أحدث أساليب Neural Design',
    stats: [
      { label: 'النهج', value: 'Neural Design' }, 
      { label: 'الابتكار', value: 'تصميم عصري' }, 
      { label: 'المعيار', value: 'عالمي' }
    ],
  },
  { 
    id: 4, 
    video: '/videos/hero-4.mp4', 
    title: 'تحالف اليد والآلة',
    description: 'إنتاج رقمي دقيق يلتقي بالصنعة اليدوية المخلصة',
    stats: [
      { label: 'الإنتاج', value: 'رقمي دقيق' }, 
      { label: 'الدمج', value: 'يد + آلة' }, 
      { label: 'النتيجة', value: 'دقة فائقة' }
    ],
  },
  { 
    id: 5, 
    video: '/videos/hero-5.mp4', 
    title: 'ثقة في أرقى الوحدات',
    description: 'ساهمنا في فرش أفخم الفيلات الخاصة بإرث عائلي موثوق',
    stats: [
      { label: 'الخبرة', value: 'فرش أرقى الوحدات' }, 
      { label: 'الثقة', value: 'إرث عائلي' }, 
      { label: 'المستوى', value: 'فيلات خاصة' }
    ],
  },
  { 
    id: 6, 
    video: '/videos/hero-6.mp4', 
    title: 'رفاهية مطلقة',
    description: 'Luxury & Comfort في كل قطعة أثاث نصنعها',
    stats: [
      { label: 'الفلسفة', value: 'Luxury & Comfort' }, 
      { label: 'الهدف', value: 'راحة تامة' }, 
      { label: 'الوعد', value: 'رفاهية مطلقة' }
    ]
  }
];

export default function AzenithLegacy() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    console.error('Video loading error:', e);
    console.log('Failed to load video:', slides[currentIndex].video);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden" dir="rtl">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 w-full h-full"
          style={{
            background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' // Placeholder gradient background
          }}
        >
          <video 
            autoPlay 
            muted 
            loop 
            playsInline 
            className="absolute inset-0 w-full h-full object-cover z-0" 
            src={slides[currentIndex].video}
            onError={handleVideoError}
          />

          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 z-10" />
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[1px] z-10" />

          <div className="relative z-30 h-full flex flex-col justify-center items-center text-center px-6">
            <motion.h2 
              initial={{ y: 30, opacity: 0, filter: 'blur(8px)' }}
              animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-white text-4xl md:text-6xl font-bold drop-shadow-2xl mb-4 max-w-5xl"
            >
              {slides[currentIndex].title}
            </motion.h2>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-white/80 text-lg mb-12 max-w-2xl font-light"
            >
              {slides[currentIndex].description}
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl border-t border-white/20 pt-10"
            >
              {slides[currentIndex].stats.map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 1.0 + (i * 0.2) }}
                  className="flex flex-col items-center text-center"
                >
                  <span className="text-white/70 text-xs uppercase tracking-wider mb-2">{stat.label}</span>
                  <span className="text-white text-xl font-light">{stat.value}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 flex gap-4">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`h-1.5 transition-all duration-500 rounded-full ${
              index === currentIndex ? 'w-12 bg-white' : 'w-3 bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
