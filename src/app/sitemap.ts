import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";
import { products } from "@/lib/products";

/*
 * Computed per request, not at build.
 *
 * Next prerenders this file during `next build`, where APP_URL and
 * NEXT_PUBLIC_APP_URL are not reliably present, so getAppUrl() fell through to
 * its placeholder default. Production served every URL as
 * https://build-time-placeholder.invalid, and the sitemaps.org protocol drops
 * cross-host entries, so Google could discover nothing. robots.txt pointed at a
 * sitemap on that dead host too.
 *
 * force-dynamic removes the build-time env dependency altogether rather than
 * relying on the right variable reaching the builder. These two files are tiny
 * and are fetched by crawlers, not customers, so there is nothing to cache.
 */
export const dynamic = "force-dynamic";


export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl();

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/shop`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    // Above /about deliberately. This is the only page in the shop describing
    // something no competitor in this market offers, so it is the page most
    // worth a crawler finding.
    { url: `${baseUrl}/custom`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/track`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${baseUrl}/account`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/shop/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...productPages];
}