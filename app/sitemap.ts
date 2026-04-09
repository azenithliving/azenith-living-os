import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/rooms`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/request`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/start`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/furniture`, lastModified, changeFrequency: "weekly", priority: 0.75 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];
}
