import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
    qualities: [75, 85],
  },
  i18n: {
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
  },
};

export default nextConfig;
