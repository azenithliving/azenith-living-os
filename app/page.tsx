import Header from "@/components/Header";
import AzenithLegacy from "@/components/AzenithLegacy";
import Hero from "@/components/Hero";
import HomePageClient from "@/components/home-page-client-fixed";
import { getRuntimeConfig } from "@/lib/runtime-config";

// Force dynamic rendering to prevent static generation timeout
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Server-side room image fetching for initial load
async function fetchInitialRoomImages() {
  const roomQueries: Record<string, string> = {
    "master-bedroom": "luxury master bedroom",
    "living-room": "modern living room",
    kitchen: "luxury kitchen",
    "dressing-room": "walk-in closet",
    "home-office": "luxury home office",
    "youth-room": "modern youth bedroom",
    "interior-design": "luxury interior design home",
  };

  const styleHint = "modern minimal luxury";
  const roomSlugs = Object.keys(roomQueries);

  try {
    const imagePromises = roomSlugs.map(async (slug, index) => {
      try {
        const query = `${styleHint} luxury interior design ${roomQueries[slug]}`;
        const page = 1 + index;

        // Use absolute URL for server-side fetch
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || "http://localhost:3000";
        const res = await fetch(
          `${baseUrl}/api/pexels?query=${encodeURIComponent(query)}&per_page=1&page=${page}`,
          { next: { revalidate: 3600 } }
        );

        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }

        const data = await res.json();
        const img = data.photos?.[0]?.src?.large || "/placeholder-room.jpg";
        return { [slug]: img };
      } catch {
        return { [slug]: "/placeholder-room.jpg" };
      }
    });

    const images = await Promise.all(imagePromises);
    return Object.assign({}, ...images);
  } catch {
    // Return all placeholders on error
    return roomSlugs.reduce((acc, slug) => ({ ...acc, [slug]: "/placeholder-room.jpg" }), {});
  }
}

export default async function Home() {
  const runtimeConfig = await getRuntimeConfig();
  const initialRoomImages = await fetchInitialRoomImages();

  return (
    <main id="main-content" className="relative min-h-screen">
      <a
        href="#inventory-section"
        className="sr-only absolute right-4 top-4 z-[120] rounded-full bg-white px-4 py-2 text-sm font-medium text-black focus:not-sr-only"
      >
        تجاوز إلى المحتوى
      </a>

      <Header />

      <div className="fixed inset-0 w-full h-full -z-10">
        <AzenithLegacy />
      </div>

      <Hero />

      <div className="relative">
        <section className="relative z-10 min-h-screen w-full border-t border-white/10 bg-black/40 backdrop-blur-md md:mx-auto md:max-w-7xl">
          <div id="inventory-section" className="relative z-20 pt-8">
            <HomePageClient runtimeConfig={runtimeConfig} initialRoomImages={initialRoomImages} />
          </div>
        </section>
      </div>
    </main>
  );
}
