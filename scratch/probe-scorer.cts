import { analyzeImageWithProxy, checkProxyHealth } from "@/lib/gemini-proxy-client";

async function main() {
  const health = await checkProxyHealth();
  console.log(`الجيش: ${JSON.stringify(health)}`);
  const url = "https://images.pexels.com/photos/8082235/pexels-photo-8082235.jpeg?auto=compress&cs=tinysrgb&h=650&w=940";
  const started = Date.now();
  const out = await analyzeImageWithProxy("", url, 0, "guest-bedroom", "modern");
  console.log(`رد المصحّح بعد ${Math.round((Date.now() - started) / 1000)} ثانية: ${JSON.stringify(out).slice(0, 220)}`);
}
main().catch((e) => { console.error("فشل:", String(e).slice(0, 200)); process.exit(1); });
