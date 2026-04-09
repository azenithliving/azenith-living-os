const DEFAULT_SITE_URL = "https://azenithliving.com";

function withProtocol(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function getSiteUrl(): string {
  const candidate =
    process.env.PRIMARY_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_PRIMARY_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    DEFAULT_SITE_URL;

  return withProtocol(candidate).replace(/\/+$/, "");
}
