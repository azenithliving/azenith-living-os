import Header from "@/components/Header";
import AzenithLegacy from "@/components/AzenithLegacy";
import Hero from "@/components/Hero";
import HomePageClient from "@/components/home-page-client-fixed";
import { getRuntimeConfig } from "@/lib/runtime-config";

export default async function Home() {
  const runtimeConfig = await getRuntimeConfig();
  return (
    <main className="relative min-h-screen">
      <Header />
      
      {/* FIXED BACKGROUND HERO */}
      <div className="fixed inset-0 w-full h-full -z-10">
        <AzenithLegacy />
      </div>

      {/* HERO SECTION */}
      <Hero runtimeConfig={runtimeConfig} />

      {/* SCROLLABLE CONTENT */}
      <div className="relative">
        <section className="relative z-10 min-h-screen backdrop-blur-md bg-black/40 border-t border-white/10 w-full md:max-w-7xl md:mx-auto">
          <div id="inventory-section" className="relative z-20 pt-8">
            <HomePageClient runtimeConfig={runtimeConfig} />
          </div>
        </section>
      </div>
    </main>
  );
}
