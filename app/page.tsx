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

      <div className="fixed inset-0 w-full h-full -z-10">
        <AzenithLegacy />
      </div>

      <Hero runtimeConfig={runtimeConfig} />

      <div className="relative">
        <section className="relative z-10 min-h-screen w-full border-t border-white/10 bg-black/40 backdrop-blur-md md:mx-auto md:max-w-7xl">
          <div id="inventory-section" className="relative z-20 pt-8">
            <HomePageClient runtimeConfig={runtimeConfig} />
          </div>
        </section>
      </div>
    </main>
  );
}
