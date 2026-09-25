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
  // nosniff / Referrer-Policy / framing / device-permission headers and no
  // Content-Security-Policy at all. Written against what this site actually
  // loads, so it can be enforced rather than postponed:
  //  • script-src: this site + only the Google ad/analytics hosts the owner
  //    switches on in Settings. 'unsafe-inline' stays because Next's boot
  //    scripts and the ads tags are inline; dropping it needs a nonce pass.
  //    'unsafe-eval' is deliberately NOT granted — a violation would be a
  //    finding to look at, not something to pre-allow.
  //  • *.posthog.com is listed because the browser suite caught it blocked on
  //    the first deploy: the policy was written from the code, and the site also
  //    loads PostHog through app/providers.tsx. Keep this list in sync by
  //    running `node scripts/qayyim-ui-test.mjs` — its last check fails on any
  //    CSP violation, which is how that one was found.
  //  • frame-src https: on purpose: the admin viewer embeds other people's
  //    sites (that is the feature); frame-ancestors 'self' still stops anyone
  //    embedding THIS site.
  //  • img/media stay broad (https:) because product imagery and the hero video
  //    come from outside hosts — a wrong host there blanks the gallery.
  //  • microphone is deliberately NOT restricted (the commander's voice input
  //    uses it) and COOP/COEP are untouched (ads open cross-origin windows).
  // Access-Control-Allow-Origin: * on cached HTML comes from Vercel's CDN for
  // static responses; it is not set by this app.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://www.googletagmanager.com https://www.google.com https://googleads.g.doubleclick.net https://securepubads.g.doubleclick.net https://*.posthog.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.supabase.in wss://*.supabase.in https://www.google.com https://analytics.google.com https://pagead2.googlesyndication.com https://*.posthog.com",
      "frame-src 'self' https:",
      "frame-ancestors 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https:",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: csp },
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
