import Link from "next/link";
import Image from "next/image";

interface FurnitureCardProps {
  furniture: {
    slug: string;
    title: string;
    images: string[];
    video?: string;
    description: string;
    priceRange: string;
    features: string[];
    variations: string[];
  };
  whatsappUrl: string;
  isWishlisted?: boolean;
  onWishlistToggle?: () => void;
}

export default function FurnitureCard({ furniture, whatsappUrl, isWishlisted = false, onWishlistToggle }: FurnitureCardProps) {
  const firstImage = furniture.images[0]?.startsWith("/images/")
    ? "/images/furniture-placeholder.jpg"
    : furniture.images[0] || "/images/furniture-placeholder.jpg";
  const canPreviewVideo = Boolean(furniture.video && !furniture.video.startsWith("/videos/"));

  const toggleWishlist = () => {
    onWishlistToggle?.();
  };

  return (
    <article className="group rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 overflow-hidden hover:border-brand-primary/50 transition-all hover:scale-[1.02] hover:shadow-2xl backdrop-blur-sm">
      {/* Furniture Image/Video */}
      <div className="relative h-48 w-full rounded-[1.25rem] overflow-hidden bg-gradient-to-br from-gray-900/50 to-gray-800/50 mb-4 group-hover:scale-105 transition-transform">
        <Image 
          src={firstImage} 
          alt={furniture.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        {canPreviewVideo && (
          <video 
            src={furniture.video} 
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            muted 
            loop 
            playsInline 
          />
        )}
      </div>
      
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-white line-clamp-2">{furniture.title}</h3>
        <p className="text-brand-primary font-bold text-lg">{furniture.priceRange}</p>
        <p className="text-sm leading-6 text-white/75 line-clamp-2">{furniture.description}</p>
        
        <div className="flex flex-wrap gap-2">
          {furniture.features.slice(0, 3).map((feature, index) => (
            <span key={index} className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs rounded-full font-medium">
              {feature}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-white/60">
            <span>المتوفر بـ:</span>
            <div className="flex gap-1 flex-wrap">
              {furniture.variations.slice(0, 2).map((variation, index) => (
                <span key={index} className="px-2 py-1 bg-white/5 rounded-md">{variation}</span>
              ))}
            </div>
          </div>
          <button 
            onClick={toggleWishlist}
            className={`p-2 rounded-full transition-all ${isWishlisted ? 'bg-brand-primary text-brand-accent shadow-lg' : 'bg-white/10 text-white/60 hover:bg-brand-primary/20 hover:text-brand-primary'}`}
            title={isWishlisted ? 'إزالة من الرغبات' : 'إضافة للرغبات'}
          >
            <svg fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              {isWishlisted && <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>}
            </svg>
          </button>
        </div>
        
        <Link 
          href={whatsappUrl.replace('استفسار عن الأثاث', `${furniture.title} - استفسار`)} 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-4 w-full block rounded-full bg-gradient-to-r from-brand-primary to-[#d8b56d] text-brand-accent px-6 py-3 text-center font-semibold shadow-lg hover:shadow-2xl hover:translate-y-[-2px] transition-all"
        >
          اطلب عرض سعر فوري
        </Link>
      </div>
    </article>
  );
}
