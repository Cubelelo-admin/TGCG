import type { MetadataRoute } from "next";
import { events } from "@/site/content/events";
import { SITE_URL } from "@/site/lib/event";

// /sitemap.xml: the chooser plus every page of each event (its nav routes and /register)
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [{ url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 }];
  for (const e of events) {
    pages.push({ url: `${SITE_URL}${e.basePath}`, lastModified: now, changeFrequency: "daily", priority: 0.9 });
    const routes = new Set(["/register", ...e.nav.map((n) => n.href)]);
    for (const r of routes) {
      pages.push({
        url: `${SITE_URL}${e.basePath}${r}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: r === "/register" ? 0.8 : 0.6,
      });
    }
  }
  return pages;
}
