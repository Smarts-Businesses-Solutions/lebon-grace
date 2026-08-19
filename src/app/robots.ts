import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/app-url";

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


export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/checkout"],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}