"use client";

import { ReactNode, useState } from "react";
import { Download } from "lucide-react";

interface ImageHoverWrapperProps {
  children: ReactNode;
  imageIndex: number;
  onHoverStart: (index: number) => void;
  onHoverEnd: (index: number) => void;
  onDownload?: (index: number) => void;
  imageUrl?: string;
  onImageClick?: () => void;
}

export default function ImageHoverWrapper({
  children,
  imageIndex,
  onHoverStart,
  onHoverEnd,
  onDownload,
  imageUrl,
  onImageClick,
}: ImageHoverWrapperProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!imageUrl || isDownloading) return;
    
    setIsDownloading(true);
    
    try {
      // Fetch image as blob to force download
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `azenith-design-${imageIndex}.jpg`;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup blob URL after a delay
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      
      // Call tracking callback
      if (onDownload) {
        onDownload(imageIndex);
      }
    } catch (error) {
      console.error('[Download] Failed to download image:', error);
      // Fallback: open in new tab
      window.open(imageUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only trigger image click if not clicking the download button
    if (onImageClick && !(e.target as HTMLElement).closest('button')) {
      onImageClick();
    }
  };

  return (
    <div
      className="relative group cursor-pointer overflow-hidden rounded-xl border border-white/5 transition-all duration-300 hover:shadow-lg hover:shadow-black/20"
      onMouseEnter={() => onHoverStart(imageIndex)}
      onMouseLeave={() => onHoverEnd(imageIndex)}
      onClick={handleContainerClick}
    >
      {children}
      
      {/* Subtle darkening overlay on hover */}
      <div className="absolute inset-0 bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/20 group-hover:opacity-100 pointer-events-none z-10" />
      
      {/* Click hint - subtle text */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100 z-20 pointer-events-none">
        <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
          انقر للتكبير
        </span>
      </div>
      
      {/* Download button - elegant gold, top-right, 70% opacity - isolated from transform */}
      {onDownload && (
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="absolute top-3 right-3 z-30 opacity-0 transition-all duration-300 group-hover:opacity-70 hover:opacity-100 text-[#d4af37] p-2 rounded-full backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
          style={{ color: '#d4af37', transform: 'translateZ(0)' }}
          title="تحميل"
        >
          <Download className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`} />
        </button>
      )}
    </div>
  );
}
