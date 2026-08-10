const DEFAULT_SITE_URL = "https://azenith-living.vercel.app";

function withProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getSiteUrl(): string {
  const candidate =
    process.env.PRIMARY_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_PRIMARY_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ||
    process.env.VERCEL_URL?.trim() ||
    DEFAULT_SITE_URL;

  return withProtocol(candidate).replace(/\/+$/, "");
}
