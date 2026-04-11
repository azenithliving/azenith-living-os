/**
 * Edge Caching Configuration
 * Global <500ms load time configuration
 */

export const EDGE_CACHE_CONFIG = {
  // Static assets - long cache
  staticAssets: {
    images: {
      maxAge: 31536000, // 1 year
      staleWhileRevalidate: 86400, // 1 day
      formats: ["avif", "webp", "jpeg"],
    },
    fonts: {
      maxAge: 31536000, // 1 year
      immutable: true,
    },
    css: {
      maxAge: 31536000, // 1 year
      immutable: true,
    },
  },
  
  // Dynamic content - shorter cache with revalidation
  dynamic: {
    pages: {
      maxAge: 60, // 1 minute
      staleWhileRevalidate: 300, // 5 minutes
    },
    api: {
      maxAge: 5, // 5 seconds for real-time data
      staleWhileRevalidate: 30,
    },
    leads: {
      maxAge: 30, // 30 seconds
      staleWhileRevalidate: 120,
    },
  },
  
  // High-res furniture gallery - aggressive caching
  gallery: {
    lowRes: {
      maxAge: 86400, // 1 day
      staleWhileRevalidate: 604800, // 1 week
    },
    highRes: {
      maxAge: 604800, // 1 week
      staleWhileRevalidate: 2592000, // 30 days
    },
  },
};

/**
 * Generate cache headers for different asset types
 */
export function generateCacheHeaders(
  type: "static-image" | "font" | "css" | "page" | "api" | "gallery-low" | "gallery-high"
): Record<string, string> {
  const config = {
    "static-image": EDGE_CACHE_CONFIG.staticAssets.images,
    "font": EDGE_CACHE_CONFIG.staticAssets.fonts,
    "css": EDGE_CACHE_CONFIG.staticAssets.css,
    "page": EDGE_CACHE_CONFIG.dynamic.pages,
    "api": EDGE_CACHE_CONFIG.dynamic.api,
    "gallery-low": EDGE_CACHE_CONFIG.gallery.lowRes,
    "gallery-high": EDGE_CACHE_CONFIG.gallery.highRes,
  }[type];
  
  if (!config) return {};
  
  let cacheControl = `public, max-age=${config.maxAge}`;
  
  if ("staleWhileRevalidate" in config && config.staleWhileRevalidate) {
    cacheControl += `, stale-while-revalidate=${config.staleWhileRevalidate}`;
  }
  
  if ("immutable" in config && config.immutable) {
    cacheControl += ", immutable";
  }
  
  return {
    "Cache-Control": cacheControl,
    "CDN-Cache-Control": cacheControl,
    "Vercel-CDN-Cache-Control": cacheControl,
  };
}

/**
 * Image optimization config for next.config.js
 */
export const IMAGE_OPTIMIZATION_CONFIG = {
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};
