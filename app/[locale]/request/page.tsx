import RequestPageClient from "@/components/request-page-client";
import { getRuntimeConfig } from "@/lib/runtime-config";

export default async function RequestPage() {
  const runtimeConfig = await getRuntimeConfig();
  return <RequestPageClient runtimeConfig={runtimeConfig} />;
}
