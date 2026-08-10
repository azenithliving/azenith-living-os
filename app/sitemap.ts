import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";
import { FURNITURE_SEO_TYPES, SEO_LANDING_PAGES, SEO_ROOMS } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/about`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/rooms`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/request`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/start`, lastModified, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/furniture`, lastModified, changeFrequency: "weekly", priority: 0.75 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
  ];

  const roomPages: MetadataRoute.Sitemap = Object.entries(SEO_ROOMS).map(([slug, room]) => ({
    url: `${siteUrl}/rooms/${slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: room.priority,
  }));

  const furniturePages: MetadataRoute.Sitemap = Object.entries(FURNITURE_SEO_TYPES).map(([type, page]) => ({
    url: `${siteUrl}/furniture/${type}`,
    lastModified,
    changeFrequency: "weekly",
    priority: page.priority,
  }));

  const seoPages: MetadataRoute.Sitemap = Object.values(SEO_LANDING_PAGES).map((page) => ({
    url: `${siteUrl}/seo/${page.slug}`,
    lastModified,
    changeFrequency: "weekly",
    priority: page.priority,
  }));

  return [...staticPages, ...roomPages, ...furniturePages, ...seoPages];
}
