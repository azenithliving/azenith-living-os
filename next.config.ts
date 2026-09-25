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
  typescript: {
    ignoreBuildErrors: false,
  },
  // The prod qa_security_headers probe reported FAIL: the site sent no
  // nosniff / Referrer-Policy / framing / device-permission headers at all.
  // Chosen so nothing on the storefront breaks:
  //  • microphone is deliberately NOT restricted — the commander's voice input
  //    uses it — and COOP/COEP are left alone because AdSense/analytics open
  //    cross-origin windows.
  //  • a real Content-Security-Policy is still missing: it cannot be written
  //    honestly without a browser pass over the third-party scripts
  //    (AdSense, analytics, the hero video, webfonts), so it is not faked here.
  // Access-Control-Allow-Origin: * on cached HTML comes from Vercel's CDN for
  // static responses; it is not set by this app.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
