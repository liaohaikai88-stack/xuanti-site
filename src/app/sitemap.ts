import type { MetadataRoute } from "next";
import { splitPreview } from "@/lib/access";
import { canonicalUrl, casesEnabled } from "@/lib/config";
import { listCases, listTopics } from "@/lib/content";
import { getDb } from "@/lib/db";
import { todayShanghai } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = canonicalUrl();
  const db = getDb();
  const today = todayShanghai();
  const preview = splitPreview(listTopics(db, { date: today }), null).visible;
  const cases = casesEnabled() ? listCases(db) : [];
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/topics`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/calendar`, changeFrequency: "weekly", priority: 0.8 },
    ...(casesEnabled() ? [{ url: `${base}/cases`, changeFrequency: "weekly" as const, priority: 0.6 }] : []),
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    ...preview.map((topic) => ({
      url: `${base}/topics/${topic.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...cases.map((item) => ({
      url: `${base}/cases/${item.id}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  ];
}
