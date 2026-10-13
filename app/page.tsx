import HomeShell from "@/components/home/HomeShell";
import { getRuntimeConfig } from "@/lib/runtime-config";

export const dynamic = "force-dynamic";

/**
 * The front door of the store. The config — including the number every WhatsApp button opens — is
 * read from the store's own record on the server, so a crawler and a phone get the same answer and
 * no page depends on a build-time variable being set. Measured 2026-10-13: this page read
 * NEXT_PUBLIC_WHATSAPP_NUMBER, which is not set on the published site, so the home page carried no
 * WhatsApp link at all.
 */
export default async function Home() {
  const config = await getRuntimeConfig();
  return <HomeShell config={config} />;
}
